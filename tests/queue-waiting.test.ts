import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJobStore} from '../lib/jobs/store';
import {queueWaiting} from '../lib/jobs/queue-status';
async function setup(){const root=await mkdtemp(join(tmpdir(),'oauth-queue-wait-')),store=createJobStore(root);return {root,store};}
test('read-only queue status reports hourly wait exactly and never changes quota',async()=>{
 const s=await setup();try{const base=1000000,calls=Array.from({length:10},(_,i)=>base+i*60000),raw=JSON.stringify(calls);await writeFile(join(s.root,'.quota'),raw);await writeFile(join(s.root,'.worker.lock'),'12345');
 const waiting=await queueWaiting(s.store,true,{now:base+600000,processState:()=> 'running'});assert.equal(waiting.reason,'rate-limit');assert.equal(waiting.quotaUsed,10);assert.equal(waiting.retryAfterSeconds,3000);assert.equal(waiting.retryAt,new Date(base+3600000).toISOString());assert.equal(await readFile(join(s.root,'.quota'),'utf8'),raw);assert.equal(JSON.stringify(waiting).includes('12345'),false);
 const later=await queueWaiting(s.store,true,{now:base+3600000,processState:()=> 'running'});assert.equal(later.retryAt,undefined);assert.equal(later.reason,'awaiting-worker');
 }finally{await rm(s.root,{recursive:true,force:true});}
});
test('minimum interval is shown separately and non-model stages are not quota blocked',async()=>{
 const s=await setup();try{await writeFile(join(s.root,'.quota'),JSON.stringify([1000000]));await writeFile(join(s.root,'.worker.lock'),'12345');
 const waiting=await queueWaiting(s.store,true,{now:1020000,processState:()=> 'running'});assert.equal(waiting.retryAfterSeconds,40);assert.equal(waiting.quotaUsed,1);
 const research=await queueWaiting(s.store,false,{now:1020000,processState:()=> 'running'});assert.equal(research.retryAt,undefined);assert.equal(research.reason,'awaiting-worker');
 }finally{await rm(s.root,{recursive:true,force:true});}
});
test('missing or dead worker is distinguished from quota waiting',async()=>{
 const s=await setup();try{assert.equal((await queueWaiting(s.store,true)).reason,'worker-offline');await writeFile(join(s.root,'.worker.lock'),'12345');assert.equal((await queueWaiting(s.store,true,{processState:()=> 'not-running'})).reason,'worker-offline');assert.equal((await queueWaiting(s.store,true,{processState:()=> 'unknown'})).worker,'unknown');}finally{await rm(s.root,{recursive:true,force:true});}
});
test('corrupt quota fails safely without leaking its contents or resetting it',async()=>{
 const s=await setup();try{await writeFile(join(s.root,'.worker.lock'),'12345');for(const raw of ['PRIVATE_CONTENT','[1e300]']){await writeFile(join(s.root,'.quota'),raw);const waiting=await queueWaiting(s.store,true,{processState:()=> 'running'});assert.equal(waiting.reason,'unknown');assert.equal(await readFile(join(s.root,'.quota'),'utf8'),raw);assert.equal(JSON.stringify(waiting).includes('PRIVATE_CONTENT'),false);}}finally{await rm(s.root,{recursive:true,force:true});}
});

test('five prior attempts no longer block staged work under the ten-call cap',async()=>{
 const s=await setup();try{const base=1000000;await writeFile(join(s.root,'.quota'),JSON.stringify(Array.from({length:5},(_,i)=>base+i*60000)));await writeFile(join(s.root,'.worker.lock'),'12345');const waiting=await queueWaiting(s.store,true,{now:base+300000,processState:()=> 'running'});assert.equal(waiting.quotaLimit,10);assert.equal(waiting.quotaUsed,5);assert.equal(waiting.reason,'awaiting-worker');assert.equal(waiting.retryAt,undefined);}finally{await rm(s.root,{recursive:true,force:true});}
});
