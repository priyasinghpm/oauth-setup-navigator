'use client';
import {WORKER_HOURLY_LIMIT} from '@/lib/jobs/limits';
import {QueueWait} from './queue-wait';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {requestJob,jobFailureMessages} from '@/lib/jobs/client';
import {STAGES,STAGE_TITLES,type JobView} from '@/lib/jobs/types';
import {GuideFragment} from './guide-fragment';
import {CopyShareLink} from './copy-share-link';
import {rememberJob} from '@/lib/jobs/browser-state';
export function GenerationJobView({initial,inline=false,onUpdate}:{initial:JobView;inline?:boolean;onUpdate?:(job:JobView)=>void}){
 const [job,setJob]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');const active=useRef(false);
 useEffect(()=>{rememberJob(job.id);onUpdate?.(job);},[job,onUpdate]);
 const SectionTitle=inline?'h4':'h2';
 function accept(next:JobView){setJob(current=>next.updatedAt<current.updatedAt?current:next);}
 async function refresh(){try{accept(await requestJob(`/api/guides/jobs/${job.id}`));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not read job status.');}}
 useEffect(()=>{
  if(job.status!=='queued'&&job.status!=='running')return;
  let mounted=true;let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{const next=await requestJob(`/api/guides/jobs/${job.id}`);if(mounted){accept(next);setError('');}}
   catch{if(mounted)setError('Status updates are temporarily unavailable. The worker may still be running; checking status again does not retry generation.');}
   finally{if(mounted)timer=setTimeout(poll,2000);}
  }
  timer=setTimeout(poll,2000);
  return()=>{mounted=false;clearTimeout(timer);};
 },[job.id,job.status]);
 async function resume(){if(active.current)return;active.current=true;setBusy(true);setError('');try{setJob(await requestJob(`/api/guides/jobs/${job.id}/resume`,{}));}catch(e){setError(e instanceof Error?e.message:'Could not continue job.');}finally{active.current=false;setBusy(false);}}
 return <article className={inline?"generated-result":undefined}>{!inline&&<Link href={`/generate/stepwise?job=${job.id}#generate`}>← View resumable generation</Link>}{inline?<h3 className="generated-title">{job.provider} OAuth setup guide</h3>:<h1>{job.provider} · stepwise guide</h1>}<p className="guide-warning">AI-generated sections · Not human reviewed · Not end-to-end tested. Passing evidence checks does not establish that the interpretation is correct.</p><p>Save this job URL to resume later. Research date: {job.researchDate??'Not researched yet'}. Research checkpoint: {job.sourceCount} retrieved pages.</p><p aria-live="polite">{job.status==='completed'?STAGES.length:job.stageIndex} of {STAGES.length} steps saved. {job.status==='queued'||job.status==='running'?'Progress updates automatically.':''}</p><ol aria-label="Generation progress">{STAGES.map((stage,i)=><li key={stage} aria-current={i===job.stageIndex&&job.status!=='completed'?'step':undefined} data-state={i<job.stageIndex||stage==='assemble'&&job.status==='completed'?'saved':i===job.stageIndex?job.status:'pending'}>{STAGE_TITLES[stage]} — {i<job.stageIndex||stage==='assemble'&&job.status==='completed'?'Saved':i===job.stageIndex?job.status:'Not started'}</li>)}</ol><p role="status">Job status: {job.status}{job.status==='queued'?' · Waiting for the local worker or its rate-limit window.':''}{job.status==='running'?' · Waiting for the worker to confirm this step.':''}</p>{job.error&&<p role="alert">{jobFailureMessages[job.error.code]??'The step did not complete. Saved sections remain available.'}</p>}{error&&<p role="alert">{error}</p>}<div className="share-actions"><button className="button" onClick={refresh} disabled={busy}>Refresh status</button>{(job.status==='paused'||job.status==='failed')&&<button className="button" onClick={resume} disabled={busy}>{busy?'Queuing step…':job.status==='failed'?'Retry failed step':'Resume automatic generation'}</button>}</div><p className="generation-help">Successful steps save their checkpoint and automatically queue the next step. Failures stop the job; only an explicit retry can try a failed step again. Completed sections are reused. Refreshing this page does not start generation. The worker waits at least one minute between model calls, with at most {WORKER_HOURLY_LIMIT} per hour.</p>{job.saved&&<><p>Complete guide saved.</p><CopyShareLink path={job.saved.path}/></>}
 {job.sections.map(s=>{const c=s.content;return <section className="generation-panel" key={s.key}><SectionTitle>{s.title}</SectionTitle><p>Saved {s.completedAt} · Passed structural and evidence checks; human review required.</p><GuideFragment content={c} sources={s.sources} detailLevel={inline?'h5':'h3'}/><p>Official sources:</p><ul>{s.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> · inspected {source.inspectedAt}</li>)}</ul></section>;})}
 {(job.status==='queued'||job.status==='running')&&<div className="generation-loading next-section-loader" role="status" aria-label="Current generation step"><span className="job-spinner" aria-hidden="true"/><strong>{job.status==='queued'?'Up next: ':job.stageIndex===0?'Researching: ':job.stageIndex===5?'Finalizing: ':'Generating: '}{STAGE_TITLES[STAGES[job.stageIndex]]}</strong>{job.status==='queued'?<QueueWait waiting={job.waiting}/>:<p>This step is running in the background. Its section will appear after the backend validates and saves it.</p>}</div>}
 </article>;
}
