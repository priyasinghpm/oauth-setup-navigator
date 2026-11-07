import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {prepareSection,sectionRequest,validateSection} from '../scripts/helpers/staged-section';
function setup(){
 const i=input();
 i.research.pages[0].text='Exchange the authorization code using POST https://docs.example.com/token on your backend. Use grant_type=authorization_code and the registered callback. Request `read.data` scope.';
 const base=prepareGeneration(i);
 const p=prepareSection(i,base.sources.flatMap(s=>s.excerpts.map(e=>e.id)));
 const draft={section:{callbackMatching:{rule:'unknown',text:'Callback matching requirements are unknown in these excerpts.',evidence:{status:'unknown',evidenceIds:[] as string[],qualification:'Not established by selected quotations.'}},steps:[{title:'Exchange authorization code',description:'Send POST https://docs.example.com/token using `grant_type=authorization_code`.',expectedOutcome:'The token exchange request is prepared.',evidence:{status:'documented',evidenceIds:[p.evidenceRegistry[0].id],qualification:'Applies to authorization-code exchange; not executed.'}}],gaps:['authorization-request','callback','client-authentication','request-encoding','token-response','token-request'].map(topic=>({topic,text:'Requirements are not established by these instructions.',evidence:{status:'unknown',evidenceIds:[] as string[],qualification:'Not established in selected excerpts.'}}))}};
 return {i,p,draft};
}
test('section resolves exact backend quotations, metadata and uncertainty without full-guide fabrication',()=>{
 const {p,draft}=setup();const result=validateSection(draft,p);
 assert.equal(result.steps[0].evidence.quotations?.[0].quote,p.sources[0].excerpts[0].quote);
 assert.equal(result.steps[0].evidence.quotations?.[0].contextBefore,p.sources[0].excerpts[0].contextBefore);
 assert.equal(result.sources[0].url,p.sources[0].url);
 assert.equal(result.lastResearchedAt,p.researchedAt);
 assert.equal(result.oauthTestStatus,'not-tested');assert.equal(result.reviewStatus,'not-human-reviewed');
 assert.equal(result.gaps[0].evidence.status,'unknown');
 assert.ok(JSON.stringify(sectionRequest(p)).length<12000);
});
for(const [name,claim] of [
 ['unsupported command','Run `curl https://evil.example/token`.'],
 ['unsupported endpoint','Send POST https://docs.example.com/wrong.'],
 ['unsupported scope','Request `write.all` scope.'],
 ['contradictory HTTP method','Send GET https://docs.example.com/token.'],
 ['contradictory grant value','Use `grant_type=refresh_token`.'],
] as const)test(name,()=>{const {p,draft}=setup();draft.section.steps[0].description=claim;if(name==='contradictory HTTP method')assert.throws(()=>validateSection(draft,p),/section-http-method-unsupported/);else assert.throws(()=>validateSection(draft,p));});
test('reject unknown IDs, missing support, estimates and model-authored quotation metadata',()=>{
 for(const change of ['invalid','empty','estimated','quote']){
  const {p,draft}=setup();
  if(change==='invalid')draft.section.steps[0].evidence.evidenceIds=['e999'];
  if(change==='empty')draft.section.steps[0].evidence.evidenceIds=[];
  if(change==='estimated')draft.section.steps[0].evidence.status='estimated';
  if(change==='quote')Object.assign(draft.section.steps[0],{quote:'invented'});
  assert.throws(()=>validateSection(draft,p));
 }
});
test('reject tampered mapping, context, unknown canonical selection and clipped support',()=>{
 const {i,p,draft}=setup();
 assert.throws(()=>prepareSection(i,['evidence-nonexistent']));
 for(const change of ['mapping','context','clipped']){
  const bad=structuredClone(p);
  if(change==='mapping')bad.evidenceRegistry=bad.evidenceRegistry.map((r,i)=>i===0?{...r,sourceId:'wrong'}:r);
  if(change==='context')bad.sources[0].excerpts[0].contextAfter='invented';
  if(change==='clipped')bad.sources[0].excerpts[0].clipped=true;
  assert.throws(()=>validateSection(draft,bad));
 }
});
test('unknown gaps cannot attach unrelated citations and steps cannot be empty',()=>{
 const {p,draft}=setup();draft.section.gaps[0].evidence.evidenceIds=[p.evidenceRegistry[0].id];assert.throws(()=>validateSection(draft,p));
 draft.section.gaps=[];draft.section.steps=[];assert.throws(()=>validateSection(draft,p));
});

test('missing topics require explicit topic gaps, duplicates fail',()=>{
 const {p,draft}=setup();draft.section.gaps=[];
 assert.throws(()=>validateSection(draft,p),/section-coverage-missing:authorization-request/);
 const fresh=setup();fresh.draft.section.gaps[1].topic=fresh.draft.section.gaps[0].topic;
 assert.throws(()=>validateSection(fresh.draft,fresh.p),/section-gap-duplicate/);
});
test('encoding asserted only in surrounding context is rejected',()=>{
 const {p,draft}=setup();draft.section.steps[0].description+=' Use application/x-www-form-urlencoded.';
 assert.throws(()=>validateSection(draft,p),/section-direct-literal-missing/);
});
