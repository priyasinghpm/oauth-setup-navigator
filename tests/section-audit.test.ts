import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSection,validateSection,sectionRequest} from '../scripts/helpers/staged-section';
import {directLiterals,sectionLiteralIndex} from '../scripts/helpers/section-literal-index';
import {validateSectionInterpretation} from '../scripts/helpers/section-coverage';
import type {PreparedInput} from '../lib/generation/types';
const historical:{input:PreparedInput;response:unknown}=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-seven-section-audit.json',import.meta.url),'utf8'));
test('literal catalog includes direct evidence only, never context-only duration',()=>{
 const index=sectionLiteralIndex(historical.input);
 for(const row of index){
  const ref=historical.input.evidenceRegistry.find(r=>r.id===row.evidenceId)!;
  const excerpt=historical.input.sources.flatMap(s=>s.excerpts).find(e=>e.id===ref.evidenceId)!;
  for(const literal of row.directLiterals)assert.ok(excerpt.quote.includes(literal));
 }
 assert.equal(index.some(row=>row.directLiterals.includes('5 minutes')),false);
 assert.ok(index.some(row=>row.directLiterals.includes('application/x-www-form-urlencoded')));
 assert.ok(directLiterals('Expires in 5 minutes.').includes('5 minutes'));
 assert.deepEqual(JSON.parse(sectionRequest(historical.input).contents).directLiteralIndex,index);
});
// Explicitly constructed new-schema test draft; historical response stays untouched.
function currentDraft(){
 const response=structuredClone(historical.response) as {section:Record<string,unknown>};
 response.section.callbackMatching={rule:'must-match-registered',text:'The callback URL must match the registered URL.',evidence:{status:'documented',evidenceIds:['e21'],qualification:'Constructed offline test claim supported by the retained callback quotation.'}};
 return response;
}
test('original historical response fails new required callback field',()=>{
 assert.throws(()=>validateSection(historical.response,historical.input),/section-schema-invalid/);
});
test('audit reports all failing steps and missing token response without repairing historical output',()=>{
 const before=JSON.stringify(historical);
 const audit=auditSection(currentDraft(),historical.input);
 assert.equal(audit.accepted,false);
 assert.ok(audit.findings.some(f=>f.fieldPath==='steps.1'&&f.code==='guide-evidence-literal-missing'));
 assert.ok(audit.findings.some(f=>f.fieldPath==='token-response'&&f.code==='section-coverage-missing'));
 assert.equal(audit.findings.some(f=>f.code==='section-http-method-unsupported'),false);
 assert.equal(audit.findings.some(f=>f.code==='section-example-values-unqualified'),false);
 assert.throws(()=>validateSection(currentDraft(),historical.input),e=>!!e&&typeof e==='object'&&'fieldPath' in e&&e.fieldPath==='steps.1');
 assert.equal(JSON.stringify(historical),before);
});
test('audit rejects unknown IDs, refuses repair, and returns only bounded diagnostics',()=>{
 const response=currentDraft() as unknown as {section:{steps:{evidence:{evidenceIds:string[]}}[]}};
 response.section.steps[0].evidence.evidenceIds=['not-a-real-id-secret-marker'];
 const audit=auditSection(response,historical.input);
 assert.equal(audit.accepted,false);
 assert.deepEqual(audit.findings,[{code:'evidence-id-unknown',fieldPath:'section'}]);
 assert.equal(JSON.stringify(audit).includes('secret-marker'),false);
});
test('replacement guidance inflections are accepted without accepting unlabeled samples',()=>{
 for(const verb of ['replace','replaced','replacing','substitute','substituted','substituting'])assert.doesNotThrow(()=>validateSectionInterpretation('https://oauth.example.com/authorize?client_id=sample . These values are examples and must be '+verb+' with your own values.',''));
 assert.throws(()=>validateSectionInterpretation('https://oauth.example.com/authorize?client_id=sample . Must be replaced.',''),/section-example-values-unqualified/);
});
