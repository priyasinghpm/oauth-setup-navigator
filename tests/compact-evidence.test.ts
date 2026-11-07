// Offline request-registry regressions. No Gemini/network calls or persisted guide.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {validateGeneratedGuide} from '../lib/generation/validate';
import {generateWithTransport} from '../lib/generation/generate';
import {input,fixture,doc} from './helpers/generation';
function prepared(){
 const i=input(),url='https://docs.example.com/second';i.research.pages.push({...i.research.pages[0],url,requestedUrl:url,text:doc+' Second document.'});i.research.requests.push({url,kind:'page',status:200});return prepareGeneration(i);
}
test('compact references retain canonical IDs, exact text and source mappings independently of source ordering',()=>{
 const p=prepared(),f=fixture(p),first=p.sources[0].excerpts[0];
 assert.deepEqual(p.evidenceRegistry.map(r=>r.id),['e1','e2']);assert.ok(Object.isFrozen(p.evidenceRegistry));assert.ok(Object.isFrozen(p.evidenceRegistry[0]));
 const payload=JSON.parse(buildGenerationRequest(p).contents);
 assert.equal(payload.untrustedDocuments[0].excerpts[0].id,'e1');assert.equal(payload.untrustedDocuments[0].excerpts[0].quote,first.quote);assert.ok(!JSON.stringify(payload).includes(first.id));
 p.sources.reverse();const {guide}=validateGeneratedGuide(f,p);const q=guide.steps[0].evidence.quotations![0];
 assert.equal(q.evidenceId,first.id);assert.equal(q.quote,first.quote);assert.equal(q.sourceId,first.sourceId);assert.equal(q.sourceUrl,first.sourceUrl);assert.equal(q.contextBefore,first.contextBefore);assert.equal(q.contextAfter,first.contextAfter);assert.equal(guide.oauthTestStatus,'not-tested');
});
test('unknown, mistyped, canonical and namespace-confused selectors are rejected without normalization or fallback',async()=>{
 for(const field of ['difficulty','steps'] as const)for(const id of ['e0','e01','E1',' e1','e1 ','e999','evidence-'+'a'.repeat(24)]){
  const i=input(),p=prepareGeneration(i),f=fixture(p),target=field==='difficulty'?f.guide.difficulty:f.guide.steps[0];target.evidence.evidenceIds=[id];let calls=0;
  const result=await generateWithTransport(i,async()=>{calls++;return {text:JSON.stringify(f)};});assert.ok(!result.ok);assert.equal(result.error,'invalid-guide');assert.equal(result.diagnostic?.code,'evidence-id-unknown');assert.equal(calls,1);assert.deepEqual(target.evidence.evidenceIds,[id]);
 }
 const p=prepared(),f=fixture(p);f.guide.steps[0].evidence.evidenceIds=[p.sources[0].excerpts[0].id];assert.throws(()=>validateGeneratedGuide(f,p),/Unknown or unsent evidence ID/);
});
test('incomplete, duplicate or mismatched compact registry records fail closed',()=>{
 for(const mutate of [
  (p:ReturnType<typeof prepared>)=>{p.evidenceRegistry=p.evidenceRegistry.slice(0,1);},
  (p:ReturnType<typeof prepared>)=>{p.evidenceRegistry=p.evidenceRegistry.map((r,i)=>i?{...r,id:'e1'}:r);},
  (p:ReturnType<typeof prepared>)=>{p.evidenceRegistry=p.evidenceRegistry.map((r,i)=>i?{...r,sourceId:p.sources[0].id}:r);},
  (p:ReturnType<typeof prepared>)=>{p.evidenceRegistry=p.evidenceRegistry.map((r,i)=>i?{...r,evidenceId:p.evidenceRegistry[0].evidenceId}:r);},
 ]){
  const p=prepared(),f=fixture(p);mutate(p);assert.throws(()=>validateGeneratedGuide(f,p),(e:unknown)=>e instanceof Error&&'code' in e&&e.code==='evidence-reference-registry');
 }
});
test('schema stays small and catalog-independent with no repeated evidence enums or counted arrays',()=>{
 const one=prepareGeneration(input()),two=prepared();const a=buildGenerationRequest(one),b=buildGenerationRequest(two);
 assert.deepEqual(a.jsonSchema,b.jsonSchema);assert.ok(Buffer.byteLength(JSON.stringify(a.jsonSchema))<7000);
 function visit(v:unknown){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(k==='evidenceIds')assert.deepEqual(x,{type:'array',items:{type:'string'}});assert.ok(k!=='minItems'&&k!=='maxItems');visit(x);}}
 visit(a.jsonSchema);
});
