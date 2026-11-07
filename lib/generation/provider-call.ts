import {randomUUID} from 'node:crypto';
import {classifyProviderError} from './provider-diagnostics';
export interface ProviderCallLog {
 event:'oauth-guide-provider-call';requestId:string;timestamp:string;geminiStartedAt:string;
 outcome:'response-received'|'failed';stage:'provider-response'|'provider-request';category:string;
 durationMs:number;configuredTimeoutMs:number;applicationSignalAborted:boolean;
 providerHttpStatus?:number;providerCode?:string;
}
export interface ProviderCallOptions {
 requestId?:string;log?:(event:ProviderCallLog)=>void;
}
// Logs only allowlisted metadata. Never inspect or persist request/response bodies.
// The original result/error, timeout settings and retry behavior are preserved.
export async function observeProviderCall<T>(
 call:(signal:AbortSignal,fetcher:typeof fetch)=>Promise<T>,timeoutMs:number,options:ProviderCallOptions={},
 dependencies:{now?:()=>number;signal?:AbortSignal;fetcher?:typeof fetch}={},
):Promise<T>{
 const now=dependencies.now??(()=>performance.now());
 const signal=dependencies.signal??AbortSignal.timeout(timeoutMs);
 const nativeFetch=dependencies.fetcher??globalThis.fetch;
 let status:number|undefined;
 const fetcher:typeof fetch=async(url,init)=>{const response=await nativeFetch(url,init);status=response.status;return response;};
 const requestId=options.requestId&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(options.requestId)?options.requestId:randomUUID();
 const geminiStartedAt=new Date().toISOString(),started=now();
 function log(failed:boolean,error?:unknown){
  const diagnostic=failed?classifyProviderError(error):undefined;
  const event:ProviderCallLog={event:'oauth-guide-provider-call',requestId,timestamp:new Date().toISOString(),geminiStartedAt,
   outcome:diagnostic?'failed':'response-received',stage:diagnostic?'provider-request':'provider-response',category:diagnostic?.category??'success',
   durationMs:Math.max(0,Math.round(now()-started)),configuredTimeoutMs:timeoutMs,applicationSignalAborted:signal.aborted,
   ...((status??diagnostic?.providerHttpStatus)!==undefined?{providerHttpStatus:status??diagnostic?.providerHttpStatus}:{}),
   ...(diagnostic?.providerCode?{providerCode:diagnostic.providerCode}:{}),
  };
  try{if(options.log)options.log(event);else process.stderr.write('[oauth-guide-generation] '+JSON.stringify(event)+'\n');}catch{/* Observability never changes the outcome or retries. */}
 }
 try{const result=await call(signal,fetcher);log(false);return result;}catch(error){log(true,error);throw error;}
}
