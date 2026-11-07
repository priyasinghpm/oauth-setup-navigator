// No Gemini/key/network calls: synthetic provider exceptions and model replies.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyProviderError,providerFailureLog,sanitizeProviderDiagnostic} from '../lib/generation/provider-diagnostics';
import type {ProviderFailureLog} from '../lib/generation/provider-diagnostics';
import {generateWithTransport} from '../lib/generation/generate';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {input} from './helpers/generation';
const request=()=>new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'Example'})});
test('provider HTTP categories are structured; HTTP 400 does not imply enum incompatibility',()=>{
 const e=Object.assign(new Error(JSON.stringify({error:{status:'INVALID_ARGUMENT',message:'SECRET raw upstream error',details:[{prompt:'SECRET'}]}})),{status:400});
 assert.deepEqual(classifyProviderError(e),{stage:'provider-request',category:'invalid-request',providerHttpStatus:400,providerCode:'INVALID_ARGUMENT'});
 for(const [status,category]of [[401,'authentication'],[403,'permission'],[404,'not-found'],[429,'rate-limit'],[503,'upstream-unavailable'],[500,'upstream-error'],[504,'timeout']] as const)assert.equal(classifyProviderError(Object.assign(new Error('SECRET'),{status})).category,category);
 assert.equal(classifyProviderError(Object.assign(new Error('SECRET'),{name:'AbortError'})).category,'timeout');
 assert.equal(classifyProviderError(new Error('SECRET local SDK error')).category,'transport-or-sdk');
});
test('provider diagnostic sanitizer excludes raw bodies, prompts, excerpts, headers, secrets and malformed metadata',()=>{
 const value={stage:'SECRET',category:'SECRET',providerHttpStatus:'400 SECRET',providerCode:'SECRET',finishReason:'SECRET',schemaBytes:Infinity,sourceCount:-1,excerptCount:'SECRET',evidenceEnumEntries:1e20,message:'SECRET',stack:'SECRET',sanitizedProviderError:'SECRET',apiKey:'SECRET',Authorization:'Bearer SECRET',cookie:'SECRET',prompt:'SECRET',rawResponse:'SECRET',quote:'SECRET'};
 const safe=sanitizeProviderDiagnostic(value);assert.deepEqual(safe,{stage:'provider-request',category:'unknown'});
 const log=providerFailureLog('SECRET','SECRET' as unknown as number,value);assert.doesNotMatch(JSON.stringify(log),/SECRET|Bearer|rawResponse|prompt|quote|stack|cookie|apiKey/);assert.equal(log.requestId,'invalid-request-id');assert.equal(log.httpStatus,502);
 const parsed=classifyProviderError(Object.assign(new Error(JSON.stringify({error:{status:'SECRET',message:'SECRET'}})),{status:400}));assert.equal(parsed.providerCode,undefined);assert.doesNotMatch(JSON.stringify(parsed),/SECRET/);
});
test('transport failures retain upstream status/context and make one mocked attempt without retry',async()=>{
 for(const [status,kind]of [[400,'provider-error'],[429,'rate-limited'],[503,'provider-error']] as const){let calls=0;
  const r=await generateWithTransport(input(),async()=>{calls++;throw Object.assign(new Error('SECRET'),{status});});
  assert.ok(!r.ok);assert.equal(r.error,kind);assert.equal(calls,1);assert.equal(r.realRequestCount,0);assert.equal(r.providerDiagnostic?.providerHttpStatus,status);assert.equal(r.providerDiagnostic?.stage,'provider-request');assert.equal(r.providerDiagnostic?.sourceCount,1);assert.equal(r.providerDiagnostic?.excerptCount,1);assert.ok(r.providerDiagnostic!.schemaBytes!>0);assert.equal(r.providerDiagnostic!.evidenceEnumEntries,0);assert.doesNotMatch(JSON.stringify(r.providerDiagnostic),/SECRET/);
 }
});
test('SDK wrapper preserves canonical provider code without logging sanitized error text',async()=>{
 const r=await generateWithTransport(input(),async()=>{throw Object.assign(new Error('Hidden'),{status:400,sanitizedProviderError:'SECRET diagnostic body',providerDiagnostic:classifyProviderError(Object.assign(new Error('{"error":{"status":"INVALID_ARGUMENT","message":"SECRET"}}'),{status:400}))});});
 assert.ok(!r.ok);assert.equal(r.providerDiagnostic?.providerCode,'INVALID_ARGUMENT');assert.equal(r.providerDiagnostic?.category,'invalid-request');assert.doesNotMatch(JSON.stringify(r.providerDiagnostic),/SECRET/);
});
test('incomplete, unexpected-model and malformed JSON replies have distinct pre-validation stages',async()=>{
 for(const [reply,stage,category]of [
  [{text:'{}',finishReason:'MAX_TOKENS'},'provider-response','incomplete-response'],
  [{text:'{}',returnedModel:'SECRET unexpected model'},'provider-response','unexpected-model'],
  [{text:'SECRET invalid JSON',finishReason:'STOP'},'response-json','invalid-json'],
  [{text:''},'response-json','invalid-output-size'],
 ] as const){let calls=0;const r=await generateWithTransport(input(),async()=>{calls++;return reply;});assert.ok(!r.ok);assert.equal(r.providerDiagnostic?.stage,stage);assert.equal(r.providerDiagnostic?.category,category);assert.equal(r.jsonValid,false);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(r.providerDiagnostic),/SECRET/);}
});
test('API logs upstream failure with request ID while frontend receives only existing safe error',async()=>{
 const logs:ProviderFailureLog[]=[];let attempts=0;
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>input().research,generate:i=>generateWithTransport(i,async()=>{attempts++;throw Object.assign(new Error('SECRET provider body'),{status:400});}),logGenerationFailure:e=>logs.push(e)});
 const response=await handler(request()),body=await response.json();assert.equal(response.status,502);assert.equal(body.error.code,'generation-failed');assert.equal(body.error.message,'The generation provider could not complete the request.');assert.equal(response.headers.get('x-request-id'),body.requestId);assert.equal(logs.length,1);assert.equal(logs[0].requestId,body.requestId);assert.equal(logs[0].httpStatus,502);assert.equal(logs[0].providerHttpStatus,400);assert.equal(logs[0].category,'invalid-request');assert.equal(logs[0].stage,'provider-request');assert.equal(attempts,1);assert.doesNotMatch(JSON.stringify(body),/SECRET|providerHttpStatus|invalid-request|providerDiagnostic|schemaBytes/);
});
test('default provider sink writes allowlisted stderr event; failed logging never retries',async t=>{
 const writes:string[]=[];t.mock.method(process.stderr,'write',(chunk:unknown)=>{writes.push(String(chunk));return true;});
 let attempts=0;const deps={enabled:()=>true,configured:()=>true,research:async()=>input().research,generate:(i:ReturnType<typeof input>)=>generateWithTransport(i,async()=>{attempts++;throw Object.assign(new Error('SECRET'),{status:403});})};
 const response=await createGenerateHandler(deps)(request());assert.equal(response.status,502);assert.equal(writes.length,1);assert.match(writes[0],/^\[oauth-guide-generation\] /);assert.doesNotMatch(writes[0],/SECRET|stack|prompt|apiKey/);
 const failure=await createGenerateHandler({...deps,logGenerationFailure:()=>{throw Error('SECRET logger');}})(request());assert.equal(failure.status,502);assert.equal(attempts,2);
});
