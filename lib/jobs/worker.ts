import {WORKER_HOURLY_LIMIT} from './limits';
import {classifyProviderError,sanitizeProviderDiagnostic,type ProviderDiagnostic} from '../generation/provider-diagnostics';
import {validationDiagnostic} from '../generation/diagnostics';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {GuideStore} from '../storage/file-guide-store';
import type {ResearchInput,ResearchResult} from '../research/types';
import {GENERATION_MODEL,type ModelTransport,type PreparedInput,type ModelRequest} from '../generation/types';
import {prepareGeneration} from '../generation/prepare';
import {prepareJobSection,buildSectionRequest,validateJobSection,SECTION_LIMITS} from './sections';
import {assembleSections} from './assemble';
import {record} from './guards';
import {STAGES,type GenerationJob} from './types';
import type {JobStore} from './store';
export interface WorkerDependencies{store:JobStore;guides:GuideStore;research:(input:ResearchInput)=>Promise<ResearchResult>;transport:(requestId:string)=>ModelTransport;enabled:()=>boolean;now?:()=>number;takeQuota?:()=>Promise<boolean>}
export async function recoverInterrupted(store:JobStore){for(const id of await store.ids())await store.update(id,job=>{if(job.status==='running'){job.status='failed';job.error={code:'worker-interrupted',stage:STAGES[job.stageIndex]};delete job.runId;delete job.startedAt;}});}
export async function runOneJobStep(deps:WorkerDependencies):Promise<boolean>{
 if(!deps.enabled())return false;
 const jobs=(await Promise.all((await deps.store.ids()).map(id=>deps.store.get(id)))).filter((j):j is GenerationJob=>!!j&&j.status==='queued').sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const candidate=jobs[0];if(!candidate)return false;
 const pendingStage=STAGES[candidate.stageIndex];let preparedSection:PreparedInput|undefined,sectionRequest:ModelRequest|undefined;
 if(pendingStage!=='research'&&pendingStage!=='assemble'){
  try{if(!candidate.research||!candidate.input.provider)throw Error('missing-research');const provider=candidate.input.provider,slug=provider.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'');preparedSection=prepareJobSection({provider,slug,research:candidate.research},pendingStage);sectionRequest=buildSectionRequest(preparedSection,pendingStage);}catch(error){const code=error instanceof Error&&error.message==='section-request-too-large'?'section-request-too-large':'insufficient-documentation';await deps.store.update(candidate.id,j=>{j.status='failed';j.error={code,stage:pendingStage};});return true;}
  if(deps.takeQuota&&!await deps.takeQuota())return false;
 }
 let runId='';const claimed=await deps.store.update(candidate.id,job=>{if(job.status!=='queued')return;job.status='running';job.runId=randomUUID();job.startedAt=new Date().toISOString();runId=job.runId;job.attempts++;delete job.error;});
 if(!claimed||!runId)return false;
 const stage=STAGES[claimed.stageIndex];let parsedOutput:unknown;let phase:'research'|'generation'|'validation'|'storage'='generation';
 try{
  if(stage==='research'){
   phase='research';const research=await deps.research(claimed.input);
   if(research.status==='website-required'||!research.website)throw Error('missing-website');
   const provider=claimed.input.provider??new URL(research.website).hostname.replace(/^www\./,'');
   const slug=provider.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'');
   prepareGeneration({provider,slug,research});
   await deps.store.update(claimed.id,j=>{if(j.runId!==runId)throw Error('job-ownership-changed');j.input={...j.input,provider};j.research=research;j.status='queued';j.stageIndex=1;delete j.runId;delete j.startedAt;});
  }else if(stage==='assemble'){
   phase='validation';const result=assembleSections(claimed.sections);phase='storage';
   const saved=await deps.guides.save(result,claimed.id);
   await deps.store.update(claimed.id,j=>{j.saved={id:saved.id,path:`/guides/${saved.id}`};j.status='completed';delete j.runId;delete j.startedAt;});
  }else{
   if(!preparedSection||!sectionRequest)throw Error('missing-section-input');
   const input=preparedSection,request=sectionRequest;
   const transport=deps.transport(runId);
   const reply=await transport(request);
   if(reply.finishReason&&reply.finishReason!=='STOP')throw providerFailure({stage:'provider-response',category:'incomplete-response',finishReason:reply.finishReason});
   if(reply.returnedModel&&reply.returnedModel!==(transport.model??GENERATION_MODEL))throw providerFailure({stage:'provider-response',category:'unexpected-model'});
   if(!reply.text||Buffer.byteLength(reply.text)>SECTION_LIMITS.maxOutputBytes)throw providerFailure({stage:'provider-response',category:'invalid-output-size'});
   let draft:unknown;try{draft=JSON.parse(reply.text);}catch{throw providerFailure({stage:'response-json',category:'invalid-json'});}
   phase='validation';parsedOutput=draft;const content=validateJobSection(draft,input,stage);
   await deps.store.update(claimed.id,j=>{if(j.runId!==runId)throw Error('job-ownership-changed');j.sections.push({key:stage,input,draft,content,completedAt:new Date().toISOString(),model:transport.model??GENERATION_MODEL});j.stageIndex++;j.status='queued';delete j.runId;delete j.startedAt;});
  }
 }catch(error){
  const provider=phase==='generation'?(record(error)&&error.providerDiagnostic?sanitizeProviderDiagnostic(error.providerDiagnostic):classifyProviderError(error)):undefined;
  const code=provider?providerErrorCode(provider):phase==='research'?'research-failed':phase==='validation'?(stage==='assemble'?'invalid-guide':'invalid-section'):phase==='storage'?'storage-failed':'generation-failed';
  await deps.store.update(claimed.id,j=>{if(j.runId===runId){j.status='failed';j.error={code,stage,requestId:runId,...provider?{provider}:{},...preparedSection&&phase==='validation'?{validation:validationDiagnostic(error,preparedSection,record(parsedOutput)&&record(parsedOutput.section)?{guide:parsedOutput.section}:parsedOutput)}:{}};delete j.runId;delete j.startedAt;}});
 }
 return true;
}
// One worker process owns this persistent quota; no automatic provider retries.
export async function takeWorkerQuota(store:JobStore,now=Date.now()):Promise<boolean>{return store.lock('quota',async()=>{
 const path=join(store.root,'.quota');let calls:number[]=[];
 try{const data:unknown=JSON.parse(await readFile(path,'utf8'));if(!Array.isArray(data)||data.some(t=>typeof t!=='number'))throw Error('invalid-quota');calls=data.filter((t):t is number=>typeof t==='number'&&now-t<3600000);}catch(e){if(!record(e)||e.code!=='ENOENT')throw e;}
 if(calls.length>=WORKER_HOURLY_LIMIT||calls.length&&now-calls[calls.length-1]<60000)return false;
 calls.push(now);await writeFile(path,JSON.stringify(calls),{mode:0o600});return true;
 });}

function providerFailure(diagnostic:unknown){return Object.assign(new Error('Provider response rejected'),{providerDiagnostic:sanitizeProviderDiagnostic(diagnostic)});}
function providerErrorCode(d:ProviderDiagnostic){
 if(d.category==='rate-limit')return 'gemini-quota';
 if(d.category==='upstream-unavailable')return 'provider-unavailable';
 if(d.category==='timeout')return 'generation-timeout';
 if(d.category==='incomplete-response')return 'incomplete-output';
 if(d.category==='invalid-json'||d.category==='invalid-output-size')return 'invalid-output';
 return 'generation-failed';
}
