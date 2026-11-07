import {randomUUID} from 'node:crypto';
import {mkdir,open,link,unlink,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
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
const MAX_BYTES=512000;
function parseRecord(value:unknown,id:string):SavedGuide{
 if(!record(value)||value.version!==1||value.id!==id||!isSavedGuideId(id)||value.status!=='generated-draft'||value.reviewStatus!=='not-human-reviewed'||value.oauthTestStatus!=='not-tested'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt||typeof value.model!=='string'||!value.model||!Array.isArray(value.warnings)||value.warnings.some(w=>typeof w!=='string')||!record(value.guide)||!Array.isArray(value.guide.sources))throw new GuideStorageError('invalid-record');
 const urls=new Set(value.guide.sources.map(s=>{if(!record(s)||typeof s.url!=='string')throw new GuideStorageError('invalid-record');return s.url;}));
 const guide=parseGuides([value.guide],{allowedSourceUrls:urls})[0];
 return {version:1,id,createdAt:value.createdAt,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide,warnings:value.warnings,model:value.model};
}
// Atomic exclusive commit on one persistent filesystem. No module-level cache,
// database, client storage, credentials, request headers or diagnostics persisted.
export function createFileGuideStore(directory:string):GuideStore{
 const root=resolve(directory);
 async function ready(){try{await mkdir(root,{recursive:true,mode:0o700});const path=join(root,`.probe-${randomUUID()}`);const f=await open(path,'wx',0o600);await f.close();await unlink(path);}catch{throw new GuideStorageError('unavailable');}}
 return {ready,async save(result,stableId){
  if(result.ok!==true||result.schemaValid!==true||result.jsonValid!==true)throw new GuideStorageError('invalid-record');
  if(stableId!==undefined&&!isSavedGuideId(stableId))throw new GuideStorageError('invalid-record');
  const id=stableId??randomUUID();let saved:SavedGuide;
  if(stableId){try{
   const bytes=await readFile(join(root,id+'.json'));if(bytes.length>MAX_BYTES)throw new GuideStorageError('invalid-record');
   const prior=parseRecord(JSON.parse(bytes.toString()),id);
   if(JSON.stringify(prior.guide)!==JSON.stringify(result.guide)||prior.model!==result.model)throw new GuideStorageError('invalid-record');
   return prior;
  }catch(e){if(!record(e)||e.code!=='ENOENT')throw e;}}

  try{
   saved=parseRecord({version:1,id,createdAt:new Date().toISOString(),status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide:result.guide,warnings:result.warnings,model:result.model},id);
   const originals=new Map(result.sources.map(s=>[s.id,s]));
   if(originals.size!==saved.guide.sources.length||saved.guide.sources.some(s=>{const original=originals.get(s.id);return !original||original.url!==s.url||original.title!==s.title||original.inspectedAt!==s.inspectedAt;}))throw new GuideStorageError('invalid-record');
  }catch{throw new GuideStorageError('invalid-record');}
  const bytes=JSON.stringify(saved);if(Buffer.byteLength(bytes)>MAX_BYTES)throw new GuideStorageError('invalid-record');
  const temporary=join(root,`.pending-${randomUUID()}`);
  try{await mkdir(root,{recursive:true,mode:0o700});const f=await open(temporary,'wx',0o600);try{await f.writeFile(bytes,'utf8');await f.sync();}finally{await f.close();}
   // Link commits a complete file atomically without overwriting an existing ID.
   await link(temporary,join(root,`${id}.json`));
  }catch{throw new GuideStorageError('unavailable');}
  finally{await unlink(temporary).catch(()=>{});}
  return saved;
 },async get(id){
  if(!isSavedGuideId(id))return null;
  let f;try{f=await open(join(root,`${id}.json`),'r');}catch(e){if(record(e)&&e.code==='ENOENT')return null;throw new GuideStorageError('unavailable');}
  try{const stat=await f.stat();if(!stat.isFile()||stat.size>MAX_BYTES)throw new GuideStorageError('invalid-record');return parseRecord(JSON.parse(await f.readFile('utf8')),id);}
  catch{throw new GuideStorageError('invalid-record');}finally{await f.close();}
 }};
}
