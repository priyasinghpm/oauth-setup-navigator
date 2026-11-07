import {randomUUID} from 'node:crypto';
import {parseGuides} from '../validate-guides';
import type {OAuthGuide} from '../types';
import type {GenerationResult} from '../generation/types';
export const isSavedGuideId=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
export interface SavedGuide {
 version:1;id:string;createdAt:string;status:'generated-draft';reviewStatus:'not-human-reviewed';oauthTestStatus:'not-tested';guide:OAuthGuide;warnings:string[];model:string;
}
export interface GuideStore {ready():Promise<void>;save(result:Extract<GenerationResult,{ok:true}>,stableId?:string):Promise<SavedGuide>;get(id:string):Promise<SavedGuide|null>}
export class GuideStorageError extends Error {constructor(public readonly code:'unavailable'|'invalid-record'){super('Saved guide storage is unavailable.');this.name='GuideStorageError';}}
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
export const MAX_BYTES=512000;
export function parseRecord(value:unknown,id:string):SavedGuide{
 if(!record(value)||value.version!==1||value.id!==id||!isSavedGuideId(id)||value.status!=='generated-draft'||value.reviewStatus!=='not-human-reviewed'||value.oauthTestStatus!=='not-tested'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt||typeof value.model!=='string'||!value.model||!Array.isArray(value.warnings)||value.warnings.some(w=>typeof w!=='string')||!record(value.guide)||!Array.isArray(value.guide.sources))throw new GuideStorageError('invalid-record');
 const urls=new Set(value.guide.sources.map(s=>{if(!record(s)||typeof s.url!=='string')throw new GuideStorageError('invalid-record');return s.url;}));
 const guide=parseGuides([value.guide],{allowedSourceUrls:urls})[0];
 return {version:1,id,createdAt:value.createdAt,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide,warnings:value.warnings,model:value.model};
}
export function makeSavedRecord(result:Extract<GenerationResult,{ok:true}>,stableId?:string):SavedGuide{
 try{
  if(result.ok!==true||result.schemaValid!==true||result.jsonValid!==true||stableId!==undefined&&!isSavedGuideId(stableId))throw new GuideStorageError('invalid-record');
  const id=stableId??randomUUID();
  const saved=parseRecord({version:1,id,createdAt:new Date().toISOString(),status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide:result.guide,warnings:result.warnings,model:result.model},id);
  const originals=new Map(result.sources.map(s=>[s.id,s]));
  if(originals.size!==saved.guide.sources.length||saved.guide.sources.some(s=>{const original=originals.get(s.id);return !original||original.url!==s.url||original.title!==s.title||original.inspectedAt!==s.inspectedAt;}))throw new GuideStorageError('invalid-record');
  if(Buffer.byteLength(JSON.stringify(saved))>MAX_BYTES)throw new GuideStorageError('invalid-record');
  return saved;
 }catch{throw new GuideStorageError('invalid-record');}
}
