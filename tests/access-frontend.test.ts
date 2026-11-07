import './helpers/dom';
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AppRouterContext,type AppRouterInstance} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {AccessForm} from '../components/access-form';
const original=globalThis.fetch;afterEach(()=>{cleanup();globalThis.fetch=original;});
function mount(refresh:()=>void){const router:AppRouterInstance={back(){},forward(){},push(){},replace(){},prefetch(){},refresh,bfcacheId:'offline'};render(createElement(AppRouterContext.Provider,{value:router},createElement(AccessForm)));}
test('access form unlocks once without generating, clears code and refreshes server state',async()=>{
 let calls=0,refreshes=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/access');assert.equal(options?.method,'POST');return Response.json({ok:true});};
 mount(()=>refreshes++);const user=userEvent.setup();assert.equal(screen.queryByRole('button',{name:'Generate Guide'}),null);await user.type(screen.getByLabelText('Access code'),'OFFLINE_ONLY_TEST_CODE');await user.click(screen.getByRole('button',{name:'Unlock generation'}));await waitFor(()=>assert.equal(refreshes,1));assert.equal(calls,1);assert.equal((screen.getByLabelText('Access code') as HTMLInputElement).value,'');
});
test('incorrect code and rate limits show safe messages with no automatic retry',async()=>{
 for(const status of [401,429]){let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({internal:'DO_NOT_DISPLAY'},{status});};mount(()=>assert.fail('must not unlock'));const user=userEvent.setup();await user.type(screen.getByLabelText('Access code'),'wrong');await user.click(screen.getByRole('button',{name:'Unlock generation'}));assert.match((await screen.findByRole('alert')).textContent!,status===401?/incorrect/:/15 minutes/);assert.equal(calls,1);assert.ok(!document.body.textContent?.includes('DO_NOT_DISPLAY'));cleanup();}
});
