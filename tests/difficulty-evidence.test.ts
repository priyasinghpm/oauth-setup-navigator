// No network or credentials: synthetic research and mocked model responses.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {generateWithTransport} from '../lib/generation/generate';
import {extractEvidence} from '../lib/research/evidence';
import {input,fixture,doc} from './helpers/generation';
function multiInput(count=2){
 const i=input();for(let n=1;n<count;n++){
  const url=`https://docs.example.com/oauth-${n}`;
  i.research.pages.push({...i.research.pages[0],url,requestedUrl:url,text:doc+` Additional official document ${n}.`});
  i.research.requests.push({url,kind:'page',status:200});
 }
 return i;
}
test('compact prompt IDs match the retained registry and no schema selector repeats their enum',()=>{
 const p=prepareGeneration(multiInput()),request=buildGenerationRequest(p);
 const payload=JSON.parse(request.contents);
 assert.deepEqual(payload.untrustedDocuments.flatMap((s:{excerpts:{id:string}[]})=>s.excerpts.map(e=>e.id)),p.evidenceRegistry.map(r=>r.id));
 let selectors=0;
 function visit(value:unknown){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(key==='evidenceIds'){assert.deepEqual(child,{type:'array',items:{type:'string'}});selectors++;}visit(child);}}
 visit(request.jsonSchema);assert.equal(selectors,12);
 assert.match(request.systemInstruction,/Difficulty and setupEstimate must have evidence.status estimated/);
 assert.match(request.systemInstruction,/evidenceIds may be \[\]/);
});
test('valid difficulty references use the same registry as steps and preserve editorial status and exact step quotations',async()=>{
 const i=multiInput(),p=prepareGeneration(i),f=fixture(p);
 const chosen=p.sources[1].excerpts[0];f.guide.difficulty.evidence.evidenceIds=[p.evidenceRegistry.find(r=>r.evidenceId===chosen.id)!.id];
 let calls=0;const result=await generateWithTransport(i,async()=>{calls++;return {text:JSON.stringify(f)};});
 assert.ok(result.ok);assert.equal(calls,1);assert.equal(result.realRequestCount,0);
 assert.equal(result.guide.difficulty.evidence.status,'estimated');assert.deepEqual(result.guide.difficulty.evidence.sourceIds,[p.sources[1].id]);
 // Editorial ratings are not represented as official quotations.
 assert.equal(result.guide.difficulty.evidence.quotations,undefined);
 assert.deepEqual(result.guide.steps[0].evidence.sourceIds,[p.sources[0].id]);assert.equal(result.guide.steps[0].evidence.quotations![0].quote,p.sources[0].excerpts[0].quote);
 assert.equal(result.guide.oauthTestStatus,'not-tested');assert.equal(result.guide.approvalSummary.evidence.status,'unknown');
 assert.deepEqual(f.guide.difficulty.evidence.evidenceIds,[p.evidenceRegistry.find(r=>r.evidenceId===chosen.id)!.id]);
});
test('invalid difficulty IDs fail closed without schema enums',async()=>{
 const i=input(),p=prepareGeneration(i);
 for(const id of ['evidence-'+'a'.repeat(24),p.sources[0].id,p.sources[0].excerpts[0].id+' ','fabricated-difficulty-reference']){
  const f=fixture(p);f.guide.difficulty.evidence.evidenceIds=[id];let calls=0;
  const result=await generateWithTransport(i,async()=>{calls++;return {text:JSON.stringify(f)};});
  assert.ok(!result.ok);assert.equal(result.error,'invalid-guide');assert.equal(result.diagnostic?.stage,'evidence-resolution');assert.equal(result.diagnostic?.code,'evidence-id-unknown');assert.equal(result.diagnostic?.fieldPath,'difficulty');assert.equal(calls,1);assert.equal(result.realRequestCount,0);
  assert.deepEqual(f.guide.difficulty.evidence.evidenceIds,[id]); // Never clear/replace an invalid selection.
 }
});
test('an evidence ID from a real but unsent source is neither offered nor accepted for difficulty',async()=>{
 const i=multiInput(6),p=prepareGeneration(i);assert.equal(p.sources.length,5);
 const unsent=i.research.pages.find(page=>!p.sources.some(s=>s.url===page.url))!;
 const id=extractEvidence(unsent.text,unsent.url,unsent.title)[0].id;
 const payload=JSON.parse(buildGenerationRequest(p).contents);
 assert.ok(!payload.untrustedDocuments.some((s:{excerpts:{id:string}[]})=>s.excerpts.some(e=>e.id===id)));
 assert.ok(!JSON.stringify(buildGenerationRequest(p).jsonSchema).includes(id));
 const f=fixture(p);f.guide.difficulty.evidence.evidenceIds=[id];
 const result=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!result.ok);assert.equal(result.diagnostic?.code,'evidence-id-unknown');assert.equal(result.diagnostic?.fieldPath,'difficulty');
});
test('difficulty may remain an uncited editorial assessment, but cannot become documented or ignore invalid estimate IDs',async()=>{
 const i=input(),p=prepareGeneration(i),f=fixture(p);
 const valid=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(valid.ok);assert.deepEqual(valid.guide.difficulty.evidence.sourceIds,[]);
 const documented=fixture(p);documented.guide.difficulty.evidence.status='documented';documented.guide.difficulty.evidence.evidenceIds=[p.evidenceRegistry[0].id];
 const badRating=await generateWithTransport(i,async()=>({text:JSON.stringify(documented)}));assert.ok(!badRating.ok);assert.equal(badRating.diagnostic?.code,'schema-difficulty-editorial');
 const estimate=fixture(p);estimate.guide.setupEstimate.evidence.evidenceIds=['evidence-'+'b'.repeat(24)];
 const badEstimate=await generateWithTransport(i,async()=>({text:JSON.stringify(estimate)}));assert.ok(!badEstimate.ok);assert.equal(badEstimate.diagnostic?.code,'evidence-id-unknown');assert.equal(badEstimate.diagnostic?.fieldPath,'setupEstimate');
});
