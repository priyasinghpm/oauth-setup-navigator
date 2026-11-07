import './helpers/dom';
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {GeneratedGuideRequest} from '../components/generated-guide-request';
import {guides} from '../lib/guides';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {recoverSections,recoveryView,signRecovery} from '../lib/generation/recovery';
import {GENERATION_MODEL} from '../lib/generation/types';
import {PARTIAL_STORAGE_KEY,retainPartial} from '../lib/recovery-client';
const savedFetch=globalThis.fetch;
afterEach(()=>{cleanup();window.sessionStorage.clear();globalThis.fetch=savedFetch;});
function partial(){const p=prepareGeneration(input()),draft=fixture(p);draft.guide.scopes=[];const state=recoverSections(draft,p,GENERATION_MODEL)!;return recoveryView(state,signRecovery(state,'OFFLINE_ONLY_RECOVERY_SIGNING_SECRET_12345'));}
test('homepage shows validated partial sections and continues explicitly without restarting research or hiding progress',async()=>{
 const view=partial();let calls=0,finish!:()=>void;const gate=new Promise<void>(r=>finish=r);
 globalThis.fetch=async(_,options)=>{calls++;if(calls===1)return Response.json({ok:true,status:'partial-draft',partial:view},{status:202});assert.equal(new Headers(options?.headers).get('X-Guide-Continuation'),'1');assert.deepEqual(JSON.parse(String(options?.body)),{continuation:view.token});await gate;return Response.json({ok:false,error:{code:'gemini-quota'}},{status:429});};
 render(createElement(GeneratedGuideRequest,{guides}));const user=userEvent.setup();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByRole('heading',{name:'Example · Partial guide'});assert.ok(screen.getAllByText(/Official documentation excerpt/).length);assert.ok(screen.getByText(/7 of 8 sections/));assert.ok(window.sessionStorage.getItem(PARTIAL_STORAGE_KEY));assert.equal(calls,1);
 await user.click(screen.getByRole('button',{name:'Continue remaining sections'}));assert.ok(screen.getByRole('heading',{name:'Example · Partial guide'}));assert.ok(screen.getByRole('button',{name:'Generating remaining section…'}).hasAttribute('disabled'));finish();await screen.findByRole('alert');assert.ok(screen.getByRole('heading',{name:'Example · Partial guide'}));assert.equal(calls,2);
});
test('refresh restores partials without any POST; invalid responses never display model leftovers',async()=>{
 const view=partial();retainPartial(view);let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Must not fetch on restore');};const rendered=render(createElement(GeneratedGuideRequest,{guides}));await screen.findByRole('heading',{name:'Example · Partial guide'});assert.equal(calls,0);rendered.unmount();
 window.sessionStorage.clear();globalThis.fetch=async()=>Response.json({ok:true,status:'partial-draft',partial:{...view,oauthTestStatus:'tested',provider:'UNSAFE_OUTPUT'}});
 render(createElement(GeneratedGuideRequest,{guides}));const user=userEvent.setup();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByRole('alert');assert.equal(screen.queryByText(/UNSAFE_OUTPUT/),null);assert.equal(screen.queryByRole('button',{name:'Continue remaining sections'}),null);
});
test('successful continuation replaces partials with a complete guide and clears browser checkpoint',async()=>{
 const view=partial();retainPartial(view);const p=prepareGeneration(input());const {validateGeneratedGuide}=await import('../lib/generation/validate');const {guide}=validateGeneratedGuide(fixture(p),p);let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide});};
 render(createElement(GeneratedGuideRequest,{guides}));await screen.findByRole('button',{name:'Continue remaining sections'});await userEvent.setup().click(screen.getByRole('button',{name:'Continue remaining sections'}));await screen.findByRole('heading',{name:'Generated guide · review before use'});assert.equal(calls,1);assert.equal(window.sessionStorage.getItem(PARTIAL_STORAGE_KEY),null);assert.equal(screen.queryByRole('heading',{name:'Example · Partial guide'}),null);
});
