'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import Link from 'next/link';
import {WORKER_HOURLY_LIMIT} from '@/lib/jobs/limits';
import {requestJob} from '@/lib/jobs/client';
import {readJobPointer,rememberJob} from '@/lib/jobs/browser-state';
import type {JobView} from '@/lib/jobs/types';
import type {OAuthGuide} from '@/lib/types';
import {GenerationJobView} from './generation-job';
export function QueuedGuideRequest({guides}:{guides:OAuthGuide[]}){
 const [provider,setProvider]=useState(''),[website,setWebsite]=useState(''),[busy,setBusy]=useState(false),[restoring,setRestoring]=useState(true),[error,setError]=useState(''),[job,setJob]=useState<JobView|null>(null);const active=useRef(false);
 const inProgress=job?.status==='queued'||job?.status==='running';
 const match=guides.find(g=>[g.name,g.slug].some(v=>v.toLowerCase()===provider.trim().toLowerCase()));
 useEffect(()=>{
  let mounted=true;const id=readJobPointer();
  if(!id){setRestoring(false);return;}
  requestJob(`/api/guides/jobs/${id}`).then(saved=>{if(mounted){setJob(saved);setProvider(saved.provider);rememberJob(saved.id,true);}}).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not reconnect to the saved job.');}).finally(()=>{if(mounted)setRestoring(false);});
  return()=>{mounted=false;};
 },[]);
 const updateJob=useCallback((next:JobView)=>{setJob(current=>current&&current.id===next.id&&current.updatedAt>next.updatedAt?current:next);rememberJob(next.id,true);},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(active.current||restoring||inProgress||match)return;
  active.current=true;setBusy(true);setError('');
  try{const created=await requestJob('/api/guides/jobs',{...(provider.trim()?{provider:provider.trim()}:{}),...(website.trim()?{website:website.trim()}:{})});rememberJob(created.id,true);setJob(created);}
  catch(e){setError(e instanceof Error?e.message:'The job could not be created.');}
  finally{active.current=false;setBusy(false);}
 }
 return <section className="generation-panel" id="generate" aria-labelledby="generation-title"><span id="stepwise-generation" aria-hidden="true"/><p className="eyebrow">A PROVIDER OUTSIDE THE LIBRARY?</p><h2 id="generation-title">Generate an OAuth setup guide</h2><p>Generate once. Research and section generation run in the background, and each completed section appears below automatically. You can leave and return without starting again.</p>
 <p className="generation-help">Local generation limit: {WORKER_HOURLY_LIMIT} model attempts per rolling hour, shared across jobs, with at least 60 seconds between attempts. Each section attempt, including a failed attempt or an explicit retry, uses one slot. Saved sections are kept; research, viewing and final assembly do not use model slots. Gemini has separate provider quotas.</p>
 <form onSubmit={submit} aria-busy={busy||Boolean(inProgress)||restoring}><div className="generation-fields"><div><label htmlFor="queue-provider">Provider name <span>(optional with website)</span></label><input id="queue-provider" value={provider} onChange={e=>setProvider(e.target.value)} maxLength={100} placeholder="For example, HubSpot" disabled={busy||Boolean(inProgress)||restoring}/></div><div><label htmlFor="queue-website">Official website or documentation URL</label><input id="queue-website" type="url" value={website} onChange={e=>setWebsite(e.target.value)} maxLength={1024} placeholder="https://developers.example.com/docs/oauth" disabled={busy||Boolean(inProgress)||restoring}/></div></div><p className="generation-help">Use a provider name and/or public HTTPS website. Never enter keys, credentials or tokens. The local background worker must be running; live generation is disabled by default.</p>{match&&!inProgress?<Link href={`/guides/${match.slug}`}>Open existing {match.name} guide →</Link>:<button className="button" type="submit" disabled={busy||Boolean(inProgress)||restoring||!provider.trim()&&!website.trim()}>{busy?'Starting generation…':inProgress?'Generating…':'Generate Guide'}</button>}</form>
 {restoring&&<p role="status">Reconnecting to saved progress…</p>}{busy&&<div className="generation-loading" role="status" aria-label="Starting generation"><span className="job-spinner" aria-hidden="true"/><strong>Starting background generation…</strong><p>Waiting for the server to save the job. No setup or approval is being performed.</p></div>}{error&&<p role="alert">{error}</p>}
 {job&&<><p className="generation-help"><Link href={`/jobs/${job.id}`}>Open saved progress →</Link> · Progress is saved on this server. A failed step stops safely without an automatic retry.</p><GenerationJobView key={job.id} initial={job} inline onUpdate={updateJob}/></>}
 </section>;
}
