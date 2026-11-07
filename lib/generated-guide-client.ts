import {parseGuides} from './validate-guides';
import type {OAuthGuide} from './types';
export interface SavedGuideLink {id:string;path:string;createdAt:string}
export interface GenerateInput {provider?:string;website?:string}
const errorMessages:Record<string,string>={
 'cross-origin':'The page address does not match the API request origin. Open the navigator using the same host and port as the server, then submit again. No generation was started.',
 'storage-unavailable':'Persistent guide storage is unavailable. Check the local storage directory before generating; no Gemini request was made.',
 'guide-save-failed':'Generation completed but saving failed. Check persistent storage before generating again. No share link was created.',
 'generation-disabled':'Live generation is disabled. For a deliberate local test, enable GUIDE_GENERATION_ENABLED on the server after confirming billing is disabled.',
 'generation-unavailable':'Generation is not configured on the server. Ask the local developer to check its configuration.',
 'official-website-required':'We could not establish the official website. Add the provider’s official developer documentation URL and submit again.',
 'documentation-unavailable':'No usable public documentation was retrieved. Try a more specific official OAuth documentation URL.',
 'insufficient-documentation':'The retrieved pages did not provide enough usable OAuth evidence. Try a specific official OAuth setup page.',
 'research-timeout':'Documentation retrieval timed out. Try a more specific official documentation URL.',
 'generation-timeout':'Generation timed out. No automatic retry was made.',
 'request-timeout':'The request timed out. Check your connection before submitting again.',
 'request-limit':'The local request limit was reached. Wait before submitting again (at least one minute between requests; five per hour).',
 'busy':'Another research or generation request is running. Wait for it to finish.',
 'gemini-quota':'The model is busy or its free-tier quota is exhausted. Wait and check the quota; no paid fallback is used.',
 'guide-validation-failed':'The generated guide failed schema or evidence validation and was not displayed. More complete official documentation may help.',
 'invalid-output':'The model returned invalid structured output. No guide was accepted or automatically retried.',
 'invalid-input':'Enter a provider name and/or public HTTPS official documentation URL, without credentials or query parameters.',
};
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
export async function requestGeneratedGuide(input:GenerateInput,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<{guide:OAuthGuide;saved:SavedGuideLink|null}>{
 let response:Response;
 try{response=await fetcher('/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal,cache:'no-store'});}catch{throw new Error('The request could not complete. Check your connection. No automatic retry was made.');}
 let body:unknown;try{body=await response.json();}catch{throw new Error('The server returned an unreadable response. No guide was displayed.');}
 if(!response.ok||!record(body)||body.ok!==true){
   const code=record(body)&&record(body.error)&&typeof body.error.code==='string'?body.error.code:'';
   throw new Error(errorMessages[code]??'The guide could not be generated. No automatic retry or fallback was used. Check the official documentation URL and server configuration.');
 }
 try{
   if(body.status!=='generated-draft'||body.reviewStatus!=='not-human-reviewed'||body.oauthTestStatus!=='not-tested'||!record(body.guide)||!Array.isArray(body.guide.sources))throw new Error();
   const urls=new Set(body.guide.sources.map(source=>{if(!record(source)||typeof source.url!=='string')throw new Error();return source.url;}));
   const guide=parseGuides([body.guide],{allowedSourceUrls:urls})[0];
   let saved:SavedGuideLink|null=null;
   if(body.saved!==undefined){const s=body.saved;if(!record(s)||typeof s.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s.id)||s.path!==`/guides/${s.id}`||typeof s.createdAt!=='string'||!Number.isFinite(Date.parse(s.createdAt)))throw new Error();saved={id:s.id,path:s.path,createdAt:s.createdAt};}
   return {guide,saved};
 }catch{throw new Error('The server response did not match the guide schema. No guide was displayed.');}
}
