import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchProvider} from '../lib/research/research';
import {extractPage} from '../lib/research/extract';
import {extractEvidence,checkedEvidence} from '../lib/research/evidence';
import {extractBlockEvidenceV2} from '../lib/research/blocks-v2';
import {prepareGeneration} from '../lib/generation/prepare';
import {resolveModelEvidence} from '../lib/generation/resolve';
import {input,fixture} from './helpers/generation';
import type {ResearchDependencies,WireResponse} from '../lib/research/types';
const html=(s:string):WireResponse=>({status:200,headers:{'content-type':'text/html'},body:s});
function network(pages:Record<string,WireResponse>){const calls:string[]=[];const deps:ResearchDependencies={resolve:async()=>[{address:'93.184.216.34',family:4}],request:async u=>{calls.push(u.href);return pages[u.href]??{status:404,headers:{},body:''}}};return {calls,deps};}
test('Pipedrive-shaped homepage prioritizes developer navigation over repetitive marketplace branches',async()=>{
 const root='https://www.pipedrive.com',dev='https://developers.pipedrive.com';
 const n=network({[root+'/']:html('<nav aria-label="Developer resources"><a href="'+dev+'/">Developers</a></nav>'+Array.from({length:20},(_,i)=>`<a href="/marketplace/collections/${i}">Marketplace</a>`).join('')),[dev+'/']:html('<a href="/docs/oauth">OAuth setup</a>'),[dev+'/docs/oauth']:html('<main>Create an app with OAuth, client secret, redirect URI and scopes.</main>')});
 const r=await researchProvider({website:root},{},n.deps);assert.ok(r.pages.some(p=>p.url===dev+'/docs/oauth'));assert.ok(n.calls.filter(u=>u.includes('/marketplace/')).length<=1);assert.ok(r.requestCount<=24);assert.ok(r.pages.length<=8);
 assert.equal(r.pages[0].discoveryLinks?.[0].text,'Developers');assert.equal(r.pages[0].discoveryLinks?.[0].context,'Developer resources');
});
test('official delegation admits exact provider-tenant documentation only; preparation retains provenance',async()=>{
 const root='https://developers.example.com',doc='https://example.readme.io/docs/oauth';
 const n=network({[root+'/']:html(`<a href="${doc}">Developer documentation</a><a href="https://evil.com/docs/oauth">Developer docs</a><a href="https://example.readme.io.evil.com/docs/oauth">Developer documentation</a><a href="https://example.readme.io/admin">Developer docs</a>`),[doc]:html('<main>Create an app. OAuth client secret, redirect URI and scopes.</main><a href="/admin">OAuth docs</a><a href="https://elsewhere.com/docs">Developer documentation</a>')});
 const r=await researchProvider({provider:'Example',website:root},{},n.deps);assert.equal(r.delegations?.length,1);assert.ok(r.pages.some(p=>p.url===doc));assert.ok(!n.calls.some(u=>/evil.com|\/admin|unlinked|elsewhere/.test(u)));
 const p=prepareGeneration({provider:'Example',slug:'example',research:r});assert.ok(p.sources.some(s=>s.url===doc));
 const forged=structuredClone(r);forged.delegations![0].from='https://evil.com/';assert.throws(()=>prepareGeneration({provider:'Example',slug:'example',research:forged}),/Unverified/);
});
test('delegation never bypasses robots, DNS, publisher rules, nofollow or redirect scope',async()=>{
 const root='https://developers.example.com',doc='https://example.readme.io/docs/oauth';
 for(const mode of ['robots','dns','publisher','nofollow','redirect']){
 const n=network({[root+'/']:html(`<a ${mode==='nofollow'?'rel="nofollow"':''} href="${doc}">Developer documentation</a>`),[doc]:mode==='redirect'?{status:302,headers:{location:'https://example.readme.io/admin'},body:''}:mode==='publisher'?html('<meta name="robots" content="nosnippet"><main>OAuth instructions</main>'):html('<main>OAuth instructions</main>'),...(mode==='robots'?{'https://example.readme.io/robots.txt':{status:200,headers:{},body:'User-agent: *\nDisallow: /'}}:{})});
 if(mode==='dns')n.deps.resolve=async h=>[{address:h==='example.readme.io'?'127.0.0.1':'93.184.216.34',family:4}];
 const r=await researchProvider({website:root},{},n.deps);assert.ok(!r.pages.some(p=>p.url===doc),mode);assert.ok(!n.calls.includes('https://example.readme.io/admin'));
 }
});
test('complete late OAuth renewal evidence survives preparation and exact resolver checks',()=>{
 const i=input();const page=i.research.pages[0];page.text='# Registration\n'+page.text+'\n\n'+('Ordinary background information.\n\n'.repeat(420))+'\n# Refresh tokens\nUse the refresh_token with grant_type=refresh_token to renew an expired access token.';
 page.excerpts=extractEvidence(page.text,page.url,page.title);const p=prepareGeneration(i);const late=p.sources[0].excerpts.find(e=>e.sectionHeading==='# Refresh tokens')!;assert.ok(late);assert.ok(late.startOffset>12000);assert.equal(late.quote,page.text.slice(late.startOffset,late.endOffset));
 const draft=fixture(p);draft.guide.steps[0].evidence.evidenceIds=[p.evidenceRegistry.find(r=>r.evidenceId===late.id)!.id];const resolved=resolveModelEvidence(draft,p);assert.ok(resolved.support.some(q=>q.quote===late.quote));assert.ok(p.sources[0].text.length<=12000);
});
test('new evidence omits navigation, metadata, broken HTML and preserves old evidence registries',()=>{
 const text='---\nmetadata: OAuth\n---\n\n[OAuth setup](/oauth)\n\n<td>refresh_token</td>\n\n# Refresh\nUse the refresh_token on your backend to renew access.';
 const e=extractEvidence(text,'https://docs.example.com/oauth','OAuth');assert.ok(e.length);assert.ok(e.every(x=>!/^---|^\[|<td>/.test(x.quote)));assert.deepEqual(checkedEvidence(text,'https://docs.example.com/oauth','OAuth',e),e);
 const old=extractBlockEvidenceV2(text,'https://docs.example.com/oauth','OAuth');assert.deepEqual(checkedEvidence(text,'https://docs.example.com/oauth','OAuth',old),old);
 const parsed=extractPage('<nav aria-label="Resources"><a href="/build">Developer documentation</a></nav>','https://example.com','text/html',100);assert.equal(parsed.linkDetails[0].text,'Developer documentation');
});
test('HubSpot documentation discovery and preparation remain functional offline',async()=>{
 const root='https://developers.hubspot.com';const n=network({[root+'/']:html('<a href="/docs/apps/authentication">OAuth authentication</a>'),[root+'/docs/apps/authentication']:html('<main>Create an app. Configure OAuth and redirect URI. Retrieve client ID and secret. Exchange authorization code, then refresh_token.</main>')});const research=await researchProvider({provider:'HubSpot',website:root},{},n.deps);const p=prepareGeneration({provider:'HubSpot',slug:'hubspot',research});assert.ok(p.evidenceRegistry.length);assert.ok(p.sources.some(s=>s.url.endsWith('/authentication')));
});

test('delegated documentation follows only explicitly linked sibling URLs with a replayable chain',async()=>{
 const root='https://developers.example.com',doc='https://example.readme.io/docs/oauth',scope='https://example.readme.io/docs/scopes';
 const n=network({[root+'/']:html(`<a href="${doc}#start">Developer documentation</a>`),[doc]:html('<main>OAuth authorization on your backend.</main><a href="/docs/scopes">Permissions</a>'),[scope]:html('<main>Select read scope for OAuth authorization.</main>')});
 const r=await researchProvider({provider:'Example',website:root},{},n.deps);assert.equal(r.delegations?.length,2);const p=prepareGeneration({provider:'Example',slug:'example',research:r});assert.ok(p.sources.some(s=>s.url===scope));
 const broken=structuredClone(r);broken.delegations!.reverse();assert.throws(()=>prepareGeneration({provider:'Example',slug:'example',research:broken}),/Unverified/);
});
test('nested XML sitemaps and localized HTML sitemap copies cannot consume the discovery budget',async()=>{
 const root='https://www.example.com';const n=network({[root+'/']:html('<a href="/en/sitemap">Site map</a>'),[root+'/en/sitemap']:html('<a href="/de/sitemap">Site map</a><a href="/features/crm-api">CRM API</a>'),[root+'/features/crm-api']:html('<a href="https://developers.example.com/docs/oauth">OAuth setup documentation</a>'),['https://developers.example.com/docs/oauth']:html('<main>Create OAuth app and configure client secret, scopes and redirect URI.</main>'),[root+'/sitemap.xml']:{status:200,headers:{'content-type':'application/xml'},body:'<sitemapindex>'+Array.from({length:12},(_,i)=>`<sitemap><loc>${root}/sitemaps/${i}.xml</loc></sitemap>`).join('')+'</sitemapindex>'}});
 const r=await researchProvider({website:root},{},n.deps);assert.ok(r.pages.some(p=>p.url.endsWith('/docs/oauth')));assert.ok(n.calls.filter(u=>/sitemaps\/\d+\.xml/.test(u)).length<=1);assert.ok(!n.calls.includes(root+'/de/sitemap'));
});

test('HTML link-only sitemap lists remain discovery links but never become evidence',()=>{
 const page=extractPage('<main><h1>Site map</h1><ul><li><a href="/oauth">OAuth authorization callback refresh token</a></li></ul><p>Register in <a href="/developer">Developer Hub</a>.</p></main>','https://example.com/sitemap','text/html',24000);
 assert.ok(page.links.includes('/oauth'));assert.ok(!page.text.includes('OAuth authorization callback refresh token'));assert.ok(page.text.includes('Register in'));const e=extractEvidence(page.text,'https://example.com/sitemap',page.title);assert.ok(e.every(x=>!x.quote.includes('OAuth authorization callback refresh token')));
});
