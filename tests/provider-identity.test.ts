// Offline identity/source binding tests with mocked Gemini output.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {generateWithTransport} from '../lib/generation/generate';
import {buildGenerationRequest} from '../lib/generation/prompt';
function hubspot(provider='HubSpot'){
 const i=input();i.provider=provider;i.slug='hubspot';i.research.website='https://developers.hubspot.com';
 const page=i.research.pages[0];page.url='https://developers.hubspot.com/docs/oauth';page.requestedUrl=page.url;page.title='HubSpot OAuth setup';page.text='Create a HubSpot app in the developer dashboard. Configure OAuth redirect URI and read scope before backend authorization code exchange.';i.research.requests[0].url=page.url;return i;
}
test('exact HubSpot identity retains source evidence, uncertainties and not-tested status',async()=>{
 const i=hubspot(),p=prepareGeneration(i),f=fixture(p);const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(r.ok);assert.equal(r.guide.name,'HubSpot');assert.equal(r.guide.slug,'hubspot');assert.equal(r.guide.oauthTestStatus,'not-tested');assert.equal(r.guide.approvalSummary.evidence.status,'unknown');assert.equal(r.guide.steps[0].evidence.quotations![0].quote,p.sources[0].excerpts[0].quote);assert.equal(r.guide.steps[0].evidence.quotations![0].sourceUrl,p.sources[0].url);
});
test('backend canonicalizes only harmless returned name variations and leaves model content untouched',async()=>{
 for(const name of ['hubspot','HUBSPOT',' HubSpot ','Hub Spot','Hub-Spot','HubSpot OAuth','HubSpot OAuth 2.0','HubSpot OAuth setup guide','HubSpot OAuth 2.0 setup guide']){
  const i=hubspot(),p=prepareGeneration(i),f=fixture(p);f.guide.name=name;const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(r.ok,name);assert.equal(r.guide.name,'HubSpot');assert.equal(r.guide.summary,f.guide.summary);assert.equal(r.guide.steps[0].description,f.guide.steps[0].description);assert.equal(f.guide.name,name);
 }
 for(const requested of ['hubspot',' HUBSPOT ','hubspot.com']){
  const p=prepareGeneration(hubspot(requested));assert.equal(p.provider,'HubSpot');assert.equal(JSON.parse(buildGenerationRequest(p).contents).identity.provider,'HubSpot');
 }
});
test('different or ambiguous provider identities remain rejected rather than relabeled',async()=>{
 for(const name of ['Slack','Notion','Not HubSpot','HubSpot / Slack','HubSpot alternative','HubSpoot','HubSpot OAuth for Slack']){
  const i=hubspot(),f=fixture(prepareGeneration(i));f.guide.name=name;const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok,name);assert.equal(r.error,'invalid-guide');assert.equal(r.diagnostic?.code,'guide-identity-mismatch');assert.equal(r.diagnostic?.fieldPath,'name');assert.equal(f.guide.name,name);
 }
});
test('HubSpot requests with another provider sources fail before any model request',async()=>{
 const i=hubspot();i.research.website='https://docs.slack.dev';i.research.pages[0].url='https://docs.slack.dev/oauth';i.research.pages[0].requestedUrl=i.research.pages[0].url;i.research.requests[0].url=i.research.pages[0].url;
 let calls=0;const r=await generateWithTransport(i,async()=>{calls++;return {text:'{}'};});assert.ok(!r.ok);assert.equal(r.error,'invalid-input');assert.equal(calls,0);
 const falseName=hubspot('Slack');const wrong=await generateWithTransport(falseName,async()=>{calls++;return {text:'{}'};});assert.ok(!wrong.ok);assert.equal(calls,0);
});
test('foreign-provider setup content cannot be accepted merely by copying the correct title or a harmless suffix',async()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.guide.steps[0].description='Create a Slack app in the Slack dashboard.';},
  (f:ReturnType<typeof fixture>)=>{f.guide.steps[0].title='Register an application in Notion';},
  (f:ReturnType<typeof fixture>)=>{f.guide.summary='Slack OAuth setup guide for your workspace.';},
 ]){
  const i=hubspot(),f=fixture(prepareGeneration(i));f.guide.name='HubSpot OAuth';change(f);const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok);assert.equal(r.diagnostic?.code,'guide-provider-content-mismatch');assert.equal(f.guide.name,'HubSpot OAuth');
 }
});
test('slug/date mismatches, unknown references and unsupported approval assertions remain failures',async()=>{
 for(const change of [
  (f:ReturnType<typeof fixture>)=>{f.guide.slug='slack';},
  (f:ReturnType<typeof fixture>)=>{f.guide.lastResearchedAt='2026-11-04';},
  (f:ReturnType<typeof fixture>)=>{f.guide.steps[0].evidence.evidenceIds=['e999'];},
  (f:ReturnType<typeof fixture>)=>{f.guide.approvalWaitingTime.text='It takes 3 days.';},
 ]){
  const i=hubspot(),f=fixture(prepareGeneration(i));f.guide.name='HubSpot OAuth guide';change(f);const r=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!r.ok);assert.equal(r.error,'invalid-guide');
 }
});
test('a domain alone does not silently infer a particular product from a reviewed documentation path',()=>{
 const i=input();i.provider='google.com';i.slug='google';i.research.website='https://developers.google.com';i.research.pages[0].url='https://developers.google.com/oauth';i.research.pages[0].requestedUrl=i.research.pages[0].url;i.research.requests[0].url=i.research.pages[0].url;i.research.pages[0].title='Google OAuth';
 assert.equal(prepareGeneration(i).provider,'google.com');
});
