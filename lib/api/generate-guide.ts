import type {GuideStore} from '../storage/file-guide-store';
import {providerFailureLog,type ProviderFailureLog} from '../generation/provider-diagnostics';
import {createHash,randomUUID} from 'node:crypto';
import {validationLog,type ValidationLog} from '../generation/diagnostics';
import {bounded,domainOf,safeUrl} from '../research/network';
import {prepareGeneration} from '../generation/prepare';
import type {ResearchInput,ResearchResult} from '../research/types';
import type {GenerationInput,GenerationResult} from '../generation/types';

export interface GenerateDependencies {
  research(input:ResearchInput):Promise<ResearchResult>;
  generate(input:GenerationInput,context:{requestId:string}):Promise<GenerationResult>;
  enabled():boolean;
  configured():boolean;
  now?:()=>number;
  storage?:GuideStore;
  logGenerationFailure?:(event:ProviderFailureLog)=>void;
  logValidationFailure?:(event:ValidationLog)=>void;
}
const BODY_LIMIT=2048;
function response(status:number,body:unknown,retryAfter?:number){return Response.json(body,{status,headers:{'Cache-Control':'no-store',...(retryAfter?{'Retry-After':String(retryAfter)}:{})}});}
function failure(status:number,code:string,message:string,nextAction:string,retryAfter?:number){return response(status,{ok:false,status:'failed',error:{code,message,nextAction}},retryAfter);}
export async function readBody(request:Request):Promise<unknown>{
  if(Number(request.headers.get('content-length'))>BODY_LIMIT)throw new Error('body-too-large');
  if(!request.body)throw new Error('invalid-json');
  const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
  try {
    const text=await bounded((async()=>{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>BODY_LIMIT)throw new Error('body-too-large');chunks.push(value);}
      return Buffer.concat(chunks).toString('utf8');
    })(),5000);
    try{return JSON.parse(text);}catch{throw new Error('invalid-json');}
  }finally{void reader.cancel().catch(()=>{});}
}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function inputOf(value:unknown):ResearchInput{
  if(!isRecord(value))throw new Error();
  const obj:Record<string,unknown>=value;
  if(Object.keys(obj).some(k=>k!=='provider'&&k!=='website'))throw new Error();
  for(const v of Object.values(obj))if(typeof v!=='string'||!v.trim()||/[\u0000-\u001f\u007f]/.test(v))throw new Error();
  const provider=typeof obj.provider==='string'?obj.provider.trim():undefined;
  let website=typeof obj.website==='string'?obj.website.trim():undefined;
  if((!provider&&!website)||(provider&&provider.length>100)||(website&&website.length>1024))throw new Error();
  if(website)website=safeUrl(website.includes('://')?website:`https://${website}`).href;
  return {provider,website};
}
// Next.js may construct request.url with localhost even when the incoming Host is
// 127.0.0.1. Honor that local host alias only on the same scheme/port. Do not
// trust forwarded headers or permit arbitrary Host overrides of the URL host.
export function sameOrigin(request:Request):boolean {
  if(request.headers.get('sec-fetch-site')==='cross-site')return false;
  try {
    const target=new URL(request.url);
    if(target.protocol!=='http:'&&target.protocol!=='https:')return false;
    const host=request.headers.get('host');
    if(host!==null){
      if(!/^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::[0-9]{1,5})?$/i.test(host))return false;
      const incoming=new URL(`${target.protocol}//${host}`);
      const localAliases=new Set(['localhost','127.0.0.1']);
      const localAlias=localAliases.has(target.hostname)&&localAliases.has(incoming.hostname)&&target.port===incoming.port;
      if(incoming.host!==target.host&&!localAlias)return false;
      target.host=incoming.host;
    }
    const value=request.headers.get('origin');
    if(value===null)return true; // Preserve non-browser CLI clients.
    const origin=new URL(value);
    // Serialized HTTP origins only; reject null, credentials, paths and lists.
    return (origin.protocol==='http:'||origin.protocol==='https:')&&origin.origin===value&&origin.origin===target.origin;
  }catch{return false;}
}
// One instance per server process, not a distributed quota or public deployment auth layer.
export function createGenerateHandler(deps:GenerateDependencies){
  let active=false;let lastStarted:number|undefined;let attempts:number[]=[];
  const now=deps.now??Date.now;
  async function handle(request:Request,requestId:string):Promise<Response>{
    if(!sameOrigin(request))return failure(403,'cross-origin','Cross-origin generation requests are not allowed.','Submit from the same origin.');
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return failure(415,'unsupported-media-type','Send an application/json request.','Use Content-Type: application/json.');
    let input:ResearchInput;
    try{input=inputOf(await readBody(request));}catch(error){
      const kind=error instanceof Error?error.message:'';
      if(kind==='body-too-large')return failure(413,kind,'Request body exceeds 2048 bytes.','Send only provider and/or website.');
      if(kind==='Request timed out')return failure(408,'request-timeout','Request body was not received in time.','Submit a complete small JSON body.');
      return failure(400,'invalid-input','Provide a provider name (up to 100 characters) and/or a public HTTPS official website (up to 1024 characters).','Send only provider and/or website. URLs must not contain credentials, queries, IP addresses or custom ports.');
    }
    if(!deps.enabled())return failure(503,'generation-disabled','Live generation is disabled. No research or Gemini request was made.','For deliberate local live use, enable GUIDE_GENERATION_ENABLED after confirming billing remains disabled.');
    if(!deps.configured())return failure(503,'generation-unavailable','Server generation configuration is unavailable.','Configure the server-side Gemini key; never include credentials in the request.');
    const started=now();attempts=attempts.filter(t=>started-t<3600000);
    if(active)return failure(429,'busy','A research/generation request is already running.','Wait for it to finish; no automatic retry is performed.',60);
    const retryAfter=lastStarted===undefined?0:Math.ceil((60000-(started-lastStarted))/1000);
    if(retryAfter>0||attempts.length>=5)return failure(429,'request-limit','Local generation request limit reached.','Wait before submitting again; limits are shared across this server process.',retryAfter>0?retryAfter:Math.max(1,Math.ceil((attempts[0]+3600000-started)/1000)));
    active=true;lastStarted=started;attempts.push(started);
    try{
      if(deps.storage){try{await deps.storage.ready();}catch{return failure(503,'storage-unavailable','Persistent guide storage is unavailable. No research or Gemini request was made.','Check the persistent storage directory and deployment configuration.');}}
      const research=await deps.research(input);
      if(research.status==='website-required')return failure(422,'official-website-required','An official provider website could not be established.','Supply the official developer documentation website.');
      if(!research.pages.length){
        const timedOut=research.failures.some(f=>/timed?\s*out|time budget/i.test(f.reason));
        return failure(timedOut?504:424,timedOut?'research-timeout':'documentation-unavailable',timedOut?'Documentation retrieval timed out.':'No usable public documentation was retrieved.','Supply a more specific official OAuth documentation URL. Access restrictions are respected.');
      }
      const provider=input.provider??domainOf(safeUrl(research.website!));
      const slug=provider.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'')||`provider-${createHash('sha256').update(provider).digest('hex').slice(0,12)}`;
      const generationInput={provider,slug,research};
      // Fail before incurring a Gemini request if research lacks usable OAuth provenance.
      try{prepareGeneration(generationInput);}catch{return failure(424,'insufficient-documentation','Retrieved material lacks usable, provenance-backed OAuth evidence.','Supply a more specific official OAuth documentation URL.');}
      const result=await deps.generate(generationInput,{requestId});
      if(!result.ok){
        if(result.error==='invalid-guide'){
          const event=validationLog(requestId,result.diagnostic);
          // Logging failure must never change the safe response or trigger retries.
          try{if(deps.logValidationFailure)deps.logValidationFailure(event);else process.stderr.write('[oauth-guide-validation] '+JSON.stringify(event)+'\n');}catch{}
        }
        const errors:Record<typeof result.error,[number,string,string]>={
          'missing-key':[503,'generation-unavailable','Server generation configuration is unavailable.'],
          'rate-limited':[429,'gemini-quota','Gemini is busy or its quota is exhausted.'],
          'timeout':[504,'generation-timeout','Guide generation timed out.'],
          'provider-error':[502,'generation-failed','The generation provider could not complete the request.'],
          'invalid-input':[424,'insufficient-documentation','Research did not provide usable OAuth evidence.'],
          'invalid-json':[502,'invalid-output','Generated output was not valid structured JSON.'],
          'invalid-guide':[502,'guide-validation-failed','Generated guidance failed schema or evidence validation and was not returned.'],
        };
        const [status,code,message]=errors[result.error];
        if(['provider-error','rate-limited','timeout','invalid-json'].includes(result.error)){
          const fallback={stage:result.realRequestCount===0?'generation-admission':'provider-request',category:result.error==='rate-limited'?'rate-limit':result.error==='timeout'?'timeout':'unknown'};
          const event=providerFailureLog(requestId,status,result.providerDiagnostic??fallback);
          try{if(deps.logGenerationFailure)deps.logGenerationFailure(event);else process.stderr.write('[oauth-guide-generation] '+JSON.stringify(event)+'\n');}catch{}
        }
        return failure(status,code,message,'No retry or paid fallback was attempted. Review documentation coverage or server configuration before another deliberate request.');
      }
      let saved;
      if(deps.storage){try{const record=await deps.storage.save(result);saved={id:record.id,path:`/guides/${record.id}`,createdAt:record.createdAt};}catch{return failure(503,'guide-save-failed','Generation completed but the guide could not be saved. No share link was created.','Check persistent storage before another deliberate generation request; nothing is retried automatically.');}}
      return response(200,{...(saved?{saved}:{}),ok:true,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',oauthTestLabel:'Not end-to-end tested',guide:result.guide,sources:result.sources,evidence:result.support,lastResearchedAt:result.guide.lastResearchedAt,warnings:result.warnings,research:{status:research.status,requestCount:research.requestCount,missingTopics:research.missingTopics},model:result.model});
    }catch{return failure(502,'pipeline-failed','The research/generation pipeline could not complete the request.','No automatic retry is performed. Check server configuration or try a specific official documentation URL.');}
    finally{active=false;}
  }
  return async function POST(request:Request):Promise<Response>{
    const requestId=randomUUID();
    const result=await handle(request,requestId);
    const headers=new Headers(result.headers);headers.set('X-Request-ID',requestId);
    return Response.json({...await result.json(),requestId},{status:result.status,headers});
  };
}
