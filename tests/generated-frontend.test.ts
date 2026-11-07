import './helpers/dom';
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {GeneratedGuideRequest} from '../components/generated-guide-request';
import {ProviderDirectory} from '../components/provider-directory';
import {GuidePresentation} from '../components/guide-presentation';
import {guides} from '../lib/guides';
import {createGenerateHandler} from '../lib/api/generate-guide';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {input,fixture,doc} from './helpers/generation';
const savedFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=savedFetch;});
function form(){return render(createElement(GeneratedGuideRequest,{guides}));}
function mockApi(wait?:Promise<void>){
 let calls=0,modelCalls=0;
 const handler=createGenerateHandler({enabled:()=>true,configured:()=>true,research:async()=>{await wait;return input().research;},generate:i=>generateWithTransport(i,async()=>{modelCalls++;return {text:JSON.stringify(fixture(prepareGeneration(i))),finishReason:'STOP'};})});
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/guides/generate');assert.equal(options?.method,'POST');return handler(new Request('http://localhost:3000/api/guides/generate',options));};
 return ()=>({calls,modelCalls});
}
test('form integrates with mocked research/model through the real API handler; loading, exact excerpts and unknown approval remain distinct',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});const counts=mockApi(gate);const user=userEvent.setup();const view=form();
 await user.type(screen.getByLabelText(/Provider name/),'Example');await user.type(screen.getByLabelText(/Official website/),'https://docs.example.com');await user.click(screen.getByRole('button',{name:'Generate Guide'}));
 assert.match(screen.getByRole('status').textContent!,/Research and guide generation are running/);assert.equal(screen.getByRole('button',{name:/Researching and generating/}).hasAttribute('disabled'),true);assert.equal(view.container.querySelector('progress'),null);assert.deepEqual(counts(),{calls:1,modelCalls:0});
 finish();await screen.findByRole('heading',{name:'Generated guide · review before use'});
 assert.ok(screen.getByText('AI-generated — Not end-to-end tested'));assert.ok(screen.getByText(/It has not undergone human review/));assert.ok(screen.getAllByText('Needs confirmation').length);
 const block=view.container.querySelector('blockquote p');assert.equal(block?.textContent,doc);assert.ok(screen.getAllByText(/Official documentation excerpt/).length);
 assert.equal(screen.getByRole('heading',{name:'Generated guide · review before use'}),document.activeElement);
 const context=view.container.querySelector<HTMLDetailsElement>('.official-excerpt details')!;await user.click(context.querySelector('summary')!);assert.equal(context.open,true);
 assert.equal(context.querySelector('mark')?.textContent,doc);assert.ok(view.container.querySelector('figcaption a[href="https://docs.example.com/oauth"]'));
 assert.equal(screen.queryByText('Research and guide generation are running.'),null);
 assert.deepEqual(counts(),{calls:1,modelCalls:1});
 await user.click(screen.getByRole('button',{name:'Dismiss generated guide'}));assert.equal(screen.queryByText('AI-generated — Not end-to-end tested'),null);assert.equal(document.activeElement,screen.getByLabelText(/Provider name/));
});
test('structured failures show safe actionable messages and never display server diagnostics or audited fallback',async()=>{
 for(const [code,expected] of [['cross-origin',/page address does not match the API request origin/],['generation-disabled',/Live generation is disabled/],['official-website-required',/Add the provider/],['documentation-unavailable',/No usable public documentation/],['research-timeout',/retrieval timed out/],['generation-timeout',/Generation timed out/],['request-limit',/local request limit/],['gemini-quota',/quota is exhausted/],['guide-validation-failed',/failed schema or evidence/],['invalid-output',/invalid structured output/],['pipeline-failed',/could not be generated/]] as const){
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({ok:false,error:{code,message:'secret-key-stack-trace',nextAction:'private diagnostic'}},{status:code==='gemini-quota'?429:503});};
  form();const user=userEvent.setup();await user.type(screen.getByLabelText(/Provider name/),'HubSpot');await user.click(screen.getByRole('button',{name:'Generate Guide'}));const alert=await screen.findByRole('alert');assert.match(alert.textContent!,expected);assert.doesNotMatch(document.body.textContent!,/secret-key-stack-trace|private diagnostic/);assert.equal(screen.queryByText('AI-generated — Not end-to-end tested'),null);assert.equal(calls,1);assert.equal((screen.getByLabelText(/Provider name/) as HTMLInputElement).value,'HubSpot');cleanup();
 }
});
test('empty input and existing static providers avoid generation; original routes and guide headings remain',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('must not call');};const user=userEvent.setup();form();
 await user.click(screen.getByRole('button',{name:'Generate Guide'}));assert.match(screen.getByRole('alert').textContent!,/Enter a provider/);
 for(const guide of guides){await user.clear(screen.getByLabelText(/Provider name/));await user.type(screen.getByLabelText(/Provider name/),guide.name);assert.equal(screen.getByRole('link',{name:`Open ${guide.name} guide →`}).getAttribute('href'),`/guides/${guide.slug}`);assert.equal(screen.queryByRole('button',{name:'Generate Guide'}),null);}
 assert.equal(calls,0);cleanup();
 for(const guide of guides){render(createElement(GuidePresentation,{guide}));assert.ok(screen.getByRole('heading',{level:1,name:guide.name}));assert.ok(screen.getByText('Source-backed guide'));assert.equal(screen.queryByText('AI-generated — Not end-to-end tested'),null);if(guide.slug!=='google-calendar'){assert.ok(screen.getByRole('heading',{name:'Before you begin'}));assert.ok(screen.getByText('Start here · step 1'));}cleanup();}
});
test('homepage directory retains case-insensitive combined search, no-results generation link and reset',async()=>{
 render(createElement(ProviderDirectory,{guides}));const user=userEvent.setup();assert.equal(document.querySelectorAll('.provider-card').length,3);
 await user.type(screen.getByLabelText('Find your provider'),'sLaCk');assert.equal(document.querySelectorAll('.provider-card').length,1);await user.selectOptions(screen.getByLabelText('Provider'),'notion');assert.ok(screen.getByText('No providers found'));assert.equal(screen.getByRole('link',{name:/Generate a guide for another/}).getAttribute('href'),'#stepwise-generation');await user.click(screen.getByRole('button',{name:'Reset search and filters'}));assert.equal(document.querySelectorAll('.provider-card').length,3);
});
test('network failures and malformed success responses do not cause automatic retry or partial rendering',async()=>{
 for(const response of [async()=>{throw new Error('secret transport diagnostic');},async()=>Response.json({ok:true,status:'generated-draft',guide:{name:'Unsafe partial guide'}})]){
  let calls=0;globalThis.fetch=async()=>{calls++;return response();};form();const user=userEvent.setup();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByRole('alert');assert.equal(calls,1);assert.equal(screen.queryByText('Unsafe partial guide'),null);assert.doesNotMatch(document.body.textContent!,/secret transport diagnostic/);cleanup();
 }
});
test('website-only keyboard submission works and generated state disappears on unmount',async()=>{
 const counts=mockApi();const user=userEvent.setup();const view=form();
 await user.click(screen.getByLabelText(/Official website/));await user.type(screen.getByLabelText(/Official website/),'https://docs.example.com');await user.keyboard('{Enter}');
 await screen.findByText('AI-generated — Not end-to-end tested');assert.ok(screen.getByRole('heading',{name:'example.com'}));assert.equal(view.container.querySelector('time')?.getAttribute('datetime'),'2026-11-03');assert.deepEqual(counts(),{calls:1,modelCalls:1});
 assert.equal(screen.getByRole('link',{name:'← Back to provider directory'}).getAttribute('href'),'#providers');view.unmount();form();assert.equal(screen.queryByText('AI-generated — Not end-to-end tested'),null);assert.equal((screen.getByLabelText(/Official website/) as HTMLInputElement).value,'');
});
test('generated evidence offers direct source links and cautious labels while static labels remain unchanged',async()=>{
 const counts=mockApi();form();const user=userEvent.setup();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByText('AI-generated — Not end-to-end tested');
 assert.ok(screen.getAllByText('Cites retrieved documentation · relevance needs review').length);
 assert.ok(document.querySelector('.claim-evidence > a[href="https://docs.example.com/oauth"][target="_blank"]'));
 assert.ok(screen.getByLabelText('OAuth lifecycle coverage'));assert.match(screen.getByLabelText('OAuth lifecycle coverage').textContent!,/Token renewal/);assert.match(screen.getByLabelText('OAuth lifecycle coverage').textContent!,/not semantic verification/);
 assert.ok(screen.getAllByText(/Research date: 2026-11-03/).length);assert.doesNotMatch(document.body.textContent!,/officially verified|provider approved/i);assert.deepEqual(counts(),{calls:1,modelCalls:1});
 cleanup();render(createElement(GuidePresentation,{guide:guides[0]}));assert.ok(screen.getAllByText('Officially documented').length);assert.equal(screen.queryByLabelText('OAuth lifecycle coverage'),null);
});
test('persisted generation offers a safe saved URL and copy action without a second API request',async()=>{
 const user=userEvent.setup();const i=input();const result=await generateWithTransport(i,async()=>({text:JSON.stringify(fixture(prepareGeneration(i)))}));assert.ok(result.ok);
 const id='00000000-0000-4000-8000-000000000000',path=`/guides/${id}`;let calls=0;let copied='';
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide:result.guide,saved:{id,path,createdAt:'2026-11-05T00:00:00.000Z'}});};
 form();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByRole('button',{name:'Copy Share Link'});
 assert.match(document.body.textContent!,/saved on this server/);assert.equal(screen.getByRole('link',{name:'Open saved guide →'}).getAttribute('href'),path);await user.click(screen.getByRole('button',{name:'Copy Share Link'}));assert.equal(copied,`http://localhost:3000${path}`);assert.ok(screen.getByText('Share link copied.'));assert.equal(calls,1);
});
test('invalid saved URLs cannot become share links, and clipboard failure gives a usable fallback',async()=>{
 const user=userEvent.setup();const i=input();const r=await generateWithTransport(i,async()=>({text:JSON.stringify(fixture(prepareGeneration(i)))}));assert.ok(r.ok);
 const id='00000000-0000-4000-8000-000000000000';globalThis.fetch=async()=>Response.json({ok:true,status:'generated-draft',reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested',guide:r.guide,saved:{id,path:'https://attacker.example',createdAt:'2026-11-05T00:00:00.000Z'}});
 form();await user.type(screen.getByLabelText(/Provider name/),'Example');await user.click(screen.getByRole('button',{name:'Generate Guide'}));await screen.findByRole('alert');assert.equal(screen.queryByRole('button',{name:'Copy Share Link'}),null);cleanup();
 const {CopyShareLink}=await import('../components/copy-share-link');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('clipboard unavailable');}}});render(createElement(CopyShareLink,{path:`/guides/${id}`}));await user.click(screen.getByRole('button',{name:'Copy Share Link'}));assert.match(screen.getByRole('status').textContent!,/Open the saved guide/);assert.equal(screen.getByRole('link',{name:'Open saved guide →'}).getAttribute('href'),`/guides/${id}`);
});

test('each static guide exposes Copy Link near its title with its permanent URL',async()=>{
 const user=userEvent.setup();let copied='';
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 for(const guide of guides){
  render(createElement(GuidePresentation,{guide}));
  const button=screen.getByRole('button',{name:'Copy Link'});
  assert.ok(button.closest('.guide-hero')?.querySelector('h1'));
  assert.equal(screen.queryByRole('link',{name:'Open saved guide →'}),null);
  await user.click(button);assert.equal(copied,`http://localhost:3000/guides/${guide.slug}`);
  assert.ok(screen.getByText('Share link copied.'));cleanup();
 }
});

test('standard form is clean and resumable generation remains optional',()=>{
 form();assert.ok(screen.getByRole('heading',{name:'Generate an OAuth setup guide'}));assert.equal(screen.getByRole('link',{name:'Use optional resumable generation'}).getAttribute('href'),'/generate/stepwise');assert.equal(screen.queryByText(/older single-request flow/),null);assert.ok(screen.getByRole('button',{name:'Generate Guide'}));
});
