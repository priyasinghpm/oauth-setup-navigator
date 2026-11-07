import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectGenerationEvidence,evidenceCost} from '../lib/generation/select-evidence';
import {checkedEvidence,extractEvidence} from '../lib/research/evidence';
import type {ResearchPage} from '../lib/research/types';
const fixture:{page:ResearchPage}=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-bundle-selection-page.json',import.meta.url),'utf8'));
const limit={maxChars:7200,maxExcerpts:12};
function real(){const p=fixture.page;return checkedEvidence(p.text,p.url,p.title,p.excerpts,p.truncated);}
test('real Pipedrive initial exchange selects method, endpoint, encoding, auth and body parameters together',()=>{
 const candidates=real(),before=JSON.stringify(candidates),selected=selectGenerationEvidence(candidates,limit);
 const required=['evidence-b83e905331f38e291c361536','evidence-f9dc355fdfc1eab4c1d2eae3','evidence-e43d43271a42648be2763b02','evidence-f5d783a54933724b2fd4f79d'];
 for(const id of required)assert.ok(selected.excerpts.some(e=>e.id===id),id);
 assert.ok(selected.usedChars<=7200);assert.ok(selected.excerpts.length<=12);
 assert.equal(selected.usedChars,selected.excerpts.reduce((n,e)=>n+evidenceCost(e),0));
 assert.equal(JSON.stringify(candidates),before);
 for(const e of selected.excerpts){assert.ok(candidates.includes(e));assert.equal(fixture.page.text.slice(e.startOffset,e.endOffset),e.quote);}
 const initial=selected.bundleReports.find(b=>b.sectionHeading.includes('Step 4 and Step 5'))!;
 assert.equal(initial.complete,true);
});
test('small budgets report incomplete structural bundles without cropping, repairing or overrunning',()=>{
 for(const limits of [{maxChars:1000,maxExcerpts:12},{maxChars:7200,maxExcerpts:1},{maxChars:0,maxExcerpts:0}]){
  const candidates=real(),s=selectGenerationEvidence(candidates,limits);
  assert.ok(s.usedChars<=limits.maxChars);assert.ok(s.excerpts.length<=limits.maxExcerpts);
  assert.ok(s.bundleReports.some(b=>!b.complete));
  assert.ok(s.excerpts.every(e=>candidates.includes(e)));
 }
});
test('alternate provider request bundle does not require Basic auth, grant_type or standard response fields',()=>{
 const text='# Account setup\nCreate an OAuth application in the dashboard.\n\n# Exchange authorization\nUse PKCE and send the verifier to the provider.\n\n```http\nPOST https://developer.example.org/connect\n```\n\nThe request body includes verifier and installationId.\n\n# Renewal\nRenewal details are not established.';
 const candidates=extractEvidence(text,'https://developer.example.org/oauth','Example authorization');
 const s=selectGenerationEvidence(candidates,limit);
 assert.ok(s.excerpts.some(e=>e.quote.includes('POST https://developer.example.org/connect')));
 assert.ok(s.excerpts.some(e=>e.quote.includes('PKCE')));
 assert.ok(s.excerpts.some(e=>e.quote.includes('request body')));
 assert.ok(s.bundleReports.some(b=>b.complete));
 assert.equal(s.excerpts.some(e=>e.quote.includes('Basic')),false);
});
test('separate sections and publishers cannot form a fabricated request bundle',()=>{
 const a=extractEvidence('# Exchange tokens\n```http\nPOST https://a.example.org/token\n```','https://a.example.org/docs','A');
 const b=extractEvidence('# Exchange tokens\nUse HTTP Basic authentication and client_secret for token requests.','https://b.example.org/docs','B');
 const c=extractEvidence('# Different section\nUse grant_type from the provider documentation.','https://a.example.org/docs','A');
 const s=selectGenerationEvidence([...a,...b,...c],limit);
 assert.equal(s.bundleReports.length,0);
});
test('selection excludes clipped blocks and remains deterministic',()=>{
 const candidates=real(),copy=structuredClone(candidates);copy[0].clipped=true;
 assert.equal(selectGenerationEvidence(copy,limit).excerpts.some(e=>e.id===copy[0].id),false);
 assert.deepEqual(selectGenerationEvidence(candidates,limit),selectGenerationEvidence([...candidates],limit));
 assert.throws(()=>selectGenerationEvidence(candidates,{maxChars:-1,maxExcerpts:12}),/limits/);
});
test('HubSpot cached audit corpus retains actual request blocks within unchanged limits',()=>{
 const snapshot:{sources:{text:string;url:string;title:string;truncated:boolean}[]}=JSON.parse(readFileSync(new URL('../docs/audits/hubspot-source-snapshot.json',import.meta.url),'utf8'));
 let count=0;
 for(const source of snapshot.sources){
  const candidates=extractEvidence(source.text,source.url,source.title,source.truncated),result=selectGenerationEvidence(candidates,limit);
  assert.ok(result.usedChars<=7200);assert.ok(result.excerpts.length<=12);
  for(const e of result.excerpts)assert.equal(source.text.slice(e.startOffset,e.endOffset),e.quote);
  count+=result.bundleReports.filter(b=>b.complete).length;
 }
 assert.ok(count>0);
});

test('initial exchange outranks renewal even when its heading mentions refresh tokens',()=>{
 const text='# Refresh tokens\n```http\nPOST https://example.org/renew\nAuthorization: Basic SAMPLE\ngrant_type=refresh_token\n```\n\n# Generate initial access and refresh tokens\n```http\nPOST https://example.org/exchange\nAuthorization: Basic SAMPLE\ngrant_type=authorization_code\n```';
 const candidates=extractEvidence(text,'https://example.org/docs','Synthetic OAuth');
 const all=selectGenerationEvidence(candidates,limit);
 assert.equal(all.bundleReports[0].sectionHeading,'# Generate initial access and refresh tokens');
 const ids=all.bundleReports[0].memberIds;
 const cost=candidates.filter(e=>ids.includes(e.id)).reduce((n,e)=>n+evidenceCost(e),0);
 const bounded=selectGenerationEvidence(candidates,{maxChars:cost,maxExcerpts:1});
 assert.equal(bounded.bundleReports[0].complete,true);
 assert.ok(bounded.excerpts[0].quote.includes('/exchange'));
});
