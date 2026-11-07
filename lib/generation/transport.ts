import 'server-only';
import {GoogleGenAI} from '@google/genai';
import {observeProviderCall,type ProviderCallOptions} from './provider-call';
import {classifyProviderError} from './provider-diagnostics';
import {sanitizeProviderError} from './sanitize-error';
import {GENERATION_LIMITS,GENERATION_MODEL,type ModelTransport} from './types';
export function geminiTransport(apiKey:string,diagnostics:ProviderCallOptions={},maxOutputTokens:number=GENERATION_LIMITS.maxOutputTokens,model:string=GENERATION_MODEL):ModelTransport{
 const ai=new GoogleGenAI({apiKey,vertexai:false,httpOptions:{timeout:GENERATION_LIMITS.timeoutMs,retryOptions:{attempts:1}}});
 return async request=>{
  try{
   const response=await observeProviderCall((signal,fetcher)=>ai.models.generateContent({model,contents:request.contents,config:{systemInstruction:request.systemInstruction,responseMimeType:'application/json',responseJsonSchema:request.jsonSchema,maxOutputTokens,automaticContinuation:false,abortSignal:signal,httpOptions:{fetch:fetcher}}}),GENERATION_LIMITS.timeoutMs,diagnostics);
   return {text:response.text??'',finishReason:response.candidates?.[0]?.finishReason,returnedModel:response.modelVersion};
  }catch(error){throw Object.assign(new Error('Gemini request failed'),{status:typeof error==='object'&&error!==null&&'status'in error?error.status:undefined,name:error instanceof Error?error.name:'Error',sanitizedProviderError:sanitizeProviderError(error,apiKey),providerDiagnostic:classifyProviderError(error)});}
 };
}
