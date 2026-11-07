import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseGuideStore} from '../lib/storage/supabase-guide-store';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {input,fixture} from './helpers/generation';
const url='https://example.supabase.co',key='OFFLINE_ONLY_SECRET';
async function valid(){const i=input();const result=await generateWithTransport(i,async()=>({text:JSON.stringify(fixture(prepareGeneration(i)))}));assert.ok(result.ok);return result;}
test('Supabase round trip preserves complete validated record across instances with no research/model requests',async()=>{
 const rows=new Map<string,unknown>();let posts=0,gets=0;
 const fetcher:typeof fetch=async(target,init)=>{
  assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.ok(init?.signal);assert.equal(new Headers(init?.headers).get('apikey'),key);
  if(init?.method==='POST'){posts++;const row=JSON.parse(String(init.body));assert.ok(!String(init.body).includes(key));if(rows.has(row.id))return new Response(null,{status:409});rows.set(row.id,row.record);return new Response(null,{status:201});}
  gets++;const u=new URL(String(target));const id=u.searchParams.get('id')?.slice(3);return Response.json(id&&rows.has(id)?[{record:rows.get(id)}]:[]);
 };
 const store=createSupabaseGuideStore(url,key,fetcher),result=await valid();await store.ready();const saved=await store.save(result);assert.match(saved.id,/^[a-f0-9-]{36}$/);
 for(let i=0;i<2;i++)assert.deepEqual(await createSupabaseGuideStore(url,key,fetcher).get(saved.id),saved);
 const same=await store.save(result,saved.id);assert.deepEqual(same,saved);assert.equal(posts,2);assert.equal(gets,4);
 result.guide.summary='Different guide';await assert.rejects(store.save(result,saved.id));assert.deepEqual(await store.get(saved.id),saved);
});
test('invalid results, unsafe configuration and invalid IDs cause zero requests',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json([]);};
 for(const u of ['http://example.supabase.co','https://127.0.0.1','https://example.supabase.co.evil.test','https://example.supabase.co/path','https://user:pass@example.supabase.co'])assert.throws(()=>createSupabaseGuideStore(u,key,fetcher));
 const store=createSupabaseGuideStore(url,key,fetcher);for(const id of ['../secrets','not-a-uuid'])assert.equal(await store.get(id),null);
 const result=await valid();result.guide.oauthTestStatus='tested' as 'not-tested';await assert.rejects(store.save(result));assert.equal(calls,0);
});
test('storage failures and malformed records are safe and never retried',async()=>{
 const id='00000000-0000-4000-8000-000000000001';
 for(const mode of ['throw','503','malformed','oversized']){
  let calls=0;const store=createSupabaseGuideStore(url,key,async()=>{calls++;if(mode==='throw')throw Error(key);if(mode==='503')return new Response(key,{status:503});if(mode==='oversized')return new Response('x'.repeat(514000));return Response.json([{record:{id,apiKey:key}}]);});
  await assert.rejects(store.get(id),e=>e instanceof Error&&e.message==='Saved guide storage is unavailable.'&&!e.message.includes(key));assert.equal(calls,1);
 }
});
test('new secret keys are sent only as apikey, never as bearer JWTs',async()=>{
 let calls=0;const store=createSupabaseGuideStore(url,'sb_secret_OFFLINE',async(_,options)=>{calls++;const h=new Headers(options?.headers);assert.equal(h.get('apikey'),'sb_secret_OFFLINE');assert.equal(h.has('authorization'),false);return Response.json([]);});await store.ready();assert.equal(calls,1);
});
