// Mock-only classification, privacy and unchanged-validation regressions.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GuideValidationError} from '../lib/validation-errors';
import {validationDiagnostic,validationLog,sanitizeValidationDiagnostic} from '../lib/generation/diagnostics';
import type {ValidationLog} from '../lib/generation/diagnostics';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {validateGeneratedGuide} from '../lib/generation/validate';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {input,fixture} from './helpers/generation';
const req=()=>new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'Example'})});

test('empty approval keeps nonempty validation and exposes typed schema rule and safe field path',async()=>{
 const i=input(),p=prepareGeneration(i),f=fixture(p);f.guide.approval=[];
 const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok);assert.equal(r.error,'invalid-guide');assert.equal(r.jsonValid,true);assert.match(r.message,/nonempty array/);
 assert.deepEqual({...r.diagnostic},{stage:'guide-schema',code:'schema-nonempty-array-required',fieldPath:'guide.approval',sourceCount:1,excerptCount:1,selectedEvidenceCount:6,requiredOAuthTestStatus:'not-tested',declaredOAuthTestStatus:'not-tested',reviewEvidenceMissing:true,approvalTimingMissing:true,troubleshootingEvidenceMissing:true});
});
test('unknown evidence keeps rejection and records only a canonical evidence ID and field path',async()=>{
 const i=input(),f=fixture(prepareGeneration(i));const id='evidence-'+'a'.repeat(24);f.guide.steps[0].evidence.evidenceIds=[id];
 const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok);assert.equal(r.diagnostic?.stage,'evidence-resolution');assert.equal(r.diagnostic?.code,'evidence-id-unknown');assert.equal(r.diagnostic?.fieldPath,'steps.0');assert.equal(r.diagnostic?.evidenceId,id);
 f.guide.steps[0].evidence.evidenceIds=['SECRET-arbitrary-untrusted-id'];
 const bad=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!bad.ok);assert.equal(bad.diagnostic?.evidenceId,undefined);assert.doesNotMatch(JSON.stringify(bad.diagnostic),/SECRET/);
});
test('uncertainty and collection rules have distinct typed codes without weakening checks',async()=>{
 for(const [change,code,path] of [
  [(f:ReturnType<typeof fixture>)=>{f.guide.approvalWaitingTime.text='Review takes 3 days.';},'guide-duration-invented','approvalWaitingTime'],
  [(f:ReturnType<typeof fixture>)=>{f.guide.blockers=Array.from({length:4},()=>f.guide.blockers[0]);},'guide-collection-limit','blockers'],
  [(f:ReturnType<typeof fixture>)=>{f.guide.steps=f.guide.steps.slice(0,3);},'guide-step-count','steps'],
  [(f:ReturnType<typeof fixture>)=>{f.guide.name='Different';},'guide-identity-mismatch','name'],
 ] as const){const i=input(),f=fixture(prepareGeneration(i));change(f);const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok);assert.equal(r.diagnostic?.stage,'guide-rules');assert.equal(r.diagnostic?.code,code);assert.equal(r.diagnostic?.fieldPath,path);}
});
test('research registry and exact-text failures are classified at the resolver boundary',()=>{
 const p=prepareGeneration(input()),f=fixture(p);p.sources[0].excerpts[0].quote='Tampered source quotation';
 assert.throws(()=>validateGeneratedGuide(f,p),(e:unknown)=>e instanceof GuideValidationError&&e.stage==='evidence-resolution'&&e.code==='evidence-exact-text-mismatch');
});
test('positive allowlist omits secrets, URLs, messages, stack traces, untrusted property paths and invalid IDs',()=>{
 const p=prepareGeneration(input()),f=fixture(p);
 const e=new GuideValidationError('guide-schema','schema-text-required','SECRET unrestricted error','steps.0.SECRET','Bearer SECRET');
 const d=validationDiagnostic(e,p,f);const event=validationLog('00000000-0000-4000-8000-000000000000',{...d,message:'SECRET',stack:'SECRET',apiKey:'SECRET',authorization:'Bearer SECRET',cookie:'SECRET',rawResponse:'SECRET',quote:'SECRET',url:'https://example.com?token=SECRET'});
 const serialized=JSON.stringify(event);assert.doesNotMatch(serialized,/SECRET|Bearer|apiKey|authorization|cookie|rawResponse|stack|quote|url/);assert.equal(event.fieldPath,undefined);assert.equal(event.evidenceId,undefined);
 const untyped=validationDiagnostic(new Error('SECRET'),p,f);assert.equal(untyped.stage,'guide-validation');assert.equal(untyped.code,'validation-unclassified');assert.doesNotMatch(JSON.stringify(untyped),/SECRET/);
 const malformed=sanitizeValidationDiagnostic({stage:'SECRET',code:'SECRET',sourceCount:Infinity,excerptCount:-1,selectedEvidenceCount:'SECRET',declaredOAuthTestStatus:'SECRET',fieldPath:'approval\nSECRET',evidenceId:'evidence-'+'z'.repeat(24)});assert.equal(malformed.code,'validation-unclassified');assert.equal(malformed.sourceCount,0);assert.doesNotMatch(JSON.stringify(malformed),/SECRET/);
});
test('API logs diagnostics only on server and returns a unique matching request ID with unchanged safe error',async()=>{
 const events:ValidationLog[]=[];let calls=0;
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,now:()=>calls*60000,research:async()=>input().research,generate:i=>generateWithTransport(i,async()=>{calls++;const f=fixture(prepareGeneration(i));f.guide.approval=[];return {text:JSON.stringify(f)};}),logValidationFailure:e=>events.push(e)});
 const ids=[];for(let n=0;n<2;n++){const r=await handler(req());const body=await r.json();assert.equal(r.status,502);assert.equal(body.error.code,'guide-validation-failed');assert.equal(body.error.message,'Generated guidance failed schema or evidence validation and was not returned.');assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(r.headers.get('x-request-id'),body.requestId);assert.equal(events[n].requestId,body.requestId);assert.equal(events[n].code,'schema-nonempty-array-required');assert.doesNotMatch(JSON.stringify(body),/schema-nonempty|guide-schema|sourceCount|selectedEvidenceCount|diagnostic|nonempty array/);ids.push(body.requestId);}
 assert.notEqual(ids[0],ids[1]);assert.equal(calls,2);
});
test('early rejection gets an ID without generation and logger failures do not change validation response',async()=>{
 const disabled=createGenerateHandler({enabled:()=>false,configured:()=>true,research:async()=>{throw Error('must not run');},generate:async()=>{throw Error('must not run');}});
 const r=await disabled(req()),b=await r.json();assert.equal(r.status,503);assert.equal(b.error.code,'generation-disabled');assert.equal(r.headers.get('x-request-id'),b.requestId);
 const failingLogger=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>input().research,generate:i=>generateWithTransport(i,async()=>({text:JSON.stringify({guide:{}})})),logValidationFailure:()=>{throw Error('SECRET logging error');}});
 const failure=await failingLogger(req());assert.equal(failure.status,502);assert.equal((await failure.json()).error.code,'guide-validation-failed');
});
test('default sink writes only an allowlisted event to server stderr, not console replay or frontend',async t=>{
 const writes:string[]=[];t.mock.method(process.stderr,'write',(chunk:unknown)=>{writes.push(String(chunk));return true;});t.mock.method(console,'warn',()=>assert.fail('Console replay must not receive validation logs'));
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>input().research,generate:async()=>({ok:false,error:'invalid-guide',message:'SECRET raw exception',realRequestCount:0,jsonValid:true,schemaValid:false,diagnostic:{stage:'guide-schema',code:'schema-nonempty-array-required',fieldPath:'approval',sourceCount:1,excerptCount:2,selectedEvidenceCount:4,requiredOAuthTestStatus:'not-tested',declaredOAuthTestStatus:'not-tested'}})});
 const request=req();request.headers.set('X-Request-ID','SECRET user-controlled header');request.headers.set('Authorization','Bearer SECRET');request.headers.set('Cookie','session=SECRET');
 const r=await handler(request),body=await r.json();assert.equal(r.status,502);assert.equal(writes.length,1);assert.match(writes[0],/^\[oauth-guide-validation\] /);assert.doesNotMatch(writes[0],/SECRET|exception|Bearer|Cookie/);
 const event=JSON.parse(writes[0].slice('[oauth-guide-validation] '.length));assert.equal(event.requestId,body.requestId);assert.equal(event.stage,'guide-schema');assert.equal(event.code,'schema-nonempty-array-required');assert.equal(body.error.code,'guide-validation-failed');assert.equal(body.diagnostic,undefined);
});
