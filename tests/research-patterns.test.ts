import {test} from 'node:test';
import assert from 'node:assert/strict';
import {developerPatternCandidates} from '../lib/research/discovery';
import {researchProvider} from '../lib/research/research';
import {prepareGeneration} from '../lib/generation/prepare';
import type {ResearchDependencies,WireResponse} from '../lib/research/types';
const root='https://example.com',dev='https://developers.example.com';
const html=(body:string):WireResponse=>({status:200,headers:{'content-type':'text/html'},body});
const doc='<main><h1>OAuth setup</h1><p>Create an app with a client ID and secret. Register a redirect URI and choose scopes. Exchange the authorization code, then use the refresh_token.</p></main>';
function net(pages:Record<string,WireResponse>){const calls:string[]=[];const deps:ResearchDependencies={resolve:async()=>[{address:'93.184.216.34',family:4}],request:async u=>{calls.push(u.href);return pages[u.href]??{status:404,headers:{},body:''}}};return {calls,deps};}
test('fallback discovers an unlinked developer subdomain before marketing pages, then stops unnecessary probes',async()=>{
 const n=net({[root+'/']:html('<main>Welcome</main><a href="/marketplace">Marketplace</a>'),[dev+'/']:html('<a href="/docs/oauth">OAuth setup</a>'),[dev+'/docs/oauth']:html(doc)});
 const r=await researchProvider({provider:'Example',website:root},{},n.deps);
 assert.equal(r.patternFallback?.triggered,true);assert.deepEqual(r.patternFallback?.attemptedUrls,[dev+'/']);assert.equal(r.patternFallback.requestCount,2);assert.equal(r.patternFallback.candidateUrls.length,5);
 assert.ok(n.calls.indexOf(root+'/marketplace')<0||n.calls.indexOf(dev+'/docs/oauth')<n.calls.indexOf(root+'/marketplace'));assert.equal(r.pages.find(p=>p.url===dev+'/')?.discoveryMethod,'pattern-probe');
 assert.ok(prepareGeneration({provider:'Example',slug:'example',research:r}).sources.some(s=>s.url===dev+'/docs/oauth'));
});
test('working linked documentation suppresses fallback; Pipedrive and HubSpot URL shapes remain link-first',async()=>{
 for(const domain of ['pipedrive.com','hubspot.com']){
 const home=`https://www.${domain}`,docs=`https://developers.${domain}`;const n=net({[home+'/']:html(`<a href="${docs}/docs/oauth">Developer documentation</a>`),[docs+'/docs/oauth']:html(doc)});
 const r=await researchProvider({website:home},{},n.deps);assert.equal(r.patternFallback?.triggered,false);assert.deepEqual(r.patternFallback?.attemptedUrls,[]);assert.ok(!n.calls.includes(`https://developer.${domain}/robots.txt`));assert.ok(r.pages.some(p=>p.url===docs+'/docs/oauth'));
 }
});
test('failed linked documentation permits fallback when no promising destination remains',async()=>{
 const n=net({[root+'/']:html('<a href="/docs/missing">Developer documentation</a>'),[dev+'/']:html(doc)});const r=await researchProvider({website:root},{},n.deps);
 assert.ok(n.calls.indexOf(root+'/docs/missing')<n.calls.indexOf(dev+'/'));assert.equal(r.patternFallback?.triggered,true);assert.ok(r.pages.some(p=>p.url===dev+'/'));
});
test('candidate generation rejects malformed, unsafe and unestablished domains',()=>{
 assert.deepEqual(developerPatternCandidates('example.com'),[dev+'/', 'https://developer.example.com/','https://api.example.com/',root+'/docs',root+'/developers']);
 for(const value of ['127.0.0.1','localhost','example.com.evil.com/path','user@example.com','example.com:8443','https://example.com','docs.example.com','example.com?x=1'])assert.throws(()=>developerPatternCandidates(value),value);
});
test('candidate retrieval still rejects private DNS, unrelated redirects, robots and publisher restrictions',async()=>{
 for(const mode of ['dns','redirect','robots','publisher']){
 const n=net({[root+'/']:html('<main>Welcome</main>'),[dev+'/']:mode==='redirect'?{status:302,headers:{location:'https://evil.com/docs/oauth'},body:''}:mode==='publisher'?html('<meta name="robots" content="nosnippet"><main>OAuth</main>'):html(doc),...(mode==='robots'?{[dev+'/robots.txt']:{status:200,headers:{},body:'User-agent: *\nDisallow: /'}}:{})});
 if(mode==='dns')n.deps.resolve=async h=>[{address:h==='developers.example.com'?'127.0.0.1':'93.184.216.34',family:4}];
 const r=await researchProvider({website:root},{},n.deps);assert.ok(!r.pages.some(p=>p.url===dev+'/'),mode);assert.ok(!n.calls.some(u=>u.startsWith('https://evil.com')));if(mode==='dns'||mode==='robots')assert.ok(!n.calls.includes(dev+'/'));
 }
});
test('404 and soft-404 candidates are not usable docs; probes and failed redirects are deduplicated',async()=>{
 const n=net({[root+'/']:html('<main>Welcome</main>'),[dev+'/']:html('<title>404 Page not found</title><main>OAuth</main>'),['https://developer.example.com/']:{status:302,headers:{location:dev+'/'},body:''}});
 const r=await researchProvider({website:root},{},n.deps);assert.equal(r.patternFallback?.attemptedUrls.length,5);assert.ok(r.patternFallback.requestCount<=10);assert.ok(!r.pages.some(p=>p.url===dev+'/'));assert.equal(n.calls.filter(u=>u===dev+'/').length,1);assert.equal(new Set(r.patternFallback?.candidateUrls).size,r.patternFallback?.candidateUrls.length);assert.ok(r.failures.some(f=>/missing content/.test(f.reason)));
});
test('fallback respects shared request, page and total-time budgets',async()=>{
 const n=net({[root+'/']:html('<main>Welcome</main>')});const limited=await researchProvider({website:root},{maxRequests:4},n.deps);assert.ok(limited.requestCount<=4);assert.ok(limited.patternFallback!.requestCount<=2);
 const pageLimited=await researchProvider({website:root},{maxPages:1},n.deps);assert.equal(pageLimited.pages.length,1);assert.equal(pageLimited.patternFallback?.attemptedUrls.length,0);
 const hanging=net({[root+'/']:html('<main>Welcome</main>')});hanging.deps.resolve=async h=>{if(h!== 'example.com')return new Promise(()=>{});return [{address:'93.184.216.34',family:4}]};const start=Date.now();const timed=await researchProvider({website:root},{timeoutMs:10,totalTimeoutMs:40},hanging.deps);assert.ok(Date.now()-start<1000);assert.ok(timed.requestCount<=24);assert.ok(timed.pages.length<=8);
});
test('inaccessible or publisher-restricted initial pages do not activate pattern discovery',async()=>{
 for(const response of [html('<meta name="robots" content="nofollow"><main>Welcome</main>'),html('<meta name="robots" content="nosnippet"><main>Welcome</main>'),{status:403,headers:{},body:''}]){
 const n=net({[root+'/']:response});const r=await researchProvider({website:root},{},n.deps);assert.equal(r.patternFallback?.triggered,false);assert.deepEqual(r.patternFallback?.attemptedUrls,[]);
 }
});
