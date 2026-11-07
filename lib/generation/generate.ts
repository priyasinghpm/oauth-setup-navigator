import {lifecycleWarnings} from './evidence-quality';
import {classifyProviderError,sanitizeProviderDiagnostic} from './provider-diagnostics';
import {validationDiagnostic} from './diagnostics';
import { prepareGeneration } from './prepare';
import { buildGenerationRequest } from './prompt';
import { validateGeneratedGuide } from './validate';
import { GENERATION_LIMITS, GENERATION_MODEL } from './types';
import type { GenerationInput, GenerationResult, ModelTransport } from './types';
export async function generateWithTransport(input: GenerationInput, transport: ModelTransport, mode:'mock'|'gemini'='mock'): Promise<GenerationResult> {
  const expectedModel=transport.model??GENERATION_MODEL;
  let realRequestCount=0;let jsonValid=false;
  const fail=(error:Extract<GenerationResult,{ok:false}>['error'],message:string):Extract<GenerationResult,{ok:false}>=>({ok:false,error,message,realRequestCount,jsonValid,schemaValid:false});
  let prepared;
  try {prepared=prepareGeneration(input);} catch {return fail('invalid-input','No valid, provenance-backed OAuth research input was provided.');}
  let request;
  try{request=buildGenerationRequest(prepared);}catch{return {...fail('provider-error','Generation request preparation failed; no request was sent.'),providerDiagnostic:{stage:'request-preparation',category:'request-build'}};}
  let evidenceEnumEntries=0;
  function countEnums(v:unknown):void{if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){if(key==='evidenceIds'&&value&&typeof value==='object'&&'items' in value){const items=value.items;if(items&&typeof items==='object'&&'enum' in items&&Array.isArray(items.enum))evidenceEnumEntries+=items.enum.length;}countEnums(value);}}
  countEnums(request.jsonSchema);
  const context={sourceCount:prepared.sources.length,excerptCount:prepared.sources.reduce((n,s)=>n+s.excerpts.length,0),schemaBytes:Buffer.byteLength(JSON.stringify(request.jsonSchema)),evidenceEnumEntries};
  let reply;
  try {
    realRequestCount=mode==='gemini'?1:0;
    reply=await transport(request);
  } catch(error) {
    const status=typeof error==='object' && error!==null && 'status' in error?error.status:undefined;
    const name=error instanceof Error?error.name:'';
    const diagnostic=typeof error==='object' && error!==null && 'sanitizedProviderError' in error && typeof error.sanitizedProviderError==='string'?error.sanitizedProviderError:undefined;
    const structured=typeof error==='object'&&error!==null&&'providerDiagnostic' in error?sanitizeProviderDiagnostic(error.providerDiagnostic):classifyProviderError(error);
    const providerFailure=(kind:Extract<GenerationResult,{ok:false}>['error'],message:string):Extract<GenerationResult,{ok:false}>=>({...fail(kind,message),providerDiagnostic:{...structured,...context},...(diagnostic?{sanitizedProviderError:diagnostic}:{})});
    if(status===429)return providerFailure('rate-limited','Gemini returned HTTP 429. Free-tier quota/rate limit may be exhausted; no retry or paid fallback was attempted.');
    if(name==='TimeoutError' || name==='AbortError')return providerFailure('timeout','Generation timed out; no retry was attempted.');
    return providerFailure('provider-error',`Gemini request failed${typeof status==='number'?` (HTTP ${status})`:''}. No raw provider error or credentials are exposed.`);
  }
  if(reply.returnedModel && reply.returnedModel!==expectedModel)return {...fail('provider-error','Provider returned an unexpected model; output was not accepted.'),providerDiagnostic:{stage:'provider-response',category:'unexpected-model',...context}};
  if(reply.finishReason && reply.finishReason!=='STOP')return {...fail('provider-error','Model response was blocked or incomplete; no retry was attempted.'),providerDiagnostic:sanitizeProviderDiagnostic({stage:'provider-response',category:'incomplete-response',finishReason:reply.finishReason,...context})};
  if(!reply.text || Buffer.byteLength(reply.text)>GENERATION_LIMITS.maxOutputBytes)return {...fail('invalid-json','Response is empty or exceeds the output size limit.'),providerDiagnostic:{stage:'response-json',category:'invalid-output-size',...context}};
  let parsed:unknown;
  try {parsed=JSON.parse(reply.text);jsonValid=true;} catch {return {...fail('invalid-json','Gemini response was not valid JSON; no repair request was made.'),providerDiagnostic:{stage:'response-json',category:'invalid-json',...context}};}
  try {
    const {guide,support}=validateGeneratedGuide(parsed,prepared);
    return {ok:true,guide,support,sources:prepared.sources.map(({text,originalText,excerpts,...source})=>source),warnings:[...prepared.warnings,...lifecycleWarnings(guide,prepared),...(prepared.reviewEvidenceMissing?['Approval/review requirements were absent from the retrieved evidence and must remain unknown.']:[]),...(prepared.approvalTimingMissing?['No source-backed approval duration was established.']:[])],model:expectedModel,realRequestCount,jsonValid:true,schemaValid:true};
  }catch(error){return {...fail('invalid-guide',error instanceof Error?error.message:'Generated guide failed schema/provenance validation.'),diagnostic:validationDiagnostic(error,prepared,parsed)};}
}
