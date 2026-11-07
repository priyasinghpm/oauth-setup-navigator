// Synthetic validated fixtures are stored only in isolated temporary test dirs.
// No real Gemini request, network, user credentials or app-library seed data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFileGuideStore,isSavedGuideId} from '../lib/storage/file-guide-store';
import {resolveGuideTarget} from '../lib/storage/resolve-guide';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {guides} from '../lib/guides';
import {input,fixture} from './helpers/generation';
import type {GenerationResult} from '../lib/generation/types';
const valid=async()=>{const i=input();const r=await generateWithTransport(i,async()=>({text:JSON.stringify(fixture(prepareGeneration(i)))}));assert.ok(r.ok);return r;};
const req=()=>new Request('http://localhost:3001/api/guides/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'Example'})});
test('atomic saves preserve full guide and exact evidence across new store instances, with unique IDs and no extras',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const store=createFileGuideStore(root);const result=await valid();
 Object.assign(result,{apiKey:'TEST_ONLY_PRIVATE_VALUE',authorization:'TEST_ONLY_PRIVATE_VALUE',rawResponse:'TEST_ONLY_PRIVATE_VALUE'});Object.assign(result.guide,{clientSecret:'TEST_ONLY_PRIVATE_VALUE'});
 await store.ready();const [a,b]=await Promise.all([store.save(result),store.save(result)]);assert.ok(isSavedGuideId(a.id));assert.notEqual(a.id,b.id);
 const reopened=await createFileGuideStore(root).get(a.id);assert.ok(reopened);const expected=structuredClone(result.guide);Reflect.deleteProperty(expected,'clientSecret');assert.deepEqual(reopened.guide,expected);assert.equal(reopened.reviewStatus,'not-human-reviewed');assert.equal(reopened.oauthTestStatus,'not-tested');assert.deepEqual(reopened.warnings,result.warnings);
 assert.equal(reopened.guide.steps[0].evidence.quotations![0].quote,result.guide.steps[0].evidence.quotations![0].quote);assert.equal(reopened.guide.lastResearchedAt,result.guide.lastResearchedAt);assert.equal(reopened.guide.approvalSummary.evidence.status,'unknown');
 assert.doesNotMatch(await readFile(join(root,`${a.id}.json`),'utf8'),/TEST_ONLY_PRIVATE_VALUE|"clientSecret":|"rawResponse":|"authorization":/);assert.equal((await readdir(root)).filter(x=>x.startsWith('.')).length,0);
});
test('invalid, traversal and missing IDs never expose other files; malformed records fail safely',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const store=createFileGuideStore(root);
 for(const id of ['../.env.local','google-calendar','../../private','%2e%2e','', '00000000-0000-4000-8000-000000000000'])assert.equal(await store.get(id),null);
 const id='00000000-0000-4000-8000-000000000000';await writeFile(join(root,`${id}.json`),'invalid JSON private filesystem detail');await assert.rejects(store.get(id),e=>e instanceof Error&&e.message==='Saved guide storage is unavailable.');
 const saved=await store.save(await valid());await writeFile(join(root,`${saved.id}.json`),JSON.stringify({...saved,reviewStatus:'human-reviewed'}));await assert.rejects(store.get(saved.id));
});
test('store rejects unsuccessful generation and invalid guide data before writing',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const store=createFileGuideStore(root),result=await valid();
 await assert.rejects(store.save({...result,schemaValid:false} as unknown as Extract<GenerationResult,{ok:true}>));
 result.guide.oauthTestStatus='tested' as 'not-tested';await assert.rejects(store.save(result));assert.deepEqual(await readdir(root),[]);
});
test('API persists only validated success and saved routes never invoke research or model transport',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const store=createFileGuideStore(root);let modelCalls=0,researchCalls=0;
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,storage:store,research:async()=>{researchCalls++;return input().research;},generate:i=>generateWithTransport(i,async()=>{modelCalls++;return {text:JSON.stringify(fixture(prepareGeneration(i)))};})});
 const response=await handler(req()),body=await response.json();assert.equal(response.status,200);assert.equal(body.saved.path,`/guides/${body.saved.id}`);
 const anotherStore=createFileGuideStore(root);for(let i=0;i<2;i++){const reopened=await resolveGuideTarget(body.saved.id,anotherStore);assert.ok(reopened?.saved);assert.deepEqual(reopened.guide,body.guide);assert.equal(reopened.saved.reviewStatus,body.reviewStatus);}
 assert.equal(modelCalls,1);assert.equal(researchCalls,1);
});
test('invalid generation saves nothing; storage preflight failure skips Gemini and write failures create no share link',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const store=createFileGuideStore(root);let saves=0,calls=0;
 const common={enabled:()=>true,configured:()=>true,research:async()=>{calls++;return input().research;},generate:async()=>{calls++;return valid();}};
 const bad=createGenerateHandler({...common,storage:{...store,save:async r=>{saves++;return store.save(r);}},generate:i=>generateWithTransport(i,async()=>({text:JSON.stringify({guide:{}})})),logValidationFailure:()=>{}});assert.equal((await bad(req())).status,502);assert.equal(saves,0);assert.deepEqual(await readdir(root),[]);
 calls=0;const blocked=createGenerateHandler({...common,storage:{...store,ready:async()=>{throw Error('private path');}}});const blockedResponse=await blocked(req());assert.equal(blockedResponse.status,503);assert.equal((await blockedResponse.json()).error.code,'storage-unavailable');assert.equal(calls,0);
 const writeFailed=createGenerateHandler({...common,storage:{...store,save:async()=>{throw Error('private path');}}});const r=await writeFailed(req()),body=await r.json();assert.equal(body.error.code,'guide-save-failed');assert.equal(body.saved,undefined);assert.doesNotMatch(JSON.stringify(body),/private path/);
});
test('existing static slugs keep priority and need no persistent storage',async()=>{
 let reads=0;const store={get:async()=>{reads++;throw Error('must not read');}};
 for(const guide of guides){const resolved=await resolveGuideTarget(guide.slug,store);assert.deepEqual(resolved?.guide,guide);assert.equal(resolved?.saved,null);}
 assert.equal(await resolveGuideTarget('unknown-provider',store),null);assert.equal(reads,0);
});
test('saved record is readable from an independent Node process without importing a generation entry point',async t=>{
 const root=await mkdtemp(join(tmpdir(),'oauth-store-'));t.after(()=>rm(root,{recursive:true,force:true}));const saved=await createFileGuideStore(root).save(await valid());
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const script="import store from './lib/storage/file-guide-store.ts';const record=await store.createFileGuideStore(process.argv[1]).get(process.argv[2]);console.log(JSON.stringify({id:record.id,name:record.guide.name,test:record.oauthTestStatus,review:record.reviewStatus}));";
 const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',script,root,saved.id]);const read=JSON.parse(stdout);assert.equal(read.id,saved.id);assert.equal(read.name,saved.guide.name);assert.equal(read.test,'not-tested');assert.equal(read.review,'not-human-reviewed');
});
