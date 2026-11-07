import './helpers/dom';
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {GenerationJobView} from '../components/generation-job';
import {QueuedGuideRequest} from '../components/queued-guide-request';
import {guides} from '../lib/guides';
import {queueInput,sectionReply} from './helpers/queue';
import {prepareJobSection,buildSectionRequest,validateJobSection} from '../lib/jobs/sections';
import {SECTION_KEYS,STAGE_TITLES,type JobView} from '../lib/jobs/types';
import {ACTIVE_JOB_KEY,readJobPointer} from '../lib/jobs/browser-state';
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;window.localStorage.clear();window.history.replaceState(null,'','/');});
function view():JobView{const p=prepareJobSection(queueInput(),'foundation'),draft=JSON.parse(sectionReply(buildSectionRequest(p,'foundation')).text);return {id:'00000000-0000-4000-8000-000000000001',status:'paused',stageIndex:2,provider:'Example',createdAt:'2026-11-06T00:00:00.000Z',updatedAt:'2026-11-06T00:00:00.000Z',attempts:2,researchDate:p.researchedAt,sourceCount:1,sections:[{key:'foundation',title:'Registration, prerequisites and permissions',completedAt:'2026-11-06T00:00:00.000Z',content:validateJobSection(draft,p,'foundation'),sources:p.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt}))}],reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};}
test('legacy paused job resumes automatic processing only on user action',async()=>{
 const initial=view();let posts=0;
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'/api/guides/jobs/'+initial.id+'/resume');assert.equal(options?.method,'POST');posts++;return Response.json({ok:true,job:{...initial,status:'queued'}});};
 const user=userEvent.setup();render(createElement(GenerationJobView,{initial}));
 assert.ok(screen.getByRole('heading',{name:'Example · stepwise guide'}));assert.ok(screen.getByText(/Not human reviewed/));assert.ok(screen.getAllByText(/Official documentation excerpt/).length);assert.equal(posts,0);
 await user.click(screen.getByRole('button',{name:'Resume automatic generation'}));assert.equal(posts,1);
 await waitFor(()=>assert.ok(screen.getByText(/Waiting for the local worker/)));assert.equal(screen.queryByRole('button',{name:'Resume automatic generation'}),null);
});
test('failed jobs preserve completed sections and never retry until explicitly requested',async()=>{
 const initial={...view(),status:'failed' as const,error:{code:'invalid-section',stage:'authorization' as const}};let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true,job:{...initial,status:'queued',error:undefined}});};
 const user=userEvent.setup();render(createElement(GenerationJobView,{initial}));assert.equal(calls,0);assert.ok(screen.getByText(/Completed sections are preserved/));assert.ok(screen.getByRole('heading',{name:'Registration, prerequisites and permissions'}));
 await user.click(screen.getByRole('button',{name:'Retry failed step'}));assert.equal(calls,1);
});
test('one Generate Guide action starts a background job and renders progress inline',async()=>{
 let calls=0;globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/guides/jobs');assert.equal(options?.method,'POST');calls++;return Response.json({ok:true,job:{...view(),status:'queued',sections:[],stageIndex:0}});};
 const user=userEvent.setup();render(createElement(QueuedGuideRequest,{guides}));await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));
 await waitFor(()=>assert.equal(screen.getByRole('link',{name:'Open saved progress →'}).getAttribute('href'),'/jobs/'+view().id));assert.equal(calls,1);assert.ok(screen.getByRole('heading',{name:'Example OAuth setup guide'}));assert.ok(screen.getByRole('status',{name:'Current generation step'}));
});
test('static providers retain permanent routes and do not queue duplicate jobs',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call');};const user=userEvent.setup();render(createElement(QueuedGuideRequest,{guides}));await user.type(screen.getByLabelText(/Provider name/),'Slack');assert.equal(screen.getByRole('link',{name:'Open existing Slack guide →'}).getAttribute('href'),'/guides/slack');assert.equal(screen.queryByRole('button',{name:'Generate Guide'}),null);assert.equal(calls,0);
});
test('safe disabled error keeps inputs and never displays raw diagnostics',async()=>{
 globalThis.fetch=async()=>Response.json({ok:false,error:{code:'generation-disabled',message:'SECRET_STACK'}},{status:503});const user=userEvent.setup();render(createElement(QueuedGuideRequest,{guides}));await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await waitFor(()=>assert.match(screen.getByRole('alert').textContent??'',/disabled/));assert.equal(screen.getByLabelText(/Provider name/).getAttribute('value'),'Example');assert.equal(document.body.textContent?.includes('SECRET_STACK'),false);
});

test('automatic status polling displays running stages and saved partials, then stops on failure without POST requests',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const initial={...view(),status:'queued' as const};
 const authInput=prepareJobSection(queueInput(),'authorization');
 const auth={key:'authorization' as const,title:'Authorization and token exchange',completedAt:'2026-11-06T00:00:02.000Z',content:validateJobSection(JSON.parse(sectionReply(buildSectionRequest(authInput,'authorization')).text),authInput,'authorization'),sources:authInput.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt}))};
 const replies=[{...initial,status:'running',updatedAt:'2026-11-06T00:00:01.000Z'},{...initial,stageIndex:3,sections:[...initial.sections,auth],updatedAt:'2026-11-06T00:00:02.000Z'},{...initial,status:'failed',stageIndex:3,sections:[...initial.sections,auth],error:{code:'invalid-section',stage:'renewal'},updatedAt:'2026-11-06T00:00:03.000Z'}];
 let gets=0;globalThis.fetch=async(_url,options)=>{assert.equal(options?.method,'GET');return Response.json({ok:true,job:replies[gets++]});};
 render(createElement(GenerationJobView,{initial}));assert.equal(screen.queryByRole('button',{name:'Resume automatic generation'}),null);
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByText(/Job status: running/));
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByRole('heading',{name:'Authorization and token exchange'}));assert.ok(screen.getByText(/3 of 6 steps saved/));
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByRole('button',{name:'Retry failed step'}));assert.ok(screen.getByText(/Job status: failed/));
 await act(async()=>{t.mock.timers.tick(10000);});assert.equal(gets,3);cleanup();t.mock.timers.reset();
});

test('read-only progress polling recovers from network failure without retrying generation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const initial={...view(),status:'queued' as const};let gets=0;
 globalThis.fetch=async(_url,options)=>{assert.equal(options?.method,'GET');gets++;if(gets===1)throw Error('PRIVATE_NETWORK_DETAIL');return Response.json({ok:true,job:{...initial,status:'completed',stageIndex:5,saved:{id:initial.id,path:'/guides/'+initial.id},updatedAt:'2026-11-06T00:00:10.000Z'}});};
 render(createElement(GenerationJobView,{initial}));
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByText(/Status updates are temporarily unavailable/));assert.equal(document.body.textContent?.includes('PRIVATE_NETWORK_DETAIL'),false);
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByText(/Job status: completed/));assert.ok(screen.getByRole('link',{name:'Open saved guide →'}));assert.ok(screen.getByText(/6 of 6 steps saved/));
 await act(async()=>{t.mock.timers.tick(10000);});assert.equal(gets,2);cleanup();t.mock.timers.reset();
});

test('homepage restores progress with GET only, renders new sections below the form, and keeps completion visible',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const initial={...view(),status:'running' as const};window.localStorage.setItem(ACTIVE_JOB_KEY,initial.id);
 const sections:JobView['sections']=SECTION_KEYS.map(key=>{const input=prepareJobSection(queueInput(),key);return {key,title:STAGE_TITLES[key],completedAt:'2026-11-06T00:00:01.000Z',content:validateJobSection(JSON.parse(sectionReply(buildSectionRequest(input,key)).text),input,key),sources:input.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt}))};});
 const updates=[initial,{...initial,status:'queued',stageIndex:3,sections:sections.slice(0,2),updatedAt:'2026-11-06T00:00:02.000Z'},{...initial,status:'completed',stageIndex:5,sections,saved:{id:initial.id,path:'/guides/'+initial.id},updatedAt:'2026-11-06T00:00:03.000Z'}];
 let gets=0;globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/guides/jobs/'+initial.id);assert.equal(options?.method,'GET');return Response.json({ok:true,job:updates[gets++]});};
 await act(async()=>{render(createElement(QueuedGuideRequest,{guides}));});
 assert.ok(screen.getByRole('heading',{name:'Example OAuth setup guide'}));assert.ok(screen.getByRole('heading',{name:'Registration, prerequisites and permissions'}));assert.ok(screen.getByRole('status',{name:'Current generation step'}));
 assert.equal(screen.getByRole('button',{name:'Generating…'}).hasAttribute('disabled'),true);assert.equal(new URL(window.location.href).searchParams.get('job'),initial.id);assert.equal(gets,1);
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByRole('heading',{name:'Authorization and token exchange'}));assert.match(screen.getByRole('status',{name:'Current generation step'}).textContent??'',/Token renewal/);
 await act(async()=>{t.mock.timers.tick(2000);});assert.ok(screen.getByText('Complete guide saved.'));assert.equal(screen.queryByRole('status',{name:'Current generation step'}),null);assert.equal(screen.getByRole('link',{name:'Open saved guide →'}).getAttribute('href'),'/guides/'+initial.id);assert.ok(screen.getByRole('heading',{name:'Token renewal'}));assert.ok(screen.getByRole('heading',{name:'Distribution, approval and troubleshooting'}));
 await act(async()=>{t.mock.timers.tick(10000);});assert.equal(gets,3);
 cleanup();t.mock.timers.reset();
});

test('homepage reconnects to an explicit job URL and never posts on reload',async()=>{
 const saved={...view(),status:'completed' as const,stageIndex:5,saved:{id:view().id,path:'/guides/'+view().id}};
 window.history.replaceState(null,'','/?job='+saved.id+'#generate');let gets=0;
 globalThis.fetch=async(url,options)=>{assert.equal(options?.method,'GET');assert.equal(url,'/api/guides/jobs/'+saved.id);gets++;return Response.json({ok:true,job:saved});};
 const rendered=render(createElement(QueuedGuideRequest,{guides}));await screen.findByText('Complete guide saved.');rendered.unmount();render(createElement(QueuedGuideRequest,{guides}));await screen.findByText('Complete guide saved.');assert.equal(gets,2);assert.equal(window.localStorage.getItem(ACTIVE_JOB_KEY),saved.id);
});

test('invalid browser job pointers cannot trigger an arbitrary URL request',()=>{
 window.localStorage.setItem(ACTIVE_JOB_KEY,'https://evil.example/job');window.history.replaceState(null,'','/?job=../../private');assert.equal(readJobPointer(),null);
});

test('queued UI shows the measured quota wait instead of an unexplained spinner',()=>{
 const initial={...view(),status:'queued' as const,waiting:{reason:'rate-limit' as const,worker:'running' as const,quotaUsed:10,quotaLimit:10 as const,retryAfterSeconds:1320,retryAt:'2026-11-06T19:41:22.113Z'}};
 render(createElement(GenerationJobView,{initial}));assert.ok(screen.getByText('Hourly local request limit reached.'));assert.ok(screen.getByText(/About 22 minutes remain/));assert.ok(screen.getByText(/Local attempts this hour: 10 \/ 10/));assert.ok(screen.getByText(/Background worker: running/));assert.equal(screen.queryByRole('button',{name:'Retry failed step'}),null);
});

test('generation form visibly explains the shared local limit and retry accounting',()=>{
 render(createElement(QueuedGuideRequest,{guides}));assert.ok(screen.getByText(/Local generation limit: 10 model attempts per rolling hour/));assert.ok(screen.getByText(/including a failed attempt or an explicit retry/));assert.ok(screen.getByText(/Gemini has separate provider quotas/));
});
