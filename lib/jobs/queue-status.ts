import {WORKER_HOURLY_LIMIT} from './limits';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {lockOwners,type JobStore} from './store';
import type {QueueWaiting} from './types';
import {record} from './guards';
function processState(pid:number):QueueWaiting['worker']{try{process.kill(pid,0);return 'running';}catch(e){return record(e)&&e.code==='ESRCH'?'not-running':'unknown';}}
// Read-only snapshot. Never consumes quota, acquires a worker lock, starts work,
// resets counters, or promises this job will get the next shared slot.
export async function queueWaiting(store:JobStore,modelStage:boolean,options:{now?:number;processState?:(pid:number)=>QueueWaiting['worker']}={}):Promise<QueueWaiting>{
 const now=options.now??Date.now();let worker:QueueWaiting['worker']='unknown';
 try{const owners=lockOwners(await readFile(join(store.root,'.worker.lock'),'utf8'));const states=owners.map(options.processState??processState);worker=states.includes('running')?'running':states.length&&states.every(s=>s==='not-running')?'not-running':'unknown';}catch(e){if(record(e)&&e.code==='ENOENT')worker='not-running';}
 let calls:number[]=[];let quotaKnown=true;
 try{const value:unknown=JSON.parse(await readFile(join(store.root,'.quota'),'utf8'));if(!Array.isArray(value)||value.length>1000||!value.every((x):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=8640000000000000-3600000))throw Error('invalid-quota');calls=value.filter(t=>now-t<3600000);}catch(e){if(!record(e)||e.code!=='ENOENT')quotaKnown=false;}
 const next=calls.length?Math.max(calls[calls.length-1]+60000,calls.length>=WORKER_HOURLY_LIMIT?calls[0]+3600000:0):now;
 const wait=modelStage&&quotaKnown?Math.max(0,Math.ceil((next-now)/1000)):0;
 return {worker,quotaUsed:calls.length,quotaLimit:WORKER_HOURLY_LIMIT,reason:worker==='not-running'?'worker-offline':!quotaKnown?'unknown':wait>0?'rate-limit':worker==='running'?'awaiting-worker':'unknown',...(wait>0?{retryAt:new Date(next).toISOString(),retryAfterSeconds:wait}:{})};
}
