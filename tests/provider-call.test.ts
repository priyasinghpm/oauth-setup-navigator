import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeProviderCall,type ProviderCallLog} from '../lib/generation/provider-call';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {generateWithTransport} from '../lib/generation/generate';
import {input} from './helpers/generation';
const requestId='00000000-0000-4000-8000-000000000000';
test('successful provider calls record monotonic duration and actual HTTP status without response content',async()=>{
 const logs:ProviderCallLog[]=[];const ticks=[10,35.4];let calls=0;
 const result=await observeProviderCall(async(signal,fetcher)=>{assert.equal(signal.aborted,false);const response=await fetcher('https://example.com/?key=SECRET');return response.text();},60000,{requestId,log:e=>logs.push(e)},{now:()=>ticks.shift()!,fetcher:async()=>{calls++;return new Response('SECRET provider content',{status:200});}});
 assert.equal(result,'SECRET provider content');assert.equal(calls,1);assert.equal(logs.length,1);assert.equal(logs[0].durationMs,25);assert.equal(logs[0].requestId,requestId);assert.equal(logs[0].providerHttpStatus,200);assert.equal(logs[0].configuredTimeoutMs,60000);assert.equal(logs[0].category,'success');assert.equal(logs[0].applicationSignalAborted,false);assert.doesNotMatch(JSON.stringify(logs),/SECRET|key=|prompt|headers|responseText/);
});
test('upstream 503 and application abort have distinct safe diagnostics and no retry',async()=>{
 for(const abort of [false,true]){
 const controller=new AbortController(),logs:ProviderCallLog[]=[];let calls=0;
 const error=abort?Object.assign(new Error('SECRET'),{name:'AbortError'}):Object.assign(new Error('{"error":{"status":"UNAVAILABLE","message":"SECRET"}}'),{status:503});
 await assert.rejects(()=>observeProviderCall(async()=>{calls++;if(abort)controller.abort();throw error;},60000,{requestId,log:e=>logs.push(e)},{signal:controller.signal}),e=>e===error);
 assert.equal(calls,1);assert.equal(logs.length,1);assert.equal(logs[0].applicationSignalAborted,abort);assert.equal(logs[0].category,abort?'timeout':'upstream-unavailable');assert.equal(logs[0].providerCode,abort?undefined:'UNAVAILABLE');assert.equal(logs[0].providerHttpStatus,abort?undefined:503);assert.doesNotMatch(JSON.stringify(logs),/SECRET|message|stack|prompt/);
 }
});
test('failed diagnostic sink preserves provider results/errors and never calls again',async()=>{
 let calls=0;const sink=()=>{throw Error('SECRET sink')};
 assert.equal(await observeProviderCall(async()=>{calls++;return 7;},60000,{log:sink}),7);
 const error=Error('SECRET');await assert.rejects(()=>observeProviderCall(async()=>{calls++;throw error;},60000,{log:sink}),e=>e===error);assert.equal(calls,2);
});
test('API propagates the same request ID to provider diagnostics without exposing timing to clients',async()=>{
 let providerId='';
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>input().research,generate:async(i,context)=>{providerId=context.requestId;return generateWithTransport(i,async()=>{throw Object.assign(Error('SECRET'),{status:503});});},logGenerationFailure:()=>{}});
 const response=await handler(new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'Example'})}));const body=await response.json();assert.equal(providerId,body.requestId);assert.equal(response.status,502);assert.doesNotMatch(JSON.stringify(body),/durationMs|geminiStartedAt|SECRET/);
});
