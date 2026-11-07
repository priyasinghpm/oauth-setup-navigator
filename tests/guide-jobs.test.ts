import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore,JobBusyError} from '../lib/jobs/store';
import {createFileGuideStore} from '../lib/storage/file-guide-store';
import {createJobApi} from '../lib/jobs/api';
import {runOneJobStep,recoverInterrupted,takeWorkerQuota,type WorkerDependencies} from '../lib/jobs/worker';
import {prepareJobSection,buildSectionRequest,validateJobSection,SECTION_LIMITS} from '../lib/jobs/sections';
import {SECTION_KEYS} from '../lib/jobs/types';
import {queueInput,sectionReply} from './helpers/queue';
const req=(path:string,body:unknown={})=>new Request('http://localhost:3000'+path,{method:'POST',headers:{'Content-Type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify(body)});
async function setup(){const dir=await mkdtemp(join(tmpdir(),'oauth-job-test-')),store=createJobStore(join(dir,'jobs')),guides=createFileGuideStore(join(dir,'guides'));let researchCalls=0,modelCalls=0;
 const deps:WorkerDependencies={store,guides,enabled:()=>true,research:async()=>{researchCalls++;return queueInput().research;},transport:()=>async request=>{modelCalls++;return sectionReply(request);}};
 const api=createJobApi({store:()=>store,enabled:()=>true,configured:()=>true});
 return {dir,store,guides,deps,api,counts:()=>({researchCalls,modelCalls})};}
test('persistent queue automatically advances, reuses research and sections, validates and saves final guide',async()=>{
 const s=await setup();try{
 const create=await s.api.create(req('/api/guides/jobs',{provider:'Example',website:'https://docs.example.com'}));assert.equal(create.status,201);const body=await create.json(),id=body.job.id;assert.match(id,/^[a-f0-9-]{36}$/);assert.deepEqual(s.counts(),{researchCalls:0,modelCalls:0});
 await runOneJobStep(s.deps);let job=await s.store.get(id);assert.equal(job?.status,'queued');assert.equal(job.stageIndex,1);assert.deepEqual(s.counts(),{researchCalls:1,modelCalls:0});
 for(let i=0;i<4;i++){
  assert.equal((await s.api.resume(req('/resume'),id)).status,409);
  await runOneJobStep(s.deps);job=await s.store.get(id);
  assert.equal(job?.status,'queued');assert.equal(job.sections.length,i+1);
  assert.deepEqual(s.counts(),{researchCalls:1,modelCalls:i+1});
  const restarted=createJobStore(join(s.dir,'jobs'));assert.deepEqual((await restarted.get(id))?.sections,job.sections);
 }
 const before=JSON.stringify(job!.sections);await runOneJobStep(s.deps);job=await s.store.get(id);
 assert.equal(job?.status,'completed');assert.equal(job.saved?.id,id);assert.equal(JSON.stringify(job.sections),before);assert.deepEqual(s.counts(),{researchCalls:1,modelCalls:4});
 const saved=await s.guides.get(id);assert.ok(saved);assert.equal(saved.reviewStatus,'not-human-reviewed');assert.equal(saved.guide.oauthTestStatus,'not-tested');assert.equal(saved.guide.steps.length,4);assert.ok(saved.guide.steps[0].evidence.quotations?.length);
 assert.deepEqual(await createFileGuideStore(join(s.dir,'guides')).get(id),saved);
 assert.equal((await s.api.resume(req('/resume'),id)).status,409);
 const view=await (await s.api.get(id)).json();assert.equal(view.job.saved.path,'/guides/'+id);assert.equal(JSON.stringify(view).includes('originalText'),false);assert.equal(JSON.stringify(view).includes('evidenceRegistry'),false);
 }finally{await rm(s.dir,{recursive:true,force:true});}});
test('invalid model selection pauses without storing it or retrying; explicit resume reuses checkpoint',async()=>{
 const s=await setup();try{const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(s.deps);
 let calls=0;const fail={...s.deps,transport:()=>async(request:Parameters<ReturnType<WorkerDependencies['transport']>>[0])=>{calls++;const reply=sectionReply(request),value=JSON.parse(reply.text);value.section.steps[0].evidence.evidenceIds=['w1'];return {...reply,text:JSON.stringify(value)};}};
 await runOneJobStep(fail);assert.equal(calls,1);assert.equal((await s.store.get(job.id))?.error?.code,'invalid-section');assert.equal((await s.store.get(job.id))?.sections.length,0);
 assert.equal(await runOneJobStep(fail),false);assert.equal(calls,1);
 await s.api.resume(req('/resume'),job.id);await runOneJobStep(s.deps);assert.equal((await s.store.get(job.id))?.sections.length,1);assert.equal(s.counts().researchCalls,1);
 }finally{await rm(s.dir,{recursive:true,force:true});}});
test('interrupted work is failed on recovery and never automatically retried',async()=>{
 const s=await setup();try{const job=await s.store.create({provider:'Example'});await s.store.update(job.id,j=>{j.status='running';j.runId='00000000-0000-4000-8000-000000000000';j.startedAt=new Date().toISOString();});await recoverInterrupted(s.store);const restored=await s.store.get(job.id);assert.equal(restored?.status,'failed');assert.equal(restored.error?.code,'worker-interrupted');assert.equal(await runOneJobStep(s.deps),false);assert.deepEqual(s.counts(),{researchCalls:0,modelCalls:0});}finally{await rm(s.dir,{recursive:true,force:true});}});
test('one worker lock prevents concurrent workers; persistent quota survives restart and expires naturally',async()=>{
 const s=await setup();try{
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);const holder=s.store.lock('worker',()=>wait);await new Promise(r=>setTimeout(r,20));await assert.rejects(()=>s.store.lock('worker',async()=>{}),JobBusyError);release();await holder;
 for(let i=0;i<10;i++)assert.equal(await takeWorkerQuota(s.store,1000000+i*60000),true);
 assert.equal(await takeWorkerQuota(createJobStore(s.store.root),1000000+10*60000),false);
 assert.equal(await takeWorkerQuota(s.store,1000000+3600000),true);
 }finally{await rm(s.dir,{recursive:true,force:true});}});
test('job API rejects disabled, foreign, credential-bearing and malformed input; missing IDs return 404',async()=>{
 const s=await setup();try{
 const disabled=createJobApi({store:()=>s.store,enabled:()=>false,configured:()=>true});assert.equal((await disabled.create(req('/api/guides/jobs',{provider:'Example'}))).status,503);
 assert.equal((await s.api.create(new Request('http://localhost:3000/api/guides/jobs',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}))).status,403);
 for(const body of [{},{website:'https://127.0.0.1/oauth'},{provider:'AIza'+'x'.repeat(30)},{provider:'Example',apiKey:'DO_NOT_STORE'}])assert.equal((await s.api.create(req('/api/guides/jobs',body))).status,400);
 assert.equal((await s.api.get('../anything')).status,404);assert.equal((await s.api.get('00000000-0000-4000-8000-000000000000')).status,404);assert.deepEqual(s.counts(),{researchCalls:0,modelCalls:0});
 }finally{await rm(s.dir,{recursive:true,force:true});}});
test('section preparation stays bounded, preserves canonical IDs and rejects unsupported literals',()=>{
 const input=queueInput();for(const key of SECTION_KEYS){const prepared=prepareJobSection(input,key),request=buildSectionRequest(prepared,key);assert.ok(prepared.evidenceRegistry.length<=SECTION_LIMITS.maxExcerpts);assert.ok(Buffer.byteLength(JSON.stringify(request))<=SECTION_LIMITS.maxRequestBytes);const draft=JSON.parse(sectionReply(request).text);const content=validateJobSection(draft,prepared,key);assert.equal(content.steps?.length,1);draft.section.steps[0].description='Call https://unrelated.example/unsupported.';assert.throws(()=>validateJobSection(draft,prepared,key));}
});
test('storage rejects corrupted section records and does not expose raw diagnostics',async()=>{
 const s=await setup();try{const job=await s.store.create({provider:'Example'});await writeFile(join(s.store.root,job.id+'.json'),JSON.stringify({...job,stageIndex:4,sections:[],error:{code:'SECRET_ERROR',stage:'research'}}));const response=await s.api.get(job.id),raw=await response.text();assert.equal(response.status,503);assert.equal(raw.includes('SECRET_ERROR'),false);}finally{await rm(s.dir,{recursive:true,force:true});}});

test('final save is idempotent after interruption and never overwrites a genuine saved guide',async()=>{
 const s=await setup();try{const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(s.deps);
 for(let i=0;i<4;i++){await runOneJobStep(s.deps);}
 const sections=(await s.store.get(job.id))!.sections;
 const {assembleSections}=await import('../lib/jobs/assemble');const result=assembleSections(sections);
 const first=await s.guides.save(result,job.id),again=await s.guides.save(result,job.id);assert.deepEqual(again,first);
 const changed=structuredClone(result);changed.guide.summary='Different content';await assert.rejects(()=>s.guides.save(changed,job.id));assert.deepEqual(await s.guides.get(job.id),first);
 await runOneJobStep(s.deps);assert.equal((await s.store.get(job.id))?.saved?.id,job.id);assert.equal(s.counts().modelCalls,4);
 }finally{await rm(s.dir,{recursive:true,force:true});}});
test('worker quota waiting does not claim or repeatedly increment a queued stage',async()=>{
 const s=await setup();try{const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(s.deps);const before=await s.store.get(job.id);assert.equal(await runOneJobStep({...s.deps,takeQuota:async()=>false}),false);assert.deepEqual(await s.store.get(job.id),before);assert.equal(s.counts().modelCalls,0);}finally{await rm(s.dir,{recursive:true,force:true});}});
test('dead worker locks can be recovered without stealing a live lock',async()=>{
 const s=await setup();try{await s.store.ready();await writeFile(join(s.store.root,'.worker.lock'),'2147483647');let ran=false;await s.store.lock('worker',async()=>{ran=true;});assert.equal(ran,true);}finally{await rm(s.dir,{recursive:true,force:true});}});

test('concurrent stale-lock recovery permits only one holder',async()=>{
 const s=await setup();try{await s.store.ready();await writeFile(join(s.store.root,'.worker.lock'),'2147483647');let active=0,peak=0;const hold=()=>s.store.lock('worker',async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,40));active--;});const result=await Promise.allSettled([hold(),hold()]);assert.equal(peak,1);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);}finally{await rm(s.dir,{recursive:true,force:true});}});

test('automatic advancement stops at a later failed section and preserves the completed prefix',async()=>{
 const s=await setup();try{
 const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});
 await runOneJobStep(s.deps);await runOneJobStep(s.deps);const before=(await s.store.get(job.id))!.sections;
 assert.equal(before.length,1);let failedCalls=0;
 await runOneJobStep({...s.deps,transport:()=>async()=>{failedCalls++;throw Object.assign(Error('PRIVATE_PROVIDER_RESPONSE'),{status:503});}});
 const failed=await s.store.get(job.id);assert.equal(failed?.status,'failed');assert.equal(failed.error?.stage,'authorization');assert.deepEqual(failed.sections,before);
 assert.equal(await runOneJobStep(s.deps),false);assert.equal(failedCalls,1);assert.equal(s.counts().modelCalls,1);
 }finally{await rm(s.dir,{recursive:true,force:true});}
});

test('compact section prompt retains evidence/security/uncertainty policies and keeps the size guard',()=>{
 const prepared=prepareJobSection(queueInput(),'foundation'),request=buildSectionRequest(prepared,'foundation');
 assert.match(request.systemInstruction,/UNTRUSTED REFERENCE DATA/);assert.match(request.systemInstruction,/contextWindowIndex.*NOT a citation/);assert.match(request.systemInstruction,/same claim/);assert.match(request.systemInstruction,/Scope names\/purposes are documented facts/);assert.match(request.systemInstruction,/approvalWaitingTime must be unknown/);assert.match(request.systemInstruction,/blocker recovery must be unknown/);
 assert.equal(SECTION_LIMITS.maxRequestBytes,20000);
 const oversized=structuredClone(prepared);oversized.sources[0].title='x'.repeat(20001);
 assert.throws(()=>buildSectionRequest(oversized,'foundation'),/section-request-too-large/);
});

test('oversized serialized section is classified before any model request without losing research',async()=>{
 const s=await setup();try{
 const i=queueInput();i.research.pages[0].text='# OAuth registration\n\n'+Array.from({length:5},()=>('Create an OAuth application and register callback. '+'\\"'.repeat(650)+'.')).join('\n\n');
 const deps={...s.deps,research:async()=>i.research};
 const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(deps);await runOneJobStep(deps);
 const failed=await s.store.get(job.id);assert.equal(failed?.status,'failed');assert.equal(failed.error?.code,'section-request-too-large');assert.ok(failed.research);assert.equal(s.counts().modelCalls,0);
 }finally{await rm(s.dir,{recursive:true,force:true});}
});

test('provider failures retain sanitized diagnostics, stop without retry, and preserve completed sections',async()=>{
 for(const [status,providerCode,expected] of [[429,'RESOURCE_EXHAUSTED','gemini-quota'],[503,'UNAVAILABLE','provider-unavailable'],[400,'INVALID_ARGUMENT','generation-failed']] as const){
  const s=await setup();try{
   const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(s.deps);await runOneJobStep(s.deps);const prefix=(await s.store.get(job.id))!.sections;let calls=0;
   await runOneJobStep({...s.deps,transport:()=>async()=>{calls++;throw Object.assign(new Error(JSON.stringify({error:{status:providerCode,message:'PRIVATE_PROVIDER_BODY'}})),{status});}});
   const failed=await s.store.get(job.id);assert.equal(failed?.error?.code,expected);assert.equal(failed.error.provider?.providerHttpStatus,status);assert.equal(failed.error.provider?.providerCode,providerCode);assert.deepEqual(failed.sections,prefix);assert.equal(await runOneJobStep(s.deps),false);assert.equal(calls,1);
   const publicResponse=await (await s.api.get(job.id)).json();assert.equal(JSON.stringify(publicResponse).includes('PRIVATE_PROVIDER_BODY'),false);assert.equal(JSON.stringify(publicResponse).includes('providerHttpStatus'),false);assert.equal(JSON.stringify(failed.error).includes('PRIVATE_PROVIDER_BODY'),false);
  }finally{await rm(s.dir,{recursive:true,force:true});}
 }
});
test('incomplete or malformed provider responses persist the precise safe response stage',async()=>{
 for(const [reply,code,category] of [[{text:'{}',finishReason:'MAX_TOKENS'},'incomplete-output','incomplete-response'],[{text:'not JSON',finishReason:'STOP'},'invalid-output','invalid-json'],[{text:'',finishReason:'STOP'},'invalid-output','invalid-output-size']] as const){
  const s=await setup();try{const job=await s.store.create({provider:'Example',website:'https://docs.example.com'});await runOneJobStep(s.deps);let calls=0;await runOneJobStep({...s.deps,transport:()=>async()=>{calls++;return reply;}});const failed=await s.store.get(job.id);assert.equal(failed?.error?.code,code);assert.equal(failed.error.provider?.category,category);if(reply.finishReason==='MAX_TOKENS')assert.equal(failed.error.provider?.finishReason,'MAX_TOKENS');assert.equal(calls,1);assert.equal(await runOneJobStep(s.deps),false);}finally{await rm(s.dir,{recursive:true,force:true});}
 }
});

test('recovered lock contains exactly one PID and duplicated dead legacy locks are recoverable',async()=>{
 const s=await setup();try{await s.store.ready();const path=join(s.store.root,'.worker.lock');
 for(const stale of ['2147483647','21474836472147483647']){await writeFile(path,stale);await s.store.lock('worker',async()=>{assert.equal(await readFile(path,'utf8'),String(process.pid));});}
 }finally{await rm(s.dir,{recursive:true,force:true});}
});
test('duplicated live owner and malformed legacy locks cannot be stolen',async()=>{
 const s=await setup();try{await s.store.ready();const path=join(s.store.root,'.worker.lock');
 for(const content of [String(process.pid).repeat(2),'not-a-pid','']){await writeFile(path,content);await assert.rejects(()=>s.store.lock('worker',async()=>assert.fail('live or unreadable lock stolen')),JobBusyError);assert.equal(await readFile(path,'utf8'),content);}
 }finally{await rm(s.dir,{recursive:true,force:true});}
});

test('renewal prompt requires exactly one next action and supports an honest unknown entry',()=>{
 const input=prepareJobSection(queueInput(),'renewal'),request=buildSectionRequest(input,'renewal');
 assert.match(request.systemInstruction,/exactly one nextActions object/);assert.match(request.systemInstruction,/never nextActions:\[\]/);assert.doesNotMatch(request.systemInstruction,/At most one nextActions item/);
 const draft=JSON.parse(sectionReply(request).text);
 draft.section.nextActions=[{text:'A provider-specific next action could not be established from the selected documentation excerpts.',evidence:{status:'unknown',evidenceIds:[],qualification:'Confirm the missing next action with the provider documentation before implementation.'}}];
 const validated=validateJobSection(draft,input,'renewal');assert.equal(validated.nextActions?.length,1);assert.equal(validated.nextActions[0].evidence.status,'unknown');assert.deepEqual(validated.nextActions[0].evidence.sourceIds,[]);assert.equal(validated.nextActions[0].evidence.quotations,undefined);
 draft.section.nextActions[0].evidence.evidenceIds=[input.evidenceRegistry[0].id];assert.throws(()=>validateJobSection(draft,input,'renewal'),e=>!!e&&typeof e==='object'&&'code'in e&&e.code==='evidence-unknown-has-citations');
});

test('empty required section arrays remain rejected with precise safe diagnostic paths',async()=>{
 const {validationDiagnostic,sanitizeValidationDiagnostic}=await import('../lib/generation/diagnostics');
 const input=prepareJobSection(queueInput(),'renewal'),request=buildSectionRequest(input,'renewal');
 for(const field of ['steps','nextActions']){
  const draft=JSON.parse(sectionReply(request).text);draft.section[field]=[];
  let caught:unknown;try{validateJobSection(draft,input,'renewal');}catch(e){caught=e;}
  assert.ok(caught);const diagnostic=validationDiagnostic(caught,input,{guide:draft.section});assert.equal(diagnostic.code,'schema-nonempty-array-required');assert.equal(diagnostic.fieldPath,'section.'+field);
 }
 assert.equal(sanitizeValidationDiagnostic({fieldPath:'section.PRIVATE_VALUE'}).fieldPath,undefined);
 assert.equal(sanitizeValidationDiagnostic({fieldPath:'section.nextActions[0].evidence'}).fieldPath,'section.nextActions[0].evidence');
});

test('foundation scope gaps use the exact unknown representation and reject named unknowns',()=>{
 const input=prepareJobSection(queueInput(),'foundation'),request=buildSectionRequest(input,'foundation');
 assert.match(request.systemInstruction,/"name":"Not established"/);
 assert.match(request.systemInstruction,/"status":"unknown","evidenceIds":\[\]/);
 const draft=JSON.parse(sectionReply(request).text);
 draft.section.scopes=[{name:'Not established',purpose:'Scope requirements could not be established.',evidence:{status:'unknown',evidenceIds:[],qualification:'Confirm requirements with the provider.'}}];
 const content=validateJobSection(draft,input,'foundation');
 assert.equal(content.scopes?.[0].evidence.status,'unknown');assert.deepEqual(content.scopes?.[0].evidence.sourceIds,[]);
 for(const name of ['Unknown','Not specified','admin.write']){draft.section.scopes[0].name=name;assert.throws(()=>validateJobSection(draft,input,'foundation'),{code:'guide-scope-unknown-name-required'});assert.equal(draft.section.scopes[0].name,name);}
 draft.section.scopes[0].name='Not established';draft.section.scopes[0].evidence.evidenceIds=[input.evidenceRegistry[0].id];
 assert.throws(()=>validateJobSection(draft,input,'foundation'));
});

test('queued checkpoints record selected adapter model and retain strict returned-model check',async()=>{
 const s=await setup();try{
 const job=await s.store.create({provider:'Example'});await runOneJobStep(s.deps);
 s.deps.transport=()=>Object.assign(async(request:Parameters<ReturnType<WorkerDependencies['transport']>>[0])=>({...sectionReply(request),returnedModel:'example-model'}),{model:'example-model',provider:'example'});
 await runOneJobStep(s.deps);const updated=await s.store.get(job.id);
 assert.equal(updated?.status,'queued');assert.equal(updated.sections[0].model,'example-model');
 s.deps.transport=()=>Object.assign(async(request:Parameters<ReturnType<WorkerDependencies['transport']>>[0])=>({...sectionReply(request),returnedModel:'wrong-model'}),{model:'example-model'});
 await runOneJobStep(s.deps);const failed=await s.store.get(job.id);assert.equal(failed?.status,'failed');assert.equal(failed.error?.provider?.category,'unexpected-model');assert.equal(failed.sections.length,1);
 }finally{await rm(s.dir,{recursive:true,force:true});}
});
