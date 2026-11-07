'use client';
import {CopyShareLink} from './copy-share-link';
import type {SavedGuideLink} from '@/lib/generated-guide-client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {OAuthGuide} from '@/lib/types';
import {requestGeneratedGuide} from '@/lib/generated-guide-client';
import {GuidePresentation} from './guide-presentation';
export function GeneratedGuideRequest({guides,suggestedProvider=''}:{guides:OAuthGuide[];suggestedProvider?:string}){
 const [provider,setProvider]=useState(suggestedProvider);const [website,setWebsite]=useState('');
 const [state,setState]=useState<'idle'|'loading'|'success'|'error'>('idle');
 const [saved,setSaved]=useState<SavedGuideLink|null>(null);
 const [guide,setGuide]=useState<OAuthGuide|null>(null);const [error,setError]=useState('');
 const active=useRef<AbortController|null>(null);const resultHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{if(state==='success')resultHeading.current?.focus();},[state]);
 const match=guides.find(g=>[g.name,g.slug].some(name=>name.toLowerCase()===provider.trim().toLowerCase()));
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(active.current||match)return;
  if(!provider.trim()&&!website.trim()){setError('Enter a provider name or its official documentation website.');setState('error');return;}
  const controller=new AbortController();active.current=controller;setError('');setGuide(null);setSaved(null);setState('loading');
  try{const result=await requestGeneratedGuide({...provider.trim()?{provider:provider.trim()}:{},...website.trim()?{website:website.trim()}:{}},controller.signal);if(!controller.signal.aborted){setGuide(result.guide);setSaved(result.saved);setState('success');}}
  catch(err){if(!controller.signal.aborted){setError(err instanceof Error?err.message:'Generation failed. No guide was displayed.');setState('error');}}
  finally{if(active.current===controller)active.current=null;}
 }
 return <section className="generation-panel" id="generate" aria-labelledby="generation-title">
  <p className="eyebrow">A PROVIDER OUTSIDE THE LIBRARY?</p><h2 id="generation-title">Generate an OAuth setup guide</h2>
  <p>Enter a provider and its official documentation website. We’ll research the documentation and prepare a source-backed guide for you to review.</p><p>AI-generated guidance may contain mistakes. Review its sources before implementation.</p>
  <form onSubmit={submit} aria-busy={state==='loading'}>
   <div className="generation-fields"><div><label htmlFor="generate-provider">Provider name <span>(optional with website)</span></label><input id="generate-provider" value={provider} maxLength={100} placeholder="For example, HubSpot" onChange={e=>setProvider(e.target.value)} disabled={state==='loading'} /></div>
   <div><label htmlFor="generate-website">Official website or documentation URL <span>(recommended)</span></label><input id="generate-website" type="url" value={website} maxLength={1024} placeholder="https://developers.example.com/docs/oauth" onChange={e=>setWebsite(e.target.value)} disabled={state==='loading'} aria-describedby="website-help" /></div></div>
   <p id="website-help" className="generation-help">Use a public HTTPS URL. Do not enter API keys, client secrets, credentials or token-bearing URLs.</p>
   {match?<p className="static-match">Already in the library: <Link href={`/guides/${match.slug}`}>Open {match.name} guide →</Link></p>:<button className="button" type="submit" disabled={state==='loading'}>{state==='loading'?'Researching and generating…':'Generate Guide'}</button>}
  </form>
  <details className="generation-help"><summary>Usage limits and resumable generation</summary><p>This flow allows five requests per rolling hour per server process, at least one minute apart. Provider quotas are separate; failed requests may count. There are no automatic retries.</p><p>Need saved progress between sections? <Link href="/generate/stepwise">Use optional resumable generation</Link>. It requires a separately running worker and does not prevent provider outages.</p></details>
  {state==='loading'&&<div className="generation-loading" role="status"><strong>Research and guide generation are running.</strong><p>This may take a couple of minutes. Waiting for the server to confirm the result; no OAuth setup or approval is being performed.</p></div>}
  {state==='error'&&<div className="generation-error" role="alert"><strong>Guide not generated</strong><p>{error}</p><p>Completed guides are saved only after validation. No partial guide was accepted.</p><p>Your input is preserved. Nothing is retried automatically.</p></div>}
  {state==='success'&&guide&&<article className="generated-result" aria-labelledby="generated-result-title"><h2 id="generated-result-title" tabIndex={-1} ref={resultHeading}>Generated guide · review before use</h2><p className="generation-help">AI explanations are separate from official quotations below. {saved?'This guide is saved on this server. Reopen its link without generating it again.':'This guide exists only on this page and will be lost when you reload or leave.'} It has not undergone human review.</p><>{saved&&<CopyShareLink path={saved.path} />}</><button className="text-button" type="button" onClick={()=>{setSaved(null);setGuide(null);setState('idle');document.getElementById('generate-provider')?.focus();}}>Dismiss generated guide</button><GuidePresentation key={guide.slug} guide={guide} generated /></article>}
 </section>;
}
