// Offline editorial regression tests. No Gemini, key, network, or application-library changes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGuides} from '../lib/validate-guides';
import {extractLegacyEvidence,researchSourceId} from '../lib/research/evidence';
import type {Evidence} from '../lib/types';
const raw=JSON.parse(readFileSync('docs/audits/hubspot-guide.json','utf8'));
const snapshot: {sources:{sourceId:string;url:string;title:string;retrievedAt:string;text:string}[]}=JSON.parse(readFileSync('docs/audits/hubspot-source-snapshot.json','utf8'));
const guide=parseGuides([raw],{allowedSourceUrls:new Set(snapshot.sources.map(s=>s.url))})[0];
function entries():Evidence[]{return [guide.difficulty.evidence,guide.setupEstimate.evidence,guide.approvalSummary.evidence,guide.approvalWaitingTime.evidence,...guide.prerequisites.map(x=>x.evidence),...guide.steps.map(x=>x.evidence),...guide.scopes.map(x=>x.evidence),...guide.approval.map(x=>x.evidence),...guide.blockers.map(x=>x.evidence),...guide.responsibilities.agent.map(x=>x.evidence),...guide.responsibilities.developer.map(x=>x.evidence),...guide.nextActions.map(x=>x.evidence)];}
function quotation(e:Evidence){return e.quotations?.map(q=>q.quote).join('\n')||'';}
test('audited HubSpot guide validates and every quotation is re-extracted from the independent research snapshot',()=>{
  assert.equal(guide.oauthTestStatus,'not-tested');
  for(const s of snapshot.sources)assert.equal(s.sourceId,researchSourceId(s.url));
  for(const e of entries()){
    if(e.status==='unknown')assert.deepEqual(e.sourceIds,[]);
    if(e.status==='documented')assert.ok(e.quotations?.length);
    for(const q of e.quotations||[]){
      const source=snapshot.sources.find(s=>s.sourceId===q.sourceId);assert.ok(source);
      const original=extractLegacyEvidence(source.text,source.url,source.title).find(x=>x.id===q.evidenceId);assert.ok(original);
      const {id,...fields}=original;assert.deepEqual(q,{evidenceId:id,...fields});
      assert.ok(e.sourceIds.includes(q.sourceId));assert.ok(guide.sources.some(s=>s.id===q.sourceId&&s.url===q.sourceUrl));
    }
  }
});
test('registration precedes upload and credential retrieval, with backend-only secret handling',()=>{
  assert.match(guide.steps[0].description,/hs project create/);
  assert.match(quotation(guide.steps[0].evidence),/hs project create/);
  const credentials=guide.steps.find(x=>x.title.includes('credentials'));assert.ok(credentials);
  assert.match(credentials.description,/hs project upload.*hs project open/);
  assert.match(credentials.description,/Auth tab.*Client credentials/);
  assert.match(quotation(credentials.evidence),/Client credentials/);
  const source=snapshot.sources.find(s=>s.url.includes('create-an-app.md'))!;
  assert.ok(source.text.indexOf('hs project upload')<source.text.indexOf('hs project open'));
  assert.match(credentials.description,/backend/);
  assert.match(credentials.description,/client secret belongs in that backend/);
  assert.match(quotation(guide.prerequisites[1].evidence),/install the HubSpot CLI/);
});
test('redirect, scopes and distribution explanations retain their applicability and direct evidence',()=>{
  const config=guide.steps[1];
  assert.match(config.description,/HTTPS for production/);
  assert.match(config.description,/private.*allowlisted.*marketplace.*eligibility/);
  assert.match(config.description,/does not establish listing approval/);
  assert.match(config.description,/10 accounts at a time/);
  assert.match(quotation(config.evidence),/For production applications, `https` is required/);
  assert.match(quotation(guide.scopes[0].evidence),/can view all contacts/);
  assert.match(quotation(guide.scopes[1].evidence),/create contacts/);
  assert.match(guide.scopes[1].purpose,/not a universal/);
  assert.match(guide.steps[3].description,/scope.*redirect_uri/);
  assert.match(guide.steps[3].description,/URL-encoded spaces/);
});
test('token handling uses returned expiry and includes single-use code and renewal without an invented refresh lifetime',()=>{
  assert.match(guide.steps[4].description,/temporary and single-use/);
  const exchange=guide.steps[5];
  assert.match(exchange.description,/https:\/\/api.hubapi.com\/oauth\/v3\/token/);
  assert.match(exchange.description,/grant_type=authorization_code/);
  assert.match(exchange.description,/redirect_uri used during authorization/);
  assert.match(exchange.description,/Read expires_in/);
  assert.match(exchange.expectedOutcome,/currently 30 minutes.*expires_in/);
  assert.match(quotation(exchange.evidence),/currently 30 minutes/);
  assert.doesNotMatch(JSON.stringify(guide),/long-lived refresh token/);
  assert.match(guide.steps[6].description,/grant_type=refresh_token/);
  assert.match(quotation(guide.steps[6].evidence),/new access token/);
});
test('effort is editorial and unknown review, installer-role and recovery requirements remain uncited',()=>{
  assert.equal(guide.setupEstimate.evidence.status,'estimated');
  assert.match(guide.setupEstimate.evidence.qualification!,/Unmeasured editorial/);
  assert.match(guide.setupEstimate.evidence.qualification!,/Excludes.*backend.*OAuth testing.*external review/);
  for(const item of [guide.approvalSummary,guide.approvalWaitingTime,...guide.approval,...guide.blockers]){
    assert.equal(item.evidence.status,'unknown');assert.deepEqual(item.evidence.sourceIds,[]);assert.equal(item.evidence.quotations,undefined);
  }
  assert.equal(guide.prerequisites[3].evidence.status,'unknown');
  assert.match(guide.prerequisites[3].evidence.qualification!,/do not resolve/);
  for(const item of [...guide.responsibilities.agent,...guide.responsibilities.developer,...guide.nextActions])assert.equal(item.evidence.status,'estimated');
});
