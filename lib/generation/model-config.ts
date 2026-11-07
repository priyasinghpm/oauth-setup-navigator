import {GENERATION_MODEL,type ModelTransport} from './types';
export interface ModelConfig {provider:string;model:string}
export function readModelConfig(env:Record<string,string|undefined>=process.env):ModelConfig{
 const provider=env.GUIDE_MODEL_PROVIDER?.trim()||'gemini';
 const model=env.GUIDE_MODEL?.trim()||(provider==='gemini'?GENERATION_MODEL:'');
 if(!/^[a-z][a-z0-9-]{0,39}$/.test(provider)||!model||! /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(model))throw Error('invalid-model-configuration');
 return {provider,model};
}
export type TransportAdapter=(config:ModelConfig)=>ModelTransport;
// Explicit adapters only: never silently switch provider, model, or retry.
export function selectModelTransport(config:ModelConfig,adapters:Record<string,TransportAdapter>):ModelTransport{
 const adapter=Object.hasOwn(adapters,config.provider)?adapters[config.provider]:undefined;
 if(!adapter)throw Error('model-provider-not-configured');
 const transport=adapter(config);
 return Object.assign(transport,{model:config.model,provider:config.provider});
}
