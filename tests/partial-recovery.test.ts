import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {generateWithTransport} from '../lib/generation/generate';
import {recoverSections,signRecovery,openRecovery,recoveryView,continueRecovery,buildRecoveryRequest} from '../lib/generation/recovery';
import {parseRecoveryView} from '../lib/recovery-client';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {GENERATION_MODEL,type ModelTransport} from '../lib/generation/types';
const secret='OFFLINE_ONLY_RECOVERY_SIGNING_SECRET_12345';
function setup(){const i=input(),p=prepareGeneration(i),draft=fixture(p);return {i,p,draft};}
function withInvalidScope(){const s=setup();s.draft.guide.scopes[0]={...s.draft.guide.scopes[0],name:'Wrong unknown name',evidence:{status:'unknown',evidenceIds:[],qualification:'Not established from excerpts.'}};return s;}
test('one invalid scope preserves seven validated groups, exact quotations and uncertainty without repairing failed content',async()=>{
 const {i,p,draft}=withInvalidScope();const result=await generateWithTransport(i,async()=>({text:JSON.stringify(draft)}));assert.ok(!result.ok&&result.partial);assert.equal(result.error,'invalid-guide');
 const state=result.partial,view=recoveryView(state,signRecovery(state,secret));assert.equal(view.sections.length,7);assert.deepEqual(view.pending,['scopes']);assert.ok(!JSON.stringify(state.chunks).includes('Wrong unknown name'));assert.ok(view.sections.some(s=>s.content.steps?.[0].evidence.quotations?.[0].quote===p.sources[0].excerpts[0].quote));assert.deepEqual(parseRecoveryView(view),view);assert.equal(view.oauthTestStatus,'not-tested');assert.equal(view.reviewStatus,'not-human-reviewed');
});
test('continuation requests only missing fields, reuses unchanged evidence, and full guide must pass original validation',async()=>{
 const {p,draft}=withInvalidScope(),state=recoverSections(draft,p,GENERATION_MODEL)!;const request=buildRecoveryRequest(state);const schema=JSON.stringify(request.jsonSchema);assert.ok(schema.includes('scopes'));assert.ok(!schema.includes('prerequisites'));assert.equal(request.contents,JSON.stringify(JSON.parse(request.contents)));
 let calls=0;const known=setup().draft;const transport:ModelTransport=async()=>{calls++;return {text:JSON.stringify({guide:{scopes:known.guide.scopes}}),finishReason:'STOP'};};
 const result=await continueRecovery(state,transport);assert.ok(result.ok);assert.equal(calls,1);assert.equal(result.guide.oauthTestStatus,'not-tested');assert.equal(result.guide.scopes[0].name,'read');assert.deepEqual(state.chunks.scopes,undefined);
});
test('invalid evidence and unsupported scope literals are never accepted during continuation',async()=>{
 for(const mode of ['bad-id','bad-literal']){const {p,draft}=withInvalidScope(),state=recoverSections(draft,p,GENERATION_MODEL)!;const scopes=structuredClone(setup().draft.guide.scopes);if(mode==='bad-id')scopes[0].evidence.evidenceIds=['e999'];else scopes[0].name='invented.admin';const before=JSON.stringify(state);let calls=0;
 const result=await continueRecovery(state,async()=>{calls++;return {text:JSON.stringify({guide:{scopes}})};});assert.ok(!result.ok&&result.partial);assert.equal(JSON.stringify(result.partial),before);assert.equal(calls,1);}
});
test('checkpoint tampering, expiry, changed signing secret and wrong provider cannot bypass validation',()=>{
 const {p,draft}=withInvalidScope(),state=recoverSections(draft,p,GENERATION_MODEL)!;const token=signRecovery(state,secret);assert.deepEqual(openRecovery(token,secret).chunks,state.chunks);assert.throws(()=>openRecovery(token,secret+'changed'));assert.throws(()=>openRecovery('x'+token,secret));assert.throws(()=>openRecovery(token,secret,state.expiresAt));draft.guide.name='Slack';assert.equal(recoverSections(draft,p,GENERATION_MODEL),undefined);
});
test('partial API reuses research, retains request limits and saves only after full completion',async()=>{
 const {i,draft}=withInvalidScope();let clock=Date.now(),researchCalls=0,modelCalls=0,saves=0;
 const api=createGenerateHandler({enabled:()=>true,configured:()=>true,now:()=>clock,recoverySecret:()=>secret,research:async()=>{researchCalls++;return i.research;},generate:g=>generateWithTransport(g,async()=>{modelCalls++;return {text:JSON.stringify(draft)};}),continueGenerate:s=>continueRecovery(s,async()=>{modelCalls++;return {text:JSON.stringify({guide:{scopes:setup().draft.guide.scopes}})};}),storage:{ready:async()=>{},get:async()=>null,save:async r=>{saves++;return {version:1,id:'00000000-0000-4000-8000-000000000001',createdAt:new Date().toISOString(),status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide:r.guide,warnings:r.warnings,model:r.model};}}});
 const req=(body:unknown,continuation=false)=>new Request('http://localhost:3000/api/guides/generate',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json',...(continuation?{'X-Guide-Continuation':'1'}:{})},body:JSON.stringify(body)});
 const first=await api(req({provider:'Example',website:'https://docs.example.com'}));assert.equal(first.status,202);const body=await first.json();assert.equal(body.status,'partial-draft');assert.equal(saves,0);assert.ok(!JSON.stringify(body).includes(secret));
 assert.equal((await api(req({continuation:body.partial.token},true))).status,429);assert.equal(modelCalls,1);clock+=60000;
 const done=await api(req({continuation:body.partial.token},true));assert.equal(done.status,200);assert.equal((await done.json()).status,'generated-draft');assert.deepEqual({researchCalls,modelCalls,saves},{researchCalls:1,modelCalls:2,saves:1});
 const invalid=await api(req({continuation:'forged'},true));assert.equal(invalid.status,409);assert.equal(modelCalls,2);
});

test('multiple gaps continue one section per request, keeping previously accepted sections intact',async()=>{
 const {p,draft}=withInvalidScope();draft.guide.approval=[];const state=recoverSections(draft,p,GENERATION_MODEL)!;assert.equal(recoveryView(state,signRecovery(state,secret)).pending.length,2);
 let calls=0;const full=setup().draft.guide;
 const first=await continueRecovery(state,async()=>{calls++;return {text:JSON.stringify({guide:{scopes:full.scopes}})};});assert.ok(!first.ok&&first.partial);assert.deepEqual(first.partial.chunks.steps,state.chunks.steps);assert.deepEqual(recoveryView(first.partial,signRecovery(first.partial,secret)).pending,['approval']);
 const done=await continueRecovery(first.partial,async()=>{calls++;return {text:JSON.stringify({guide:{approvalSummary:full.approvalSummary,approvalWaitingTime:full.approvalWaitingTime,approval:full.approval}})};});assert.ok(done.ok);assert.equal(calls,2);
});
test('unavailable provider, changed model and contradictory status never replace accepted progress',async()=>{
 const {p,draft}=withInvalidScope(),state=recoverSections(draft,p,GENERATION_MODEL)!;let calls=0;
 const failed=await continueRecovery(state,async()=>{calls++;throw Object.assign(new Error('OFFLINE_ONLY_FAILURE'),{status:503});});assert.ok(!failed.ok);assert.equal(failed.error,'provider-error');assert.equal(calls,1);assert.equal(state.chunks.scopes,undefined);
 const changed=Object.assign(async()=>{calls++;return {text:'{}'};},{model:'different-model'});const mismatch=await continueRecovery(state,changed);assert.ok(!mismatch.ok);assert.equal(mismatch.realRequestCount,0);assert.equal(calls,1);
 draft.guide.oauthTestStatus='tested';assert.equal(recoverSections(draft,p,GENERATION_MODEL),undefined);
});
