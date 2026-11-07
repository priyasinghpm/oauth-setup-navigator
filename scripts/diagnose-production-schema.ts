// Explicit one-shot diagnostic. No research, guide validation/storage or UI imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {GoogleGenAI} from '@google/genai';
import {generationSchema} from '../lib/generation/schema';
import {GENERATION_MODEL,GENERATION_LIMITS} from '../lib/generation/types';
import {observeProviderCall,type ProviderCallLog} from '../lib/generation/provider-call';
import {checkResponseSchema} from './helpers/check-response-schema';
async function main(){
 if(!process.argv.includes('--live')||!process.argv.includes('--free-tier-confirmed')){console.log('No request made. Requires --live --free-tier-confirmed.');return;}
 const apiKey=parseEnv(readFileSync('.env.local','utf8')).GEMINI_API_KEY;if(!apiKey?.trim())throw new Error();
 const schema=generationSchema(),requestId=randomUUID(),events:ProviderCallLog[]=[];
 let networkRequests=0;
 const guardedFetch:typeof fetch=async(url,init)=>{
  const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url);
  if(networkRequests>=1||target.origin!=='https://generativelanguage.googleapis.com'||!target.pathname.endsWith(':generateContent'))throw new Error('Diagnostic request guard');
  networkRequests++;return globalThis.fetch(url,init);
 };
 const ai=new GoogleGenAI({apiKey,vertexai:false,httpOptions:{timeout:GENERATION_LIMITS.timeoutMs,retryOptions:{attempts:1}}});
 const base={requestId,model:GENERATION_MODEL,sdkVersion:'2.32.0',apiVersion:'v1beta',schemaBytes:Buffer.byteLength(JSON.stringify(schema)),schemaSha256:createHash('sha256').update(JSON.stringify(schema)).digest('hex')};
 const report=(v:Record<string,unknown>)=>{
  const safe={...base,generationNetworkRequests:networkRequests,diagnostics:events,...v};
  const i=process.argv.indexOf('--output');if(i>=0&&process.argv[i+1])writeFileSync(process.argv[i+1],JSON.stringify(safe,null,2)+'\n');
  console.log(JSON.stringify(safe,null,2));
 };
 try{
  const response=await observeProviderCall((signal,fetcher)=>ai.models.generateContent({model:GENERATION_MODEL,
   contents:'This is a synthetic schema diagnostic, not a real OAuth guide. Return one object conforming to the supplied schema. Use name Example, slug example, lastResearchedAt 2026-11-06, not-tested status, short synthetic text, four unknown setup steps with expected outcomes, and nonempty other sections. Use estimated difficulty and effort with assumptions; every unsupported requirement is unknown with evidenceIds [] and a qualification. Invent no real provider facts, commands, endpoints or scopes. No source registry.',
   config:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:GENERATION_LIMITS.maxOutputTokens,automaticContinuation:false,abortSignal:signal,httpOptions:{fetch:fetcher}},
  }),GENERATION_LIMITS.timeoutMs,{requestId,log:e=>events.push(e)},{fetcher:guardedFetch});
  let jsonValid=false,errors:string[]=[];
  try{const value:unknown=JSON.parse(response.text??'');jsonValid=true;errors=checkResponseSchema(value,schema);}catch{errors=['$:invalid-json-or-schema-check'];}
  const finishReason=response.candidates?.[0]?.finishReason;
  report({responseReceived:true,jsonValid,schemaConforms:jsonValid&&!errors.length,schemaErrors:errors.slice(0,12),finishReason,outputTruncated:finishReason==='MAX_TOKENS',usage:response.usageMetadata?{promptTokenCount:response.usageMetadata.promptTokenCount,candidatesTokenCount:response.usageMetadata.candidatesTokenCount,thoughtsTokenCount:response.usageMetadata.thoughtsTokenCount,totalTokenCount:response.usageMetadata.totalTokenCount}:null});
 }catch{
  report({responseReceived:false,jsonValid:false,schemaConforms:null,finishReason:null,outputTruncated:null,usage:null});
 }
}
main().catch(()=>{console.error('Schema diagnostic stopped before completion. No raw exception or credentials displayed.');process.exitCode=1;});
