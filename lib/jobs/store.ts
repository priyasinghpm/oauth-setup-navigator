import {sanitizeProviderDiagnostic} from '../generation/provider-diagnostics';
import {checkedEvidence} from '../research/evidence';
import {sanitizeValidationDiagnostic} from '../generation/diagnostics';
import {randomUUID} from 'node:crypto';
import {mkdir,open,readFile,readdir,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {isSavedGuideId} from '../storage/file-guide-store';
import {prepareGeneration} from '../generation/prepare';
import {inputOf} from '../api/generate-guide';
import {parsePrepared,parseResearch,record} from './guards';
import {validateJobSection} from './sections';
import {SECTION_KEYS,STAGES,type GenerationJob,type SectionCheckpoint} from './types';
export const validJobId=isSavedGuideId;
const iso=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function parseJob(value:unknown):GenerationJob{
 if(!record(value)||value.version!==1||typeof value.id!=='string'||!validJobId(value.id)||!iso(value.createdAt)||!iso(value.updatedAt)||!['queued','running','paused','failed','completed'].includes(String(value.status))||typeof value.stageIndex!=='number'||!Number.isInteger(value.stageIndex)||value.stageIndex<0||value.stageIndex>=STAGES.length||typeof value.attempts!=='number'||!Number.isInteger(value.attempts)||value.attempts<0||!Array.isArray(value.sections)||value.reviewStatus!=='not-human-reviewed'||value.oauthTestStatus!=='not-tested')throw Error('invalid-job-record');
 const parsedInput=inputOf(record(value.input)?Object.fromEntries(Object.entries(value.input).filter(([,v])=>v!==undefined)):value.input);
 const input={...(parsedInput.provider?{provider:parsedInput.provider}:{}),...(parsedInput.website?{website:parsedInput.website}:{})},research=value.research===undefined?undefined:parseResearch(value.research);
 const admitted=research?prepareGeneration({provider:input.provider??new URL(research.website!).hostname,slug:'job-checkpoint',research}):undefined;
 const sections:SectionCheckpoint[]=value.sections.map((s,i)=>{
  if(!record(s)||s.key!==SECTION_KEYS[i]||!iso(s.completedAt)||typeof s.model!=='string')throw Error('invalid-job-section');
  const key=SECTION_KEYS[i];if(!key)throw Error('invalid-job-section');
  const prepared=parsePrepared(s.input);
  if(!research||!admitted||prepared.provider!==admitted.provider||prepared.providerDomain!==admitted.providerDomain)throw Error('invalid-job-provider');
  for(const source of prepared.sources){const actual=admitted.sources.find(x=>x.id===source.id),page=research.pages.find(p=>p.url===source.url);if(!actual||!page||actual.url!==source.url||actual.title!==source.title||actual.inspectedAt!==source.inspectedAt||actual.originalText!==source.originalText)throw Error('invalid-job-source');const canonical=checkedEvidence(page.text,page.url,page.title,page.excerpts,page.truncated);for(const e of source.excerpts)if(!canonical.some(c=>c.id===e.id&&c.quote===e.quote&&c.startOffset===e.startOffset&&c.endOffset===e.endOffset&&c.sectionHeading===e.sectionHeading))throw Error('invalid-job-excerpt');}
  const content=validateJobSection(s.draft,prepared,key);
  return {key,input:prepared,draft:s.draft,content,completedAt:s.completedAt,model:s.model};
 });
 if(sections.length>4||value.stageIndex>0&&!research||value.stageIndex>sections.length+1)throw Error('invalid-job-progress');
 const status=value.status;if(status!=='queued'&&status!=='running'&&status!=='paused'&&status!=='failed'&&status!=='completed')throw Error('invalid-job-status');
 const job:GenerationJob={version:1,id:value.id,createdAt:value.createdAt,updatedAt:value.updatedAt,input,status,stageIndex:value.stageIndex,attempts:value.attempts,research,sections,reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};
 if(value.runId!==undefined){if(typeof value.runId!=='string'||!validJobId(value.runId)||!iso(value.startedAt))throw Error('invalid-job-run');job.runId=value.runId;job.startedAt=value.startedAt;}
 if(value.error!==undefined){const error=value.error;const stage=record(error)?STAGES.find(s=>s===error.stage):undefined;if(!record(error)||typeof error.code!=='string'||!['gemini-quota','provider-unavailable','generation-timeout','incomplete-output','invalid-output','research-failed','section-request-too-large','insufficient-documentation','generation-failed','invalid-section','invalid-guide','worker-interrupted','storage-failed','request-limit','configuration-unavailable'].includes(error.code)||!stage)throw Error('invalid-job-error');job.error={code:error.code,stage};if(typeof error.requestId==='string'&&validJobId(error.requestId))job.error.requestId=error.requestId;if(error.validation!==undefined)job.error.validation=sanitizeValidationDiagnostic(error.validation);if(error.provider!==undefined)job.error.provider=sanitizeProviderDiagnostic(error.provider);}
 if(value.saved!==undefined){if(!record(value.saved)||typeof value.saved.id!=='string'||!validJobId(value.saved.id)||value.saved.path!==`/guides/${value.saved.id}`)throw Error('invalid-job-link');job.saved={id:value.saved.id,path:value.saved.path};}
 if(status==='completed'&&(!job.saved||sections.length!==4))throw Error('invalid-job-completion');
 return job;
}
// Legacy recovery could append the PID twice. Treat every plausible owner as
// live until positively proven dead; never steal a lock from either candidate.
export function lockOwners(text:string):number[]{
 const raw=text.trim();if(!/^[1-9][0-9]{0,19}$/.test(raw))return [];
 const valid=(s:string)=>{const n=Number(s);return Number.isSafeInteger(n)&&n>0&&n<=2147483647?n:undefined;};
 const owners:number[]=[];const full=valid(raw);if(full!==undefined)owners.push(full);
 if(raw.length%2===0){const half=raw.slice(0,raw.length/2);if(half===raw.slice(raw.length/2)){const owner=valid(half);if(owner!==undefined&&!owners.includes(owner))owners.push(owner);}}
 return owners;
}
export class JobBusyError extends Error{}
export function createJobStore(directory:string){
 const root=resolve(directory);
 async function ready(){await mkdir(root,{recursive:true,mode:0o700});}
 async function write(job:GenerationJob){const validated=parseJob(job);await ready();const path=join(root,`.pending-${randomUUID()}`);const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(validated));await f.sync();}finally{await f.close();}try{await rename(path,join(root,job.id+'.json'));}finally{await unlink(path).catch(()=>{});}}
 async function get(id:string){if(!validJobId(id))return null;try{const raw=await readFile(join(root,id+'.json'));if(raw.length>4000000)throw Error('job-too-large');const parsed=parseJob(JSON.parse(raw.toString()));if(parsed.id!==id)throw Error('job-id-mismatch');return parsed;}catch(e){if(record(e)&&e.code==='ENOENT')return null;throw e;}}
 async function ids(){await ready();return (await readdir(root)).filter(f=>f.endsWith('.json')&&validJobId(f.slice(0,-5))).map(f=>f.slice(0,-5));}
 async function lock<T>(name:string,work:()=>Promise<T>):Promise<T>{
  await ready();const path=join(root,'.'+name+'.lock');let f;
  try{f=await open(path,'wx',0o600);}catch(e){if(record(e)&&e.code==='EEXIST'){
    // Serialize stale-lock recovery so two processes cannot both unlink a
    // replacement lock. An unreadable recovery lock fails closed.
    const recovery=path+'.recovery';let guard;
    try{guard=await open(recovery,'wx',0o600);}catch{throw new JobBusyError('job-busy');}
    try{
     await guard.writeFile(String(process.pid));
     let owners:number[];try{owners=lockOwners(await readFile(path,'utf8'));}catch{throw new JobBusyError('job-busy');}
     if(!owners.length)throw new JobBusyError('job-busy');
     for(const owner of owners){let dead=false;try{process.kill(owner,0);}catch(error){dead=record(error)&&error.code==='ESRCH';}if(!dead)throw new JobBusyError('job-busy');}
     await unlink(path);try{f=await open(path,'wx',0o600);await f.writeFile(String(process.pid));}catch{throw new JobBusyError('job-busy');}
    }finally{await guard.close();await unlink(recovery).catch(()=>{});}
   }else throw e;}
  try{await f.write(String(process.pid),0,'utf8');return await work();}finally{await f.close();await unlink(path).catch(()=>{});}
 }
 return {root,ready,get,ids,write,lock,async create(input:GenerationJob['input']){return lock('create',async()=>{if((await ids()).length>=100)throw Error('job-storage-limit');const now=new Date().toISOString();const job:GenerationJob={version:1,id:randomUUID(),createdAt:now,updatedAt:now,input,status:'queued',stageIndex:0,attempts:0,sections:[],reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};await write(job);return job;});},async update(id:string,change:(job:GenerationJob)=>void|Promise<void>){if(!validJobId(id))return null;return lock(id,async()=>{const job=await get(id);if(!job)return null;await change(job);job.updatedAt=new Date().toISOString();await write(job);return job;});}};
}
export type JobStore=ReturnType<typeof createJobStore>;
