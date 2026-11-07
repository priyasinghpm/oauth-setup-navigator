import type {Claim} from '../../lib/types';
import type {PreparedInput} from '../../lib/generation/types';
export type CallbackMatching=Claim&{rule:'must-match-registered'|'unknown'};
function statesMatching(text:string){return /callback|redirect/i.test(text)&&/\bmatch(?:es|ing)?\b/i.test(text)&&/\bregist(?:er(?:ed|ing)?|ration)\b/i.test(text);}
export function validateCallbackMatching(claim:CallbackMatching,input:PreparedInput){
 if(claim.rule==='unknown'){
  if(claim.evidence.status!=='unknown'||claim.evidence.sourceIds.length)throw new Error('section-callback-status-mismatch');
  if(input.sources.some(s=>s.excerpts.some(e=>statesMatching(e.quote))))throw new Error('section-callback-known-requirement-omitted');
  return;
 }
 if(claim.evidence.status!=='documented'||!claim.evidence.sourceIds.length)throw new Error('section-callback-support-required');
 if(!statesMatching(claim.text)||!/\bmust\b|\brequired\b/i.test(claim.text))throw new Error('section-callback-instruction-incomplete');
 if(!claim.evidence.quotations?.some(q=>statesMatching(q.quote)))throw new Error('section-callback-direct-support-missing');
 if(/\b(?:need not|does not have to|does not need to|not required to|not necessary to|(?:must|should|shall) not (?:exactly )?match)\b/i.test(claim.text))throw new Error('section-callback-rule-contradiction');
}
