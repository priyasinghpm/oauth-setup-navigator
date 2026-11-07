// Offline mocked model responses. No SDK, keys, network, or automatic repair.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {generateWithTransport} from '../lib/generation/generate';
type Draft=ReturnType<typeof fixture>;
function setup(){const i=input(),p=prepareGeneration(i);return {i,p,draft:fixture(p)};}
async function check(i:ReturnType<typeof input>,draft:Draft){let calls=0;const result=await generateWithTransport(i,async()=>{calls++;return {text:JSON.stringify(draft),finishReason:'STOP'};});assert.equal(calls,1);return result;}
test('missing scope evidence uses a nonempty unknown gap with no sources or quotations',async()=>{
 const {i,draft}=setup();draft.guide.scopes=[{name:'Not established',purpose:'Scope identifiers and permission requirements could not be established from the selected excerpts.',evidence:{status:'unknown',evidenceIds:[],qualification:'Confirm scope identifiers and permissions with the provider.'}}];
 const r=await check(i,draft);assert.ok(r.ok);assert.equal(r.guide.scopes.length,1);
 assert.equal(r.guide.scopes[0].evidence.status,'unknown');assert.deepEqual(r.guide.scopes[0].evidence.sourceIds,[]);assert.equal(r.guide.scopes[0].evidence.quotations,undefined);assert.equal(r.guide.oauthTestStatus,'not-tested');
});
test('documented scopes without citations preserve the exact live failure rule',async()=>{
 const {i,draft}=setup();draft.guide.scopes[0].evidence.evidenceIds=[];
 const r=await check(i,draft);assert.ok(!r.ok);assert.equal(r.error,'invalid-guide');assert.equal(r.diagnostic?.code,'schema-documented-source-required');assert.equal(r.diagnostic?.fieldPath,'guide.scopes[0].evidence');
 assert.equal(draft.guide.scopes[0].evidence.status,'documented'); // No silent repair.
});
test('documented named scope retains exact backend evidence',async()=>{
 const {i,p,draft}=setup();const r=await check(i,draft);assert.ok(r.ok);
 assert.equal(r.guide.scopes[0].name,'read');assert.equal(r.guide.scopes[0].evidence.quotations?.[0].quote,p.sources[0].excerpts[0].quote);
});
test('fabricated or invalid scope evidence is rejected',async()=>{
 for(const mode of ['invented-scope','invalid-id','unknown-citation','empty-scopes'] as const){
  const {i,draft}=setup();
  if(mode==='invented-scope')draft.guide.scopes[0].name='admin.write';
  if(mode==='invalid-id')draft.guide.scopes[0].evidence.evidenceIds=['e999'];
  if(mode==='unknown-citation')draft.guide.scopes[0]={name:'Not established',purpose:'Unknown scope identifiers.',evidence:{status:'unknown',evidenceIds:draft.guide.scopes[0].evidence.evidenceIds,qualification:'No scope evidence.'}};
  if(mode==='empty-scopes')draft.guide.scopes=[];
  const r=await check(i,draft);assert.ok(!r.ok);assert.equal(r.error,'invalid-guide');
 }
});
test('estimates, named unknown scopes and documented placeholders cannot bypass scope evidence',async()=>{
 for(const mode of ['estimate','named-unknown','placeholder'] as const){
  const {i,draft}=setup();
  if(mode==='estimate')draft.guide.scopes[0].evidence.status='estimated';
  if(mode==='named-unknown')draft.guide.scopes[0].evidence={status:'unknown',evidenceIds:[],qualification:'No direct evidence for this name.'};
  if(mode==='placeholder')draft.guide.scopes[0].name='Not established';
  const r=await check(i,draft);assert.ok(!r.ok);assert.equal(r.diagnostic?.code,mode==='estimate'?'guide-scope-status-invalid':mode==='named-unknown'?'guide-scope-unknown-name-required':'guide-scope-placeholder-documented');
 }
});
test('prompt specifies directly supported scopes or exact unknown representation',()=>{
 const {p}=setup();const prompt=buildGenerationRequest(p).systemInstruction;
 assert.match(prompt,/never return documented with evidenceIds:\[\]/);
 assert.match(prompt,/Scope identifiers and permission requirements are facts/);
 assert.match(prompt,/"name":"Not established"/);
 assert.match(prompt,/"status":"unknown","evidenceIds":\[\]/);
});
