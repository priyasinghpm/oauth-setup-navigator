'use client';
import {useEffect,useState} from 'react';
import type {QueueWaiting} from '@/lib/jobs/types';
export function QueueWait({waiting}:{waiting?:QueueWaiting}){
 const [localTime,setLocalTime]=useState('');
 useEffect(()=>{setLocalTime(waiting?.retryAt?new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(waiting.retryAt)):'');},[waiting?.retryAt]);
 if(!waiting)return <p>Waiting for a worker or the next quota slot. Completed sections remain available.</p>;
 return <div className="queue-wait-details">
 {waiting.worker==='not-running'?<p><strong>The background worker is not running.</strong> Start it in the project terminal to process queued work. This page does not start it automatically.</p>:waiting.worker==='running'?<p>Background worker: running.</p>:<p>Worker status could not be confirmed. Check the worker terminal.</p>}
 {waiting.retryAt&&<><p><strong>{waiting.quotaUsed>=waiting.quotaLimit?'Hourly local request limit reached.':'Waiting for the minimum interval between model calls.'}</strong> About {Math.max(1,Math.ceil((waiting.retryAfterSeconds??0)/60))} minutes remain before the local quota permits another call.</p><p>Next eligible slot: <time dateTime={waiting.retryAt}>{localTime||waiting.retryAt}</time>. This is a shared quota slot, not a guaranteed start time for this job.</p></>}
 <p>Local attempts this hour: {waiting.quotaUsed} / {waiting.quotaLimit}. Saved progress is preserved. No need to submit or retry again.</p>
 {waiting.reason==='awaiting-worker'&&<p>The worker will pick up this step when it is free.</p>}{waiting.reason==='unknown'&&<p>Queue status could not be fully read. Check local worker/storage diagnostics.</p>}
 </div>;
}
