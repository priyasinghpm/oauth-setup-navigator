import {isSavedGuideId,makeSavedRecord,parseRecord,MAX_BYTES,GuideStorageError,type GuideStore} from './guide-record';
// Server-side PostgREST adapter; no client SDK, browser credentials, or retries.
export function createSupabaseGuideStore(url:string,key:string,fetcher:typeof fetch=fetch):GuideStore{
 let endpoint:string;
 try{const u=new URL(url);if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!key.trim())throw Error();endpoint=u.origin+'/rest/v1/generated_guides';}catch{throw new GuideStorageError('unavailable');}
 async function request(path:string,method='GET',body?:string){
  try{return await fetcher(endpoint+path,{method,headers:{apikey:key,...(!key.startsWith('sb_secret_')?{Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json',...(method==='POST'?{Prefer:'return=minimal'}:{})},...(body?{body}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw new GuideStorageError('unavailable');}
 }
 async function get(id:string){
  if(!isSavedGuideId(id))return null;
  const response=await request('?select=record&id=eq.'+id+'&limit=1');
  if(!response.ok)throw new GuideStorageError('unavailable');
  try{
   const reader=response.body?.getReader();if(!reader)throw Error();let raw='',bytes=0;const decoder=new TextDecoder();
   try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_BYTES+1024){await reader.cancel();throw Error();}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
   const rows:unknown=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>1)throw Error();if(!rows.length)return null;
   if(typeof rows[0]!=='object'||!rows[0]||!('record' in rows[0]))throw Error();return parseRecord(rows[0].record,id);
  }catch{throw new GuideStorageError('invalid-record');}
 }
 return {
  async ready(){const response=await request('?select=id&limit=0');if(!response.ok)throw new GuideStorageError('unavailable');await response.body?.cancel();},
  get,
  async save(result,stableId){
   const saved=makeSavedRecord(result,stableId);
   const response=await request('','POST',JSON.stringify({id:saved.id,record:saved}));
   if(response.status===409&&stableId){const prior=await get(stableId);if(prior&&JSON.stringify(prior.guide)===JSON.stringify(saved.guide)&&prior.model===saved.model)return prior;throw new GuideStorageError('invalid-record');}
   if(!response.ok)throw new GuideStorageError('unavailable');await response.body?.cancel();return saved;
  },
 };
}
