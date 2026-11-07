import type {ResearchExcerpt} from './types';
// Topic-oriented selection, not semantic verification. Prefer the relevant
// section's substantive text over a mere mention in another lifecycle stage.
export const EVIDENCE_STAGES=[/creat|register|app setup/i,/client|credential/i,/callback|redirect/i,/scope|permission/i,/requesting authorization|consent|authorize/i,/exchang|getting.{0,15}tokens/i,/refresh|renew/i,/distribut|review|approv/i,/troubleshoot|error|status code/i];
export function prioritizeEvidence(candidates:ResearchExcerpt[]):ResearchExcerpt[]{
 const priority:ResearchExcerpt[]=[];
 for(const pattern of EVIDENCE_STAGES){
  const choices=candidates.filter(e=>!e.clipped&&!priority.includes(e)&&pattern.test(e.quote));
  choices.sort((a,b)=>Number(pattern.test(b.sectionHeading))-Number(pattern.test(a.sectionHeading))||Number(b.kind==='code')-Number(a.kind==='code')||a.quote.length-b.quote.length);
  if(choices[0])priority.push(choices[0]);
 }
 return [...priority,...candidates.filter(e=>!priority.includes(e))];
}
