'use client';
import {retainPartial,restorePartial} from '@/lib/recovery-client';
import {RECOVERY_TITLES,type RecoveryView} from '@/lib/generation/recovery-contract';
import {GuideFragment} from './guide-fragment';
import {CopyShareLink} from './copy-share-link';
import type {SavedGuideLink} from '@/lib/generated-guide-client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {OAuthGuide} from '@/lib/types';
import {requestGeneratedGuide} from '@/lib/generated-guide-client';
import {GuidePresentation} from './guide-presentation';
export function GeneratedGuideRequest({guides,suggestedProvider=''}:{guides:OAuthGuide[];suggestedProvider?:string}){
 const [partial,setPartial]=useState<RecoveryView|null>(null);
 useEffect(()=>{const previous=restorePartial();if(previous){setPartial(previous);setProvider(previous.provider);}},[]);
 const [provider,setProvider]=useState(suggestedProvider);const [website,setWebsite]=useState('');
 const [state,setState]=useState<'idle'|'loading'|'success'|'error'>('idle');
 const [saved,setSaved]=useState<SavedGuideLink|null>(null);
 const [guide,setGuide]=useState<OAuthGuide|null>(null);const [error,setError]=useState('');
 const active=useRef<AbortController|null>(null);const resultHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>{if(state==='success')resultHeading.current?.focus();},[state]);
 const match=guides.find(g=>[g.name,g.slug].some(name=>name.toLowerCase()===provider.trim().toLowerCase()));
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(active.current||match||partial)return;await run();
 }
 async function run(continuation?:string){
  if(active.current)return;
  if(!continuation&&!provider.trim()&&!website.trim()){setError('Enter a provider name or its official documentation website.');setState('error');return;}
  const controller=new AbortController();active.current=controller;setError('');setGuide(null);setSaved(null);setState('loading');if(!continuation){setPartial(null);retainPartial(null);}
  try{const result=await requestGeneratedGuide(continuation?{continuation}:{...provider.trim()?{provider:provider.trim()}:{},...website.trim()?{website:website.trim()}:{}},controller.signal);if(!controller.signal.aborted){if(result.partial){setPartial(result.partial);retainPartial(result.partial);setState('idle');}else{setGuide(result.guide);setSaved(result.saved);setPartial(null);retainPartial(null);setState('success');}}}
  catch(err){if(!controller.signal.aborted){setError(err instanceof Error?err.message:'Generation failed. No guide was displayed.');setState('error');}}
  finally{if(active.current===controller)active.current=null;}
 }
 return <section className="generation-panel" id="generate" aria-labelledby="generation-title">
  <p className="eyebrow">A PROVIDER OUTSIDE THE LIBRARY?</p><h2 id="generation-title">Generate an OAuth setup guide</h2>
  <p>Enter a provider and its official documentation website. We’ll research the documentation and prepare a source-backed guide for you to review.</p><p>AI-generated guidance may contain mistakes. Review its sources before implementation.</p>
  <form onSubmit={submit} aria-busy={state==='loading'}>
   <div className="generation-fields"><div><label htmlFor="generate-provider">Provider name <span>(optional with website)</span></label><input id="generate-provider" value={provider} maxLength={100} placeholder="For example, HubSpot" onChange={e=>setProvider(e.target.value)} disabled={state==='loading'||Boolean(partial)} /></div>
   <div><label htmlFor="generate-website">Official website or documentation URL <span>(recommended)</span></label><input id="generate-website" type="url" value={website} maxLength={1024} placeholder="https://developers.example.com/docs/oauth" onChange={e=>setWebsite(e.target.value)} disabled={state==='loading'||Boolean(partial)} aria-describedby="website-help" /></div></div>
   <p id="website-help" className="generation-help">Use a public HTTPS URL. Do not enter API keys, client secrets, credentials or token-bearing URLs.</p>
   {partial?<p>Continue the remaining sections below, or discard partial progress to start a different guide.</p>:match?<p className="static-match">Already in the library: <Link href={`/guides/${match.slug}`}>Open {match.name} guide →</Link></p>:<button className="button" type="submit" disabled={state==='loading'}>{state==='loading'?'Researching and generating…':'Generate Guide'}</button>}
  </form>
  <details className="generation-help"><summary>Usage limits and resumable generation</summary><p>This flow allows five requests per rolling hour per server process, at least one minute apart. Provider quotas are separate; failed requests may count. There are no automatic retries.</p><p>Need saved progress between sections? <Link href="/generate/stepwise">Use optional resumable generation</Link>. It requires a separately running worker and does not prevent provider outages.</p></details>
  {state==='loading'&&<div className="generation-loading" role="status"><strong>{partial?'Generating one remaining section.':'Research and guide generation are running.'}</strong><p>{partial?'Requesting one remaining section using the saved evidence. Completed sections remain below. ':''}This may take a couple of minutes. Waiting for the server to confirm the result; no OAuth setup or approval is being performed.</p></div>}
  {partial&&<article className="generated-result" aria-labelledby="partial-title"><h2 id="partial-title">{partial.provider} · Partial guide</h2><p className="guide-warning">AI-generated — Not human reviewed — Not end-to-end tested. Only sections that passed structural and evidence checks are shown. Human review is still required.</p><p>Research date: {partial.researchDate}. {partial.sections.length} of 8 sections retained in this browser tab. Continuation expires after two hours; no partial share link is created.</p>{partial.sections.map(section=><section className="generation-panel" key={section.key}><h3>{section.title}</h3><GuideFragment content={section.content} sources={partial.sources}/></section>)}<h3>Remaining sections</h3><ul>{partial.pending.map(key=><li key={key}>{RECOVERY_TITLES[key]} — not accepted yet</li>)}</ul>{partial.canContinue?<button className="button" disabled={state==='loading'} onClick={()=>run(partial.token)}>{state==='loading'?'Generating remaining section…':'Continue remaining sections'}</button>:<p>The combined guide still requires validation. No additional model request will run automatically.</p>}<button className="text-button" disabled={state==='loading'} onClick={()=>{setPartial(null);retainPartial(null);setError('');setState('idle');}}>Discard partial progress</button></article>}
  {state==='error'&&<div className="generation-error" role="alert"><strong>Guide not generated</strong><p>{error}</p><p>{partial?'Your accepted sections remain on this page. Continue explicitly when ready; a complete shareable guide is saved only after final validation.':'No validated partial sections were available. A complete guide is saved only after validation.'}</p><p>Your input is preserved. Nothing is retried automatically.</p></div>}
  {state==='success'&&guide&&<article className="generated-result" aria-labelledby="generated-result-title"><h2 id="generated-result-title" tabIndex={-1} ref={resultHeading}>Generated guide · review before use</h2><p className="generation-help">AI explanations are separate from official quotations below. {saved?'This guide is saved on this server. Reopen its link without generating it again.':'This guide exists only on this page and will be lost when you reload or leave.'} It has not undergone human review.</p><>{saved&&<CopyShareLink path={saved.path} />}</><button className="text-button" type="button" onClick={()=>{setSaved(null);setGuide(null);setState('idle');document.getElementById('generate-provider')?.focus();}}>Dismiss generated guide</button><GuidePresentation key={guide.slug} guide={guide} generated /></article>}
 </section>;
}
