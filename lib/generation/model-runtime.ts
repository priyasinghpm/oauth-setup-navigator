import 'server-only';
import {readModelConfig,selectModelTransport} from './model-config';
import {geminiTransport} from './transport';
import type {ProviderCallOptions} from './provider-call';
import {GENERATION_LIMITS} from './types';
export function configuredTransport(apiKey:string,diagnostics:ProviderCallOptions={},maxOutputTokens:number=GENERATION_LIMITS.maxOutputTokens){
 return selectModelTransport(readModelConfig(),{
  gemini:config=>geminiTransport(apiKey,diagnostics,maxOutputTokens,config.model),
 });
}
