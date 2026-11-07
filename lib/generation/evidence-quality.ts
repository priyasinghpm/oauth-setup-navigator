import {LIFECYCLE,lifecycleCoverage} from '../oauth-lifecycle';
import {GuideValidationError} from '../validation-errors';
import type {OAuthGuide} from '../types';
import type {ClaimSupport,PreparedInput} from './types';
// Necessary topic/literal checks, not entailment or semantic verification.
function fail(code:'guide-evidence-clipped'|'guide-evidence-command-incomplete'|'guide-evidence-literal-missing'|'guide-evidence-topic-mismatch',path:string):never{throw new GuideValidationError('guide-rules',code,'Selected evidence does not directly support the instruction checks',path);}
export function incompleteCommand(text:string):boolean{
 const trimmed=text.trim();
 if(/^\s*curl\b/m.test(trimmed)&&(!/https?:\/\/|\$[A-Z_{]/.test(trimmed)||/(?:--url|--request|--data|--header|-X|-d|-H)\s*(?:`{3,})?\s*$/.test(trimmed)))return true;
 return /\\\s*$/.test(trimmed)||(/^\s*`{3,}/.test(trimmed)&&(trimmed.match(/^\s*`{3,}/gm)?.length??0)%2!==0)||(/^(?:curl|hs|npm|npx)\s/m.test(trimmed)&&/\\\s*(?:`{3,})?\s*$/.test(trimmed));
}
export function validateInstructionEvidence(guide:Pick<OAuthGuide,'steps'|'prerequisites'|'scopes'>,support:ClaimSupport[]):void{
 const claims=[...guide.steps.map((s,i)=>({...s,path:`steps.${i}`})),...guide.prerequisites.map((s,i)=>({title:'',description:s.text,expectedOutcome:'',evidence:s.evidence,path:`prerequisites.${i}`})),...guide.scopes.map((s,i)=>({title:'Scopes',description:s.purpose,expectedOutcome:'',evidence:s.evidence,path:`scopes.${i}`,scope:s.name}))];
 for(const step of claims){
  const path=step.path;if(step.evidence.status!=='documented')continue;
  const quotes=support.filter(q=>q.path===path);
  if(quotes.some(q=>q.clipped))fail('guide-evidence-clipped',path);
  if(quotes.some(q=>incompleteCommand(q.quote)))fail('guide-evidence-command-incomplete',path);
  const direct=quotes.map(q=>q.quote).join('\n');
  if('scope' in step&&typeof step.scope==='string'&&!direct.includes(step.scope))fail('guide-evidence-literal-missing',path);
  // Only the selected quotation counts; surrounding context cannot silently
  // substitute for a missing command, endpoint, scope or configuration value.
  const instruction=step.description+'\n'+step.expectedOutcome;
  const literals=[...instruction.matchAll(/`([^`\n]+)`/g)].map(m=>m[1]).filter(s=>/[._=/:]/.test(s)||/^(?:curl|hs|npm|npx|pip|git|python)\s/.test(s));
  literals.push(...[...instruction.matchAll(/\bhs\s+(?:project\s+(?:create|upload|open|add)|accounts?\s+auth|init)\b/g)].map(m=>m[0]));
  literals.push(...[...instruction.matchAll(/https:\/\/[^\s`"'<>()[\]]+/g)].map(m=>m[0].replace(/[.,;]+$/,'')));
  literals.push(...[...instruction.matchAll(/\b\d+\s+(?:minutes?|hours?|days?|weeks?)\b/gi)].map(m=>m[0]));
  for(const literal of literals){
   const assignment=literal.match(/^([A-Za-z_][\w.-]*)=([A-Za-z0-9_:/.-]+)$/);
   if(assignment){
    const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pair=new RegExp('(?<![\\w.-])'+escape(assignment[1])+`["\\s]*[:=]\\s*["']?`+escape(assignment[2])+`(?=[\\s"',}\\]]|$)`);
    if(!pair.test(direct))fail('guide-evidence-literal-missing',path);
   }else if(!direct.includes(literal))fail('guide-evidence-literal-missing',path);
  }
  for(const [,topic] of LIFECYCLE)if(topic.test(step.title)&&!topic.test(direct))fail('guide-evidence-topic-mismatch',path);
 }
}
export function lifecycleWarnings(guide:OAuthGuide,input:PreparedInput):string[]{
 const available=input.sources.flatMap(s=>s.excerpts.map(e=>e.quote)).join('\n');
 return lifecycleCoverage(guide).filter(c=>!c.described).map(c=>{
  const rule=LIFECYCLE.find(([name])=>name===c.stage)!;
  return `${c.stage}: not described in the generated steps. ${rule[1].test(available)?'Retrieved text contains relevant topic terms; review the coverage gap.':'Requirements were not established in selected excerpts.'}`;
 });
}
