import {test} from 'node:test';
import assert from 'node:assert/strict';
import {input} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
import {validateSection,auditSection,sectionRequest} from '../scripts/helpers/staged-section';
function setup(){
 const source=input();source.research.pages[0].text='For OAuth authorization, the callback URL must match the registered URL.';
 const prepared=prepareGeneration(source);
 const documented=()=>({status:'documented',evidenceIds:[prepared.evidenceRegistry[0].id],qualification:'Synthetic test documentation explicitly requires registered callback matching.'});
 const draft={section:{callbackMatching:{rule:'must-match-registered',text:'The callback URL must match the registered URL.',evidence:documented()},steps:[{title:'Configure callback',description:'The callback URL must match the registered URL.',expectedOutcome:'Callback configuration is prepared for testing.',evidence:documented()}],gaps:['authorization-request','token-request','client-authentication','request-encoding','token-response'].map(topic=>({topic,text:'This topic is unknown from the selected excerpts.',evidence:{status:'unknown',evidenceIds:[] as string[],qualification:'Not established in this synthetic source.'}}))}};
 return {prepared,draft};
}
test('required callback matching retains exact source quotation and not-tested flags',()=>{
 const {prepared,draft}=setup();const result=validateSection(draft,prepared);
 assert.equal(result.callbackMatching.rule,'must-match-registered');
 assert.equal(result.callbackMatching.evidence.quotations?.[0].quote,prepared.sources[0].excerpts[0].quote);
 assert.equal(result.callbackMatching.evidence.quotations?.[0].sourceUrl,prepared.sources[0].url);
 assert.equal(result.coverage.find(c=>c.topic==='callback')?.covered,true);
 assert.equal(result.oauthTestStatus,'not-tested');assert.equal(result.reviewStatus,'not-human-reviewed');
 assert.equal(auditSection(draft,prepared).accepted,true);
 assert.ok(JSON.stringify(sectionRequest(prepared).jsonSchema).includes('callbackMatching'));
});
test('callback field cannot be omitted even if prose mentions matching',()=>{
 const {prepared,draft}=setup();const {callbackMatching:_,...without}=draft.section;
 assert.throws(()=>validateSection({section:without},prepared),/section-schema-invalid/);
});
for(const statement of ['An authorization code is delivered to the callback URL.','The callback URL must not match the registered URL.'])test('reject incomplete or contradictory callback requirement: '+statement,()=>{
 const {prepared,draft}=setup();draft.section.callbackMatching.text=statement;
 assert.throws(()=>validateSection(draft,prepared),/section-callback-(?:instruction-incomplete|rule-contradiction)/);
});
test('unknown and mismatched status cannot hide a known matching requirement',()=>{
 const {prepared,draft}=setup();draft.section.callbackMatching={rule:'unknown',text:'Callback matching is unknown.',evidence:{status:'unknown',evidenceIds:[],qualification:'Not established.'}};
 assert.throws(()=>validateSection(draft,prepared),/section-callback-known-requirement-omitted/);
 draft.section.callbackMatching.rule='must-match-registered';
 assert.throws(()=>validateSection(draft,prepared),/section-callback-support-required/);
});
test('invalid callback evidence IDs are rejected before accepting the structured rule',()=>{
 const {prepared,draft}=setup();draft.section.callbackMatching.evidence.evidenceIds=['e999'];
 assert.throws(()=>validateSection(draft,prepared),e=>!!e&&typeof e==='object'&&'code' in e&&e.code==='evidence-id-unknown');
});
test('unrelated direct quotation cannot support callback matching',()=>{
 const source=input();source.research.pages[0].text='Exchange the authorization code for tokens on your backend.';
 const prepared=prepareGeneration(source);const {draft}=setup();
 draft.section.callbackMatching.evidence.evidenceIds=[prepared.evidenceRegistry[0].id];
 assert.throws(()=>validateSection(draft,prepared),/section-callback-direct-support-missing/);
});
