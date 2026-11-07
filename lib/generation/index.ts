import {continueRecovery,type RecoveryState} from './recovery';
import 'server-only';
import {generateWithTransport} from './generate';
import {configuredTransport} from './model-runtime';
import type {ProviderCallOptions} from './provider-call';
import type {GenerationInput,GenerationResult} from './types';
export {GENERATION_MODEL,GENERATION_LIMITS} from './types';
export type {GenerationInput,GenerationResult} from './types';
let active=false;
export async function generateOAuthGuide(input:GenerationInput,apiKey=process.env.GEMINI_API_KEY,diagnostics:ProviderCallOptions={}):Promise<GenerationResult>{
 if(!apiKey)return {ok:false,error:'missing-key',message:'GEMINI_API_KEY is not set.',realRequestCount:0,jsonValid:false,schemaValid:false};
 if(active)return {ok:false,error:'rate-limited',message:'Another generation is already active in this process.',realRequestCount:0,jsonValid:false,schemaValid:false};
 active=true;
 try{return await generateWithTransport(input,configuredTransport(apiKey,diagnostics),'gemini');}finally{active=false;}
}

export async function continueOAuthGuide(state:RecoveryState,diagnostics:ProviderCallOptions={}):Promise<GenerationResult>{
 if(!process.env.GEMINI_API_KEY)return {ok:false,error:'missing-key',message:'Generation unavailable.',realRequestCount:0,jsonValid:false,schemaValid:false};
 if(active)return {ok:false,error:'rate-limited',message:'Another generation is active.',realRequestCount:0,jsonValid:false,schemaValid:false};
 active=true;try{return await continueRecovery(state,configuredTransport(process.env.GEMINI_API_KEY,diagnostics));}finally{active=false;}
}
