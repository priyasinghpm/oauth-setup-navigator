import {createHmac,timingSafeEqual} from 'node:crypto';
import {generationProperties} from './schema';
import {checkResponseSchema} from './response-schema';
import {resolveModelEvidence} from './resolve';
import {fragmentEntries,validateContentRules} from './claim-rules';
import {assertGuideIdentity,sameProviderName} from './identity';
import {parseGuideFragment} from '../validate-guides';
import {validateGeneratedGuide} from './validate';
import {buildGenerationRequest} from './prompt';
import {validationDiagnostic} from './diagnostics';
import {classifyProviderError,sanitizeProviderDiagnostic} from './provider-diagnostics';
import {GENERATION_LIMITS,type PreparedInput,type ModelTransport,type GenerationResult} from './types';
import type {OAuthGuide} from '../types';
import {RECOVERY_FIELDS as groups,RECOVERY_TITLES,type RecoveryKey,type RecoveryView} from './recovery-contract';
export type {RecoveryView} from './recovery-contract';
export interface RecoveryState {version:1;expiresAt:number;input:PreparedInput;model:string;chunks:Partial<Record<RecoveryKey,Record<string,unknown>>>}
const keys=Object.keys(groups) as RecoveryKey[];
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function schema(key:RecoveryKey){const props=generationProperties();const selected=Object.fromEntries(groups[key].map(k=>[k,props[k]]));return {type:'object',properties:{guide:{type:'object',properties:selected,required:[...groups[key]],additionalProperties:false}},required:['guide'],additionalProperties:false};}
function identity(input:PreparedInput){return {slug:input.slug,name:input.provider,lastResearchedAt:input.researchedAt};}
function validateChunk(raw:Record<string,unknown>,input:PreparedInput,key:RecoveryKey){
 if(checkResponseSchema({guide:raw},schema(key)).length)throw Error('recovery-schema-invalid');
 const {guideValue,support}=resolveModelEvidence({guide:raw},input);const content=parseGuideFragment(guideValue);
 if(key==='steps'&&(!content.steps||content.steps.length<4||content.steps.length>8))throw Error('recovery-step-count');
 validateContentRules(content,support,input);
 assertGuideIdentity({...identity(input),summary:content.summary??'',steps:content.steps??[]},input);
 for(const item of fragmentEntries(content)){const quotes=support.filter(q=>q.path===item.path).map(({path:_,...q})=>q);if(quotes.length)item.evidence.quotations=quotes;}
 return content;
}
export function recoverSections(parsed:unknown,input:PreparedInput,model:string,now=Date.now()):RecoveryState|undefined{
 if(!record(parsed)||!record(parsed.guide))return;
 const raw=parsed.guide;
 // A genuinely different provider or a testing/verification claim is never relabeled.
 if(typeof raw.name!=='string'||!sameProviderName(raw.name,input.provider)||raw.slug!==input.slug||raw.lastResearchedAt!==input.researchedAt||raw.oauthTestStatus!=='not-tested'||raw.verificationStatus!=='source-backed')return;
 const state:RecoveryState={version:1,expiresAt:now+2*3600000,input,model,chunks:{}};
 for(const key of keys){const chunk=Object.fromEntries(groups[key].map(k=>[k,raw[k]]));try{validateChunk(chunk,input,key);state.chunks[key]=chunk;}catch{/* Rejected content is neither displayed nor included in the checkpoint. */}}
 return Object.keys(state.chunks).length?state:undefined;
}
export function signRecovery(state:RecoveryState,secret:string){if(Buffer.byteLength(secret)<32)throw Error('recovery-not-configured');const payload=Buffer.from(JSON.stringify(state)).toString('base64url');if(payload.length>1000000)throw Error('recovery-too-large');return payload+'.'+createHmac('sha256',secret).update('oauth-recovery-v1:'+payload).digest('hex');}
export function openRecovery(token:string,secret:string,now=Date.now()):RecoveryState{
 if(Buffer.byteLength(secret)<32||token.length>1000100||!/^[-\w]+\.[a-f0-9]{64}$/.test(token))throw Error('recovery-invalid');
 const [payload,signature]=token.split('.');const expected=createHmac('sha256',secret).update('oauth-recovery-v1:'+payload).digest();if(!timingSafeEqual(Buffer.from(signature,'hex'),expected))throw Error('recovery-invalid');
 const value:unknown=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(!record(value)||value.version!==1||typeof value.expiresAt!=='number'||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||!record(value.input)||typeof value.model!=='string'||!record(value.chunks)||!Object.keys(value.chunks).length||Object.keys(value.chunks).some(k=>!keys.includes(k as RecoveryKey)))throw Error('recovery-expired-or-invalid');
 // Only the server creates authenticated state. Recheck all accepted sections on use.
 const state=value as unknown as RecoveryState;recoveryView(state,token);return state;
}
export function recoveryView(state:RecoveryState,token:string):RecoveryView{
 const sections=keys.filter(k=>state.chunks[k]).map(key=>({key,title:RECOVERY_TITLES[key],content:validateChunk(state.chunks[key]!,state.input,key)}));
 const pending=keys.filter(k=>!state.chunks[k]);
 return {token,provider:state.input.provider,researchDate:state.input.researchedAt,sections,sources:state.input.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt})),pending,canContinue:pending.length>0,reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};
}
export function buildRecoveryRequest(state:RecoveryState){
 const key=keys.find(k=>!state.chunks[k]);if(!key)throw Error('recovery-final-validation-required');
 const base=buildGenerationRequest(state.input);
 return {...base,jsonSchema:schema(key),systemInstruction:base.systemInstruction+'\nCONTINUATION: Return ONLY {"guide":{'+groups[key].join(',')+'}} for the section '+RECOVERY_TITLES[key]+'. The response schema intentionally omits other fields. Do not repeat completed sections or change identity. All evidence, uncertainty and nonempty-array rules still apply.'};
}
export async function continueRecovery(state:RecoveryState,transport:ModelTransport):Promise<GenerationResult>{
 const fail=(error:Extract<GenerationResult,{ok:false}>['error'],providerDiagnostic?:Extract<GenerationResult,{ok:false}>['providerDiagnostic']):GenerationResult=>({ok:false,error,message:'The remaining section could not be accepted. Saved partial progress is unchanged.',realRequestCount:1,jsonValid:false,schemaValid:false,...providerDiagnostic?{providerDiagnostic}:{}});
 if(transport.model&&transport.model!==state.model)return {...fail('invalid-input'),realRequestCount:0};
 const key=keys.find(k=>!state.chunks[k]);if(!key)return {...fail('invalid-input'),realRequestCount:0};
 let request;try{request=buildRecoveryRequest(state);}catch{return {...fail('invalid-input'),realRequestCount:0};}
 let reply;
 try{reply=await transport(request);}catch(error){const diagnostic=record(error)&&error.providerDiagnostic?sanitizeProviderDiagnostic(error.providerDiagnostic):classifyProviderError(error);return fail(diagnostic.category==='rate-limit'?'rate-limited':diagnostic.category==='timeout'?'timeout':'provider-error',diagnostic);}
 if(reply.returnedModel&&reply.returnedModel!==state.model)return fail('provider-error',{stage:'provider-response',category:'unexpected-model'});
 if(reply.finishReason&&reply.finishReason!=='STOP')return fail('provider-error',sanitizeProviderDiagnostic({stage:'provider-response',category:'incomplete-response',finishReason:reply.finishReason}));
 if(!reply.text||Buffer.byteLength(reply.text)>GENERATION_LIMITS.maxOutputBytes)return fail('invalid-json');
 let parsed:unknown;try{parsed=JSON.parse(reply.text);}catch{return fail('invalid-json',{stage:'response-json',category:'invalid-json'});}
 let next=state;
 try{
  if(!record(parsed)||Object.keys(parsed).length!==1||!record(parsed.guide))throw Error('recovery-invalid-json');validateChunk(parsed.guide,state.input,key);
  next={...state,chunks:{...state.chunks,[key]:parsed.guide}};
  if(keys.some(k=>!next.chunks[k]))return {ok:false,error:'invalid-guide',message:'Additional validated sections are available.',realRequestCount:1,jsonValid:true,schemaValid:false,partial:next};
  const raw=Object.assign({ ...identity(state.input),category:'OAuth provider',mark:state.input.provider.slice(0,1).toUpperCase(),keywords:['oauth',state.input.provider],verificationStatus:'source-backed',oauthTestStatus:'not-tested'},...keys.map(k=>next.chunks[k]));
  const {guide,support}=validateGeneratedGuide({guide:raw},state.input);
  return {ok:true,guide,support,sources:state.input.sources.map(({text,originalText,excerpts,...s})=>s),warnings:[...state.input.warnings,'Recovered sections passed structural and evidence checks, not human review or OAuth testing.'],model:state.model,realRequestCount:1,jsonValid:true,schemaValid:true};
 }catch(error){return {ok:false,error:'invalid-guide',message:'The remaining section failed validation; previous progress is unchanged.',realRequestCount:1,jsonValid:true,schemaValid:false,partial:next,diagnostic:validationDiagnostic(error,state.input,parsed)};}
}
