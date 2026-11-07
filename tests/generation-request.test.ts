// Offline payload/validation regressions: no SDK, credentials or network.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {modelEvidence} from '../lib/generation/model-evidence';
import {requestMetrics} from '../lib/generation/request-metrics';
import {generateWithTransport} from '../lib/generation/generate';
import {extractEvidence} from '../lib/research/evidence';
import {LIFECYCLE} from '../lib/oauth-lifecycle';
import {input,fixture} from './helpers/generation';

test('shared context preserves all original qualifications, exact IDs and quotes without overlapping windows',()=>{
 const i=input(),page=i.research.pages[0];
 page.text='# App registration\nOnly for public apps; private apps differ.\n\nCreate an OAuth app and retrieve its client ID and secret.\n\n# Callbacks\nRegister the redirect URI before requesting user authorization.\n\n# Scopes\nChoose the read scope before consent.\n\n# Token exchange\nExchange the authorization code on your backend.\n\n# Renewal\nUse refresh_token for token renewal.\n\n# Distribution\nMarketplace distribution and approval need confirmation.\n\n# Troubleshooting\nCheck the registered redirect URI if an error occurs.';
 page.excerpts=extractEvidence(page.text,page.url,page.title);
 const p=prepareGeneration(i),before=JSON.stringify(p),request=buildGenerationRequest(p);
 const docs=JSON.parse(request.contents).untrustedDocuments;
 assert.equal(JSON.stringify(p),before);
 assert.equal(docs.flatMap((d:any)=>d.excerpts).length,p.evidenceRegistry.length);
 for(let n=0;n<p.sources.length;n++){
  const source=p.sources[n],document=docs[n],original=source.originalText??source.text;
  assert.equal(document.url,source.url);assert.equal(document.title,source.title);
  const coverage=new Set<number>(),expected=new Set<number>();
  for(let k=0;k<document.contextWindows.length;k++){
   const w=document.contextWindows[k];assert.equal(w.text,original.slice(w.startOffset,w.startOffset+w.text.length));
   if(k)assert.ok(document.contextWindows[k-1].startOffset+document.contextWindows[k-1].text.length<w.startOffset);
   for(let j=w.startOffset;j<w.startOffset+w.text.length;j++)coverage.add(j);
  }
  for(const e of source.excerpts){
   const ref=p.evidenceRegistry.find(r=>r.sourceId===source.id&&r.evidenceId===e.id)!;
   const shown=document.excerpts.find((x:any)=>x.id===ref.id);assert.ok(shown);assert.equal(shown.quote,e.quote);assert.equal(shown.sectionHeading,e.sectionHeading);
   assert.equal(Number.isInteger(shown.contextWindowIndex),true);
   assert.equal('contextWindowId' in shown,false);
   const w=document.contextWindows[shown.contextWindowIndex];
   assert.ok(w);assert.equal('id' in w,false);
   const start=e.startOffset-e.contextBefore.length,end=e.endOffset+e.contextAfter.length;
   assert.ok(w.startOffset<=start&&w.startOffset+w.text.length>=end);
   assert.equal(w.text.slice(start-w.startOffset,end-w.startOffset),e.contextBefore+e.quote+e.contextAfter);
   for(let j=start;j<end;j++)expected.add(j);
  }
  assert.deepEqual(coverage,expected);
  assert.ok(document.contextWindows.some((w:any)=>w.text.includes('Only for public apps; private apps differ.')));
  for(const[,pattern]of LIFECYCLE)assert.equal(document.excerpts.some((e:any)=>pattern.test(e.quote)),source.excerpts.some(e=>pattern.test(e.quote)));
  assert.ok(document.contextWindows.reduce((n:number,w:any)=>n+w.text.length,0)<source.excerpts.reduce((n,e)=>n+e.quote.length+e.contextBefore.length+e.contextAfter.length,0));
 }
});
test('context windows never bridge omitted gaps or mix sources and tampered prepared evidence is rejected',()=>{
 const i=input(),page=i.research.pages[0];page.text=page.text+'\n\n'+'Background information. '.repeat(600)+'\n\n# Renewal\nUse refresh_token to renew an access token.';
 page.excerpts=extractEvidence(page.text,page.url,page.title);
 const p=prepareGeneration(i),s=p.sources[0],wire=modelEvidence(s,p.evidenceRegistry);
 assert.ok(wire.contextWindows.length>=2);
 const altered=structuredClone(s);altered.excerpts[0].contextBefore+=' altered';
 assert.throws(()=>modelEvidence(altered,p.evidenceRegistry),/original text/);
 assert.throws(()=>modelEvidence(s,[]),/reference is missing/);
 const other=structuredClone(s);other.id='other-source';
 assert.throws(()=>modelEvidence(other,p.evidenceRegistry),/reference is missing/);
});
test('optimized prompt keeps strict literal support, uncertainty and evidence-ID-only contract',async()=>{
 const i=input(),p=prepareGeneration(i),request=buildGenerationRequest(p);
 for(const rule of [/directly supported by its selected quotations/,/Never invent commands, OAuth endpoints, scopes, configuration values/,/not select evidence merely because/,/mark unsupported lifecycle stages unknown/,/Unknown information must have evidenceIds:\[\]/,/UNTRUSTED REFERENCE DATA/,/Never return approval: \[\]/])assert.match(request.systemInstruction,rule);
 const valid=await generateWithTransport(i,async()=>({text:JSON.stringify(fixture(p))}));assert.ok(valid.ok);
 assert.equal(valid.guide.oauthTestStatus,'not-tested');
 assert.ok(valid.support.every(q=>p.evidenceRegistry.some(r=>r.evidenceId===q.evidenceId&&r.sourceId===q.sourceId)));
 for(const kind of ['command','endpoint','scope'] as const){
  const f=fixture(p);
  if(kind==='command')f.guide.steps[0].description='Run hs project open.';
  if(kind==='endpoint')f.guide.steps[0].description='Exchange a code at https://api.example.com/oauth/token.';
  if(kind==='scope')f.guide.scopes[0].name='admin.write';
  const failed=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));
  assert.ok(!failed.ok);assert.equal(failed.error,'invalid-guide');assert.equal(failed.diagnostic?.code,'guide-evidence-literal-missing',kind);
 }
 const f=fixture(p);f.guide.steps[0].evidence.evidenceIds=['w1'];
 const invalid=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!invalid.ok);assert.equal(invalid.diagnostic?.code,'evidence-id-unknown');
});
test('offline metrics contain hashes and counts without source excerpts or instructions',()=>{
 const p=prepareGeneration(input()),request=buildGenerationRequest(p),metrics=requestMetrics(request,p);
 assert.equal(metrics.schemaBytes,Buffer.byteLength(JSON.stringify(request.jsonSchema)));
 assert.ok(metrics.estimatedRestBodyBytes>metrics.contentBytes);
 const text=JSON.stringify(metrics);assert.ok(!text.includes(p.sources[0].excerpts[0].quote));assert.ok(!text.includes('UNTRUSTED REFERENCE DATA'));
 assert.deepEqual(metrics,requestMetrics(request,p));
});

test('only excerpts expose citation IDs, with source-local numeric context positions',()=>{
 const i=input();
 i.research.pages.push({...i.research.pages[0],url:'https://docs.example.com/second',requestedUrl:'https://docs.example.com/second',text:i.research.pages[0].text+' Additional OAuth documentation.'});
 i.research.requests.push({url:'https://docs.example.com/second',kind:'page',status:200});
 const prepared=prepareGeneration(i),request=buildGenerationRequest(prepared),docs=JSON.parse(request.contents).untrustedDocuments;
 const ids:string[]=[];
 for(const document of docs){
  for(const window of document.contextWindows)assert.deepEqual(Object.keys(window).sort(),['startOffset','text']);
  for(const excerpt of document.excerpts){
   assert.match(excerpt.id,/^e[1-9][0-9]*$/);ids.push(excerpt.id);
   assert.equal('contextWindowId'in excerpt,false);
   assert.ok(Number.isInteger(excerpt.contextWindowIndex));
   assert.ok(excerpt.contextWindowIndex>=0&&excerpt.contextWindowIndex<document.contextWindows.length);
  }
 }
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids.sort(),prepared.evidenceRegistry.map(r=>r.id).sort());
 assert.match(request.systemInstruction,/numeric index and context windows are NOT citations/);
 assert.doesNotMatch(request.contents,/"contextWindowId"|"id":"w[0-9]+"/);
});

test('context labels, indexes and pointers are strictly rejected rather than remapped',async()=>{
 const i=input(),p=prepareGeneration(i);
 for(const id of ['w1','w2','w3','w4','0','contextWindows[0]']){
  const draft=fixture(p);draft.guide.steps[3].evidence.evidenceIds=[id];
  const before=JSON.stringify(draft);
  const result=await generateWithTransport(i,async()=>({text:JSON.stringify(draft),finishReason:'STOP'}));
  assert.ok(!result.ok);assert.equal(result.diagnostic?.code,'evidence-id-unknown');assert.equal(result.diagnostic?.fieldPath,'steps.3');
  assert.equal(JSON.stringify(draft),before);
 }
 const draft=fixture(p);const raw=JSON.parse(JSON.stringify(draft));raw.guide.steps[3].evidence.evidenceIds=[0];
 const result=await generateWithTransport(i,async()=>({text:JSON.stringify(raw),finishReason:'STOP'}));
 assert.ok(!result.ok);assert.equal(result.diagnostic?.code,'evidence-selection-shape');
});
