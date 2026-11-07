import type {OAuthGuide,Evidence} from '../types';
import type {PreparedInput,ClaimSupport} from './types';
import {GuideValidationError,type ValidationCode} from '../validation-errors';
import {validateInstructionEvidence} from './evidence-quality';
export function fragmentEntries(guide:Partial<OAuthGuide>){
 const entries:{path:string;evidence:Evidence}[]=[];
 for(const field of ['approvalSummary','approvalWaitingTime'] as const)if(guide[field])entries.push({path:field,evidence:guide[field].evidence});
 for(const field of ['prerequisites','steps','scopes','approval','blockers','nextActions'] as const)guide[field]?.forEach((v,i)=>entries.push({path:`${field}.${i}`,evidence:v.evidence}));
 for(const role of ['agent','developer'] as const)guide.responsibilities?.[role].forEach((v,i)=>entries.push({path:`responsibilities.${role}.${i}`,evidence:v.evidence}));
 return entries;
}
function fail(code:ValidationCode,message:string,path?:string):never{throw new GuideValidationError('guide-rules',code,message,path);}
export function validateContentRules(guide:Partial<OAuthGuide>,support:ClaimSupport[],input:PreparedInput){
 const registry=new Set(input.sources.map(s=>s.id));
 for(const field of ['prerequisites','scopes','approval'] as const)if((guide[field]?.length??0)>4)fail('guide-collection-limit','Generated collection exceeds configured limits',field);
 for(const field of ['blockers','nextActions'] as const)if((guide[field]?.length??0)>3)fail('guide-collection-limit','Generated collection exceeds configured limits',field);
 for(const role of ['agent','developer'] as const)if((guide.responsibilities?.[role].length??0)>3)fail('guide-collection-limit','Generated collection exceeds configured limits','responsibilities.'+role);
 for(const [i,scope] of (guide.scopes??[]).entries()){
  if(scope.evidence.status==='estimated')fail('guide-scope-status-invalid','Scope identifiers and permission requirements cannot be estimated',`scopes.${i}`);
  if(scope.evidence.status==='unknown'&&scope.name!=='Not established')fail('guide-scope-unknown-name-required','Unknown scope information must use the explicit gap label',`scopes.${i}`);
  if(scope.evidence.status==='documented'&&scope.name==='Not established')fail('guide-scope-placeholder-documented','A scope gap cannot be labeled documented',`scopes.${i}`);
 }
 for(const entry of fragmentEntries(guide)){
  for(const id of entry.evidence.sourceIds)if(!registry.has(id))fail('guide-source-unsent','Claim cites a source not sent to the model',entry.path);
  if(entry.evidence.status==='documented')for(const id of entry.evidence.sourceIds)if(!support.some(s=>s.path===entry.path&&s.sourceId===id))fail('guide-support-missing','Documented claim lacks a supporting evidence selection',entry.path);
  if(entry.evidence.status==='estimated'&&/^(prerequisites|steps|scopes|blockers|approval)\./.test(entry.path)&&!entry.evidence.sourceIds.length)fail('guide-inference-basis-required','Inferred setup advice must cite its retrieved basis or be unknown',entry.path);
 }
 if(input.reviewEvidenceMissing&&(guide.approvalSummary&&guide.approvalSummary.evidence.status!=='unknown'||guide.approval?.some(c=>c.evidence.status!=='unknown')))fail('guide-review-must-be-unknown','Missing review evidence must be disclosed as unknown','approval');
 if(input.reviewEvidenceMissing&&[guide.approvalSummary,...guide.approval??[]].some(c=>c&&c.evidence.sourceIds.length))fail('guide-review-unknown-citations','Unknown approval requirements must not attach unsupported citations','approval');
 if(guide.approvalWaitingTime){const item=guide.approvalWaitingTime;
  if(input.approvalTimingMissing&&item.evidence.sourceIds.length)fail('guide-duration-unknown-citations','Unknown approval duration must not attach unsupported citations','approvalWaitingTime');
  if(input.approvalTimingMissing&&item.evidence.status!=='unknown')fail('guide-duration-must-be-unknown','Missing approval duration must be unknown','approvalWaitingTime');
  if(item.evidence.status==='unknown'&&/\b\d+\s*(?:[–-]\s*\d+\s*)?(?:business\s+)?(?:days?|weeks?|hours?|months?|minutes?)\b/i.test(item.text))fail('guide-duration-invented','Unknown approval duration must not invent a numeric waiting time','approvalWaitingTime');
 }
 if(input.troubleshootingEvidenceMissing&&guide.blockers?.some(b=>b.evidence.status!=='unknown'))fail('guide-recovery-must-be-unknown','Missing troubleshooting evidence must be disclosed as unknown','blockers');
 validateInstructionEvidence({steps:guide.steps??[],prerequisites:guide.prerequisites??[],scopes:guide.scopes??[]},support);
}
