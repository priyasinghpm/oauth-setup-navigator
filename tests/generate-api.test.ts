import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {input,fixture} from './helpers/generation';
import type {GenerateDependencies} from '../lib/api/generate-guide';
import type {GenerationResult} from '../lib/generation/types';
function request(body:unknown={provider:'Example',website:'https://docs.example.com'},headers:Record<string,string>={}){return new Request('http://localhost:3000/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
function harness(overrides:Partial<GenerateDependencies>={}){
  let researchCalls=0,modelCalls=0;
  const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>{researchCalls++;return input().research;},generate:i=>generateWithTransport(i,async()=>{modelCalls++;return {text:JSON.stringify(fixture(prepareGeneration(i))),finishReason:'STOP'};}),...overrides});
  return {handler,counts:()=>({researchCalls,modelCalls})};
}
test('API runs real preparation, resolver and validator with mocked research and Gemini; returns an unreviewed not-tested draft',async()=>{
  const h=harness();const r=await h.handler(request());const b=await r.json();
  assert.equal(r.status,200);assert.match(b.requestId,/^[a-f0-9-]{36}$/);assert.equal(r.headers.get('x-request-id'),b.requestId);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(b.status,'generated-draft');assert.equal(b.reviewStatus,'not-human-reviewed');assert.equal(b.oauthTestLabel,'Not end-to-end tested');assert.equal(b.guide.oauthTestStatus,'not-tested');assert.equal(b.lastResearchedAt,'2026-11-03');
  assert.ok(b.sources.length);assert.ok(b.evidence.length);assert.ok(b.guide.steps[0].evidence.quotations[0].quote);assert.equal(b.guide.approvalSummary.evidence.status,'unknown');assert.deepEqual(h.counts(),{researchCalls:1,modelCalls:1});
  assert.doesNotMatch(JSON.stringify(b),/sanitizedProviderError|GEMINI_API_KEY|apiKey/);
});
test('provider-only and website-only input work; website-only identity uses domain rather than invented brand',async()=>{
  for(const body of [{provider:'Example'},{website:'docs.example.com'}]){
    let seen='';const h=harness({generate:i=>{seen=i.provider;return generateWithTransport(i,async()=>({text:JSON.stringify(fixture(prepareGeneration(i)))}));}});
    assert.equal((await h.handler(request(body))).status,200);assert.equal(seen,'provider' in body?'Example':'example.com');
  }
});
test('invalid fields, unsafe URLs, empty input, malformed JSON and oversized streaming bodies cause zero work',async()=>{
  for(const body of [{},{provider:''},{provider:1},{website:'http://localhost'},{website:'https://127.0.0.1'},{website:'https://user:secret@example.com'},{website:'https://example.com/?key=secret'},{provider:'Example',seedUrls:[]},{provider:'a'.repeat(101)},['Example']]){
    const h=harness();assert.equal((await h.handler(request(body))).status,400);assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});
  }
  const h=harness();const malformed=new Request('http://localhost:3000/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
  assert.equal((await h.handler(malformed)).status,400);
  assert.equal((await h.handler(request({provider:'a'.repeat(2100)}))).status,413);
  assert.equal((await h.handler(request({}, {'content-type':'text/plain'}))).status,415);
  assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});
});
test('disabled, unconfigured and cross-origin requests never retrieve docs or call Gemini',async()=>{
  for(const overrides of [{enabled:()=>false},{configured:()=>false}]){const h=harness(overrides);assert.equal((await h.handler(request())).status,503);assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});}
  for(const headers of Array<Record<string,string>>({origin:'https://attacker.example'},{'sec-fetch-site':'cross-site'})){const h=harness();assert.equal((await h.handler(request(undefined,headers))).status,403);assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});}
});
test('unknown domains, unavailable pages, retrieval timeouts and non-OAuth research skip Gemini',async()=>{
  for(const [status,code,modify] of [
    [422,'official-website-required',()=>({...input().research,status:'website-required' as const,pages:[]})],
    [424,'documentation-unavailable',()=>({...input().research,pages:[]})],
    [504,'research-timeout',()=>({...input().research,pages:[],failures:[{url:'https://docs.example.com',reason:'Request timed out'}]})],
    [424,'insufficient-documentation',()=>({...input().research,pages:input().research.pages.map(p=>({...p,text:'Unrelated public page about gardening.'}))})],
  ] as const){const h=harness({research:async()=>modify()});const r=await h.handler(request());assert.equal(r.status,status);assert.equal((await r.json()).error.code,code);assert.equal(h.counts().modelCalls,0);}
});
test('real validator rejects fabricated evidence and empty approval; no partial guide escapes',async()=>{
  for(const mutation of ['evidence','approval']){
    let calls=0;const h=harness({generate:i=>generateWithTransport(i,async()=>{calls++;const draft=fixture(prepareGeneration(i));if(mutation==='evidence')draft.guide.steps[0].evidence.evidenceIds=['invented-evidence'];else draft.guide.approval=[];return {text:JSON.stringify(draft)};})});
    const r=await h.handler(request());const body=await r.json();assert.equal(r.status,502);assert.equal(body.error.code,'guide-validation-failed');assert.equal(body.guide,undefined);assert.doesNotMatch(JSON.stringify(body),/invented-evidence|Invalid guide data|unknown source/);assert.equal(calls,1);
  }
});
test('quota, timeout, bad JSON and provider errors have safe structured responses without retries',async()=>{
  for(const [error,status,code] of [['rate-limited',429,'gemini-quota'],['timeout',504,'generation-timeout'],['invalid-json',502,'invalid-output'],['provider-error',502,'generation-failed'],['missing-key',503,'generation-unavailable']] as const){
    let calls=0;const h=harness({generate:async()=>{calls++;return {ok:false,error,message:'secret-internal-key',sanitizedProviderError:'private diagnostic',realRequestCount:1,jsonValid:false,schemaValid:false} as GenerationResult;}});
    const r=await h.handler(request());const b=await r.json();assert.equal(r.status,status);assert.equal(b.error.code,code);assert.doesNotMatch(JSON.stringify(b),/secret-internal-key|private diagnostic/);assert.equal(calls,1);
  }
  const h=harness({research:async()=>{throw new Error('internal path and secret');}});const r=await h.handler(request());assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/internal path|secret/);
});
test('shared cooldown and hourly budget bound calls and release concurrency lock',async()=>{
  let time=0;const h=harness({now:()=>time});assert.equal((await h.handler(request())).status,200);
  const limited=await h.handler(request());assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
  for(let i=1;i<5;i++){time=i*60000;assert.equal((await h.handler(request())).status,200);}
  time=300000;assert.equal((await h.handler(request())).status,429);assert.equal(h.counts().modelCalls,5);
  time=3600000;assert.equal((await h.handler(request())).status,200);
});
test('concurrent requests cannot start a second research or Gemini call',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let researchCalls=0;
  const h=harness({research:async()=>{researchCalls++;await gate;return input().research;}});
  const first=h.handler(request());await new Promise(resolve=>setTimeout(resolve,10));
  const busy=await h.handler(request());assert.equal(busy.status,429);assert.equal((await busy.json()).error.code,'busy');assert.equal(researchCalls,1);release();assert.equal((await first).status,200);
});
test('incoming Host handles both local addresses despite Next.js canonicalizing request.url; generation stays disabled',async()=>{
  for(const [url,host,origin] of [
    ['http://localhost:3001','localhost:3001','http://localhost:3001'],
    ['http://localhost:3001','127.0.0.1:3001','http://127.0.0.1:3001'],
    ['http://127.0.0.1:3001','127.0.0.1:3001','http://127.0.0.1:3001'],
    ['http://127.0.0.1:3001','localhost:3001','http://localhost:3001'],
    ['https://navigator.example','navigator.example','https://navigator.example'],
  ]){
    const h=harness({enabled:()=>false});const r=await h.handler(new Request(`${url}/api/guides/generate`,{method:'POST',headers:{host,origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'HubSpot'})}));
    assert.equal(r.status,503);assert.equal((await r.json()).error.code,'generation-disabled');assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});
  }
});
test('foreign, deceptive, malformed and wrong-port origins are rejected before any work',async()=>{
  for(const origin of ['https://attacker.example','http://localhost:3002','https://127.0.0.1:3001','http://localhost:3001','http://127.0.0.1.attacker.example:3001','http://localhost.attacker.example:3001','http://127.0.0.1:3001@attacker.example','http://user@127.0.0.1:3001','http://127.0.0.1:3001/path','http://127.0.0.1:3001/','http://127.0.0.1:3001?x=1','http://127.0.0.1:3001#x','http://127.0.0.1:3001 http://attacker.example','null','not-an-origin','']){
    const h=harness();const r=await h.handler(new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{host:'127.0.0.1:3001',origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'HubSpot'})}));
    assert.equal(r.status,403,origin);assert.equal((await r.json()).error.code,'cross-origin');assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});
  }
});
test('Host poisoning and spoofed forwarding headers cannot authorize a foreign origin',async()=>{
  for(const headers of Array<Record<string,string>>(
    {host:'attacker.example',origin:'http://attacker.example'},
    {host:'localhost.attacker.example:3001',origin:'http://localhost.attacker.example:3001'},
    {host:'127.0.0.1:3002',origin:'http://127.0.0.1:3002'},
    {host:'localhost:3001@attacker.example',origin:'http://attacker.example'},
    {host:'127.0.0.1:3001/path',origin:'http://127.0.0.1:3001'},
    {host:'127.0.0.1:3001,attacker.example',origin:'http://127.0.0.1:3001'},
    {host:'127.0.0.1:3001',origin:'http://attacker.example','x-forwarded-host':'attacker.example'},
    {host:'127.0.0.1:3001',origin:'https://127.0.0.1:3001','x-forwarded-proto':'https'},
    {host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001','sec-fetch-site':'cross-site'},
  )){
    const h=harness();const r=await h.handler(new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({provider:'HubSpot'})}));
    assert.equal(r.status,403);assert.equal((await r.json()).error.code,'cross-origin');assert.deepEqual(h.counts(),{researchCalls:0,modelCalls:0});
  }
});
