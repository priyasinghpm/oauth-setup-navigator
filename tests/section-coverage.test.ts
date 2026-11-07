import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {OAuthGuide} from '../lib/types';
import {sectionCoverage,validateSectionLiterals} from '../scripts/helpers/section-coverage';
// Historical output retained verbatim, not a newly fabricated successful guide.
const historical: {steps:OAuthGuide['steps']}=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-staged-historical.json',import.meta.url),'utf8'));
test('actual live response exposes missing actionable endpoints and direct encoding support',()=>{
 const c=sectionCoverage(historical.steps);
 for(const topic of ['authorization-request','callback','token-request','request-encoding','token-response'])assert.equal(c.find(x=>x.topic===topic)?.covered,false,topic);
 assert.equal(c.find(x=>x.topic==='client-authentication')?.covered,true);
 const s=historical.steps[1];
 assert.throws(()=>validateSectionLiterals(s.description,(s.evidence.quotations??[]).map(q=>q.quote).join('\n')),/section-direct-literal-missing/);
});
test('coverage requires explanation and direct quote, not quotation alone',()=>{
 const steps=structuredClone(historical.steps);
 const s=steps[0];
 s.description+=' GET https://oauth.pipedrive.com/oauth/authorize with client_id.';
 assert.equal(sectionCoverage(steps).find(x=>x.topic==='authorization-request')?.covered,true);
 s.evidence.quotations=[];
 assert.equal(sectionCoverage(steps).find(x=>x.topic==='authorization-request')?.covered,false);
});
test('unsupported plain-text configuration names are checked without backticks',()=>{
 assert.throws(()=>validateSectionLiterals('Send refresh_token and application/json.','Unrelated OAuth instructions.'),/section-direct-literal-missing/);
 assert.doesNotThrow(()=>validateSectionLiterals('Use application/x-www-form-urlencoded with client_id.','Use application/x-www-form-urlencoded with client_id.'));
});

import {validateSectionMethodUrls,validateSectionInterpretation} from '../scripts/helpers/section-coverage';
test('HTTP method matching ignores sentence punctuation but preserves endpoints and methods',()=>{
 const quote='```text\nGET https://oauth.example.com/authorize?client_id=example\n```';
 for(const punctuation of ['.',',',';',''])assert.doesNotThrow(()=>validateSectionMethodUrls('GET https://oauth.example.com/authorize?client_id=example'+punctuation,[quote]));
 assert.doesNotThrow(()=>validateSectionMethodUrls('GET https://oauth.example.com/authorize',[quote]));
 for(const wrong of ['POST https://oauth.example.com/authorize?client_id=example','GET https://oauth.example.com/authorize?client_id=other','GET https://oauth.example.com/other'])assert.throws(()=>validateSectionMethodUrls(wrong,[quote]),/section-http-method-unsupported/);
});
test('documentation sample values require clear example and replacement wording',()=>{
 const url='https://oauth.example.com/authorize?client_id=example&redirect_uri=https://example.com/callback';
 assert.throws(()=>validateSectionInterpretation('Redirect to '+url,''),/section-example-values-unqualified/);
 assert.throws(()=>validateSectionInterpretation('Example: '+url,''),/section-example-values-unqualified/);
 assert.doesNotThrow(()=>validateSectionInterpretation('Example: '+url+' . Replace sample values with your own configuration.',''));
 for(const label of ['example','examples','sample','samples','Examples','SAMPLES']){
  assert.doesNotThrow(()=>validateSectionInterpretation(url+' . These values are '+label+'; replace them with your own registered values.',''));
  assert.throws(()=>validateSectionInterpretation(url+' . These values are '+label+'.',''),/section-example-values-unqualified/);
 }
 assert.throws(()=>validateSectionInterpretation(url+' . Counterexamples; replace values.',''),/section-example-values-unqualified/);
});
test('access and refresh token outcome needs both types in direct quotations',()=>{
 assert.throws(()=>validateSectionInterpretation('Receive access and refresh tokens.','Exchange the code for a pair of tokens.'),/section-token-outcome-unsupported/);
 assert.doesNotThrow(()=>validateSectionInterpretation('Receive access and refresh tokens.','Response includes access_token and refresh_token.'));
});

test('latest authentic output no longer fails punctuation but still exposes real content issues',()=>{
 const response:{section:{steps:{description:string;expectedOutcome:string;evidence:{evidenceIds:string[]}}[]}}=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-staged-tightened-historical.json',import.meta.url),'utf8'));
 // These aliases are the exact retained request manifest, not replacement IDs.
 const registry:Record<string,string>={e3:'evidence-b1430f5e38135b95c4c1b732',e9:'evidence-e5c98cb10a8fdcbf5ab7d32c',e21:'evidence-ec02b4617fd88cf5b42cf3b3',e22:'evidence-f5d783a54933724b2fd4f79d',e23:'evidence-e43d43271a42648be2763b02',e24:'evidence-b83e905331f38e291c361536'};
 const quotes=historical.steps.flatMap(s=>s.evidence.quotations??[]);
 const support=(i:number)=>response.section.steps[i].evidence.evidenceIds.map(id=>{
  const quote=quotes.find(q=>q.evidenceId===registry[id]);assert.ok(quote,'original evidence is retained');return quote.quote;
 });
 const instruction=(i:number)=>response.section.steps[i].description+'\n'+response.section.steps[i].expectedOutcome;
 assert.doesNotThrow(()=>validateSectionMethodUrls(instruction(0),support(0)));
 assert.throws(()=>validateSectionInterpretation(instruction(0),support(0).join('\n')),/section-example-values-unqualified/);
 assert.throws(()=>validateSectionInterpretation(instruction(2),support(2).join('\n')),/section-token-outcome-unsupported/);
 assert.throws(()=>validateSectionLiterals(instruction(3),support(3).join('\n')),/section-direct-literal-missing/);
});

test('genuine token-exchange encoding quotation supports encoding, surrounding context alone does not',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-token-encoding-evidence.json',import.meta.url),'utf8'));
 const e=data.excerpt;
 assert.equal(e.id,'evidence-f9dc355fdfc1eab4c1d2eae3');
 assert.equal(e.sourceUrl,'https://pipedrive.readme.io/docs/marketplace-oauth-authorization');
 assert.equal(e.sectionHeading,'## Step 4 and Step 5: Getting the tokens');
 assert.equal(e.quote,'The content-type for the request must be `application/x-www-form-urlencoded`.');
 assert.equal(e.clipped,false);
 const response=JSON.parse(readFileSync(new URL('./fixtures/pipedrive-staged-tightened-historical.json',import.meta.url),'utf8'));
 const instruction=response.section.steps[3].description;
 const basic=historical.steps.flatMap(s=>s.evidence.quotations??[]).find(q=>q.evidenceId==='evidence-e43d43271a42648be2763b02')!;
 assert.throws(()=>validateSectionLiterals(instruction,basic.quote),/section-direct-literal-missing/);
 assert.doesNotThrow(()=>validateSectionLiterals(instruction,basic.quote+'\n'+e.quote));
 // This is an explicitly constructed offline selection, not repaired historical output.
 assert.equal(response.section.steps[3].evidence.evidenceIds.includes(e.id),false);
});

test('encoding check ignores sentence period without accepting a different media type',()=>{
 const quote='The content-type must be `application/x-www-form-urlencoded`.';
 assert.doesNotThrow(()=>validateSectionLiterals('Use application/x-www-form-urlencoded.',quote));
 assert.throws(()=>validateSectionLiterals('Use application/json.',quote),/section-direct-literal-missing/);
});
