// Historical public documentation and synthetic evidence only. No model calls.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractEvidence,checkedEvidence,extractLegacyEvidence,EXCERPT_LIMITS} from '../lib/research/evidence';
import {extractPage} from '../lib/research/extract';
import {validateInstructionEvidence,incompleteCommand} from '../lib/generation/evidence-quality';
import {lifecycleCoverage} from '../lib/oauth-lifecycle';
import {generateWithTransport} from '../lib/generation/generate';
import {prepareGeneration} from '../lib/generation/prepare';
import {input,fixture} from './helpers/generation';
import type {OAuthGuide} from '../lib/types';
import type {ClaimSupport} from '../lib/generation/types';
const historical:OAuthGuide=JSON.parse(readFileSync('docs/audits/hubspot-generated-2026-11-03.json','utf8'));
const snapshot:{sources:{url:string;title:string;text:string}[]}=JSON.parse(readFileSync('docs/audits/hubspot-source-snapshot.json','utf8'));
function supportFor(g:OAuthGuide):ClaimSupport[]{const out:ClaimSupport[]=[];for(const section of ['prerequisites','steps','scopes'] as const)g[section].forEach((s,i)=>s.evidence.quotations?.forEach(q=>out.push({path:`${section}.${i}`,...q})));return out;}
test('new excerpts preserve whole paragraphs, fenced commands and configuration with exact context and stable IDs',()=>{
 const text='# OAuth configuration\n\nCreate an OAuth app and register its redirect URI. Use only the scopes your feature needs.\n\n```shell\ncurl --request POST \\\n  --url https://api.example.com/oauth/token \\\n  --data grant_type=authorization_code\n```\n\n```json\n{\n  "auth": {"type": "oauth", "redirectUrls": ["https://example.com/callback"]}\n}\n```';
 const es=extractEvidence(text,'https://docs.example.com/oauth','OAuth');assert.equal(es.length,3);assert.deepEqual(es,extractEvidence(text,'https://docs.example.com/oauth','OAuth'));
 assert.equal(es.filter(e=>e.kind==='code').length,2);
 for(const e of es){assert.equal(e.quote,text.slice(e.startOffset,e.endOffset));assert.equal(e.clipped,false);assert.ok(e.quote.length<=EXCERPT_LIMITS.maxLength);assert.equal(e.extractionVersion,'blocks-v3');assert.equal(incompleteCommand(e.quote),false);}
 assert.ok(es.some(e=>e.quote.includes('curl --request POST')&&e.quote.includes('--data grant_type=authorization_code')&&e.quote.endsWith('```')));
});
test('oversized and unclosed code blocks and truncated terminal paragraphs are omitted, never cut or repaired',()=>{
 const oversized='```json\n'+JSON.stringify({scope:'x'.repeat(2000)})+'\n```';assert.deepEqual(extractEvidence(oversized,'https://docs.example.com/oauth','OAuth'),[]);
 assert.deepEqual(extractEvidence('```shell\ncurl --request POST \\\n --url https://example.com','https://docs.example.com/oauth','OAuth'),[]);
 assert.deepEqual(extractEvidence('Configure OAuth redirect URI before authoriz','https://docs.example.com/oauth','OAuth',true),[]);
 assert.ok(incompleteCommand('curl --request POST \\'));assert.ok(incompleteCommand('```shell\ncurl --request POST\n```'));
});
test('HTML extraction preserves command whitespace and paragraph boundaries within existing text limits',()=>{
 const page=extractPage('<main><h1>OAuth</h1><p>Create an OAuth app in the developer portal.</p><pre>curl --request POST \\\n  --url https://api.example.com/token</pre><p>Save the returned tokens on your backend.</p></main>','https://docs.example.com/oauth','text/html',24000);
 assert.ok(page.text.includes('  --url'));const code=extractEvidence(page.text,'https://docs.example.com/oauth',page.title).find(e=>e.kind==='code');assert.ok(code?.quote.includes('curl --request POST \\\n  --url'));assert.ok(page.text.length<=24000);
});
test('legacy archives retain exact old IDs without silently upgrading their cited text',()=>{
 const source=snapshot.sources.find(s=>s.url===historical.steps[1].evidence.quotations![0].sourceUrl)!;
 const old=extractLegacyEvidence(source.text,source.url,source.title);assert.deepEqual(checkedEvidence(source.text,source.url,source.title,old),old);
 const q=historical.steps[1].evidence.quotations![0];assert.equal(old.find(e=>e.id===q.evidenceId)?.quote,q.quote);
 const tampered=structuredClone(old);tampered[0].quote+=' altered';assert.throws(()=>checkedEvidence(source.text,source.url,source.title,tampered),/mapping/);
});
test('historical HubSpot scope and command support is rejected even though quotation IDs and sources are genuine',()=>{
 const g=structuredClone(historical);g.steps=[];g.prerequisites=[];
 assert.throws(()=>validateInstructionEvidence(g,supportFor(g)),(e:unknown)=>e instanceof Error&&'code'in e&&e.code==='guide-evidence-literal-missing');
 const credentials=structuredClone(historical);credentials.prerequisites=[];credentials.scopes=[];credentials.steps=[{...historical.steps[1],description:'Run `hs project open` and open the app Auth tab.'}];
 assert.throws(()=>validateInstructionEvidence(credentials,supportFor(credentials)),(e:unknown)=>e instanceof Error&&'code'in e&&e.code==='guide-evidence-literal-missing');
});
test('clipped support, unsupported URLs/configuration values and incomplete commands fail without citation repair',async()=>{
 const i=input(),p=prepareGeneration(i),f=fixture(p);const valid=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(valid.ok);
 for(const [change,code]of [
  [(g:OAuthGuide,s:ClaimSupport[])=>{s.find(q=>q.path==='steps.0')!.clipped=true;},'guide-evidence-clipped'],
  [(g:OAuthGuide)=>{g.steps[0].description='Open https://evil.example/oauth.';},'guide-evidence-literal-missing'],
  [(g:OAuthGuide)=>{g.steps[0].description='Set `grant_type=made_up`.';},'guide-evidence-literal-missing'],
  [(g:OAuthGuide,s:ClaimSupport[])=>{s.find(q=>q.path==='steps.0')!.quote='curl --request POST \\';},'guide-evidence-command-incomplete'],
 ]as const){const guide=structuredClone(valid.guide),support=structuredClone(valid.support);change(guide,support);assert.throws(()=>validateInstructionEvidence(guide,support),(e:unknown)=>e instanceof Error&&'code'in e&&e.code===code);}
 const bad=fixture(p);bad.guide.steps[0].evidence.evidenceIds=['e999'];const rejected=await generateWithTransport(i,async()=>({text:JSON.stringify(bad)}));assert.ok(!rejected.ok);assert.equal(rejected.diagnostic?.code,'evidence-id-unknown');assert.deepEqual(bad.guide.steps[0].evidence.evidenceIds,['e999']);
});
test('historical HubSpot coverage identifies missing renewal rather than inventing a supported stage',()=>{
 assert.equal(lifecycleCoverage(historical).find(s=>s.stage==='Token renewal')?.described,false);
 assert.equal(historical.oauthTestStatus,'not-tested');assert.equal(historical.approvalSummary.evidence.status,'unknown');
});
test('renewal instructions cannot cite a generic registration paragraph just because it mentions OAuth',async()=>{
 const i=input(),p=prepareGeneration(i),f=fixture(p);f.guide.steps[0].title='Refresh token renewal';
 const result=await generateWithTransport(i,async()=>({text:JSON.stringify(f)}));assert.ok(!result.ok);assert.equal(result.diagnostic?.code,'guide-evidence-topic-mismatch');
});
test('documented configuration key/value pairs require the actual selected pair, not unrelated token mentions',()=>{
 const source=snapshot.sources.find(s=>s.url.includes('manage-oauth-tokens'))!;
 const block=extractEvidence(source.text,source.url,source.title).find(e=>e.kind==='code'&&e.quote.includes('grant_type=authorization_code'))!;assert.ok(block);
 const guide=structuredClone(historical);guide.prerequisites=[];guide.scopes=[];guide.steps=[{...historical.steps[4],title:'Exchange authorization code',description:'Send a form request with `grant_type=authorization_code`.',expectedOutcome:'Tokens are returned on success.'}];
 const prior=historical.steps[4].evidence.quotations![0];const support:ClaimSupport[]=[{...prior,path:'steps.0',evidenceId:block.id,quote:block.quote,contextBefore:block.contextBefore,contextAfter:block.contextAfter,startOffset:block.startOffset,endOffset:block.endOffset,sectionHeading:block.sectionHeading,clipped:false}];
 assert.doesNotThrow(()=>validateInstructionEvidence(guide,support));guide.steps[0].description='Send a form request with `grant_type=refresh_token`.';
 assert.throws(()=>validateInstructionEvidence(guide,support),(e:unknown)=>e instanceof Error&&'code'in e&&e.code==='guide-evidence-literal-missing');
});
