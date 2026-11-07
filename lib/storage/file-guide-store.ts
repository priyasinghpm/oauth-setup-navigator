import {randomUUID} from 'node:crypto';
import {mkdir,open,link,unlink,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {isSavedGuideId,parseRecord,makeSavedRecord,MAX_BYTES,GuideStorageError,type GuideStore,type SavedGuide} from './guide-record';
export {isSavedGuideId,GuideStorageError} from './guide-record';
export type {GuideStore,SavedGuide} from './guide-record';
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
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

  saved=makeSavedRecord(result,id);
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
