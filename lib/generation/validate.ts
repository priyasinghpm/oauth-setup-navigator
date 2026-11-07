import {validateContentRules} from './claim-rules';
import {validateInstructionEvidence} from './evidence-quality';
import {assertGuideIdentity} from './identity';
import {GuideValidationError,type ValidationCode} from '../validation-errors';
import { resolveModelEvidence } from './resolve';
import { parseGuides } from '../validate-guides';
import type { OAuthGuide, Evidence } from '../types';
import type { ClaimSupport, PreparedInput } from './types';
export function claimEntries(guide: OAuthGuide): {path:string;evidence:Evidence}[] {
  const entries=[{path:'approvalSummary',evidence:guide.approvalSummary.evidence},{path:'approvalWaitingTime',evidence:guide.approvalWaitingTime.evidence}];
  for(const section of ['prerequisites','steps','scopes','approval','blockers','nextActions'] as const) guide[section].forEach((item,i)=>entries.push({path:`${section}.${i}`,evidence:item.evidence}));
  for(const role of ['agent','developer'] as const)guide.responsibilities[role].forEach((item,i)=>entries.push({path:`responsibilities.${role}.${i}`,evidence:item.evidence}));
  return entries;
}
function fail(code:ValidationCode,message:string,path?:string):never{throw new GuideValidationError('guide-rules',code,message,path);}
export function validateGeneratedGuide(value: unknown, input: PreparedInput): {guide:OAuthGuide;support:ClaimSupport[]} {
  const {guideValue,support}=resolveModelEvidence(value,input);
  const registry=new Map(input.sources.map(s=>[s.id,s]));
  const guide=parseGuides([guideValue],{allowedSourceUrls:new Set(input.sources.map(s=>s.url))})[0];
  assertGuideIdentity(guide,input);
  // Only a matching model identity can receive the backend's canonical label.
  guide.name=input.provider;
  if(guide.sources.length!==input.sources.length)fail('guide-sources-incomplete','Generated source registry is incomplete','sources');
  for(const s of guide.sources) {
    const actual=registry.get(s.id);
    if(!actual || s.url!==actual.url || s.title!==actual.title || s.inspectedAt!==actual.inspectedAt)fail('guide-source-metadata','Generated source metadata is not from retrieved input','sources');
  }
  if(guide.steps.length<4 || guide.steps.length>8)fail('guide-step-count','Expected 4–8 actionable setup steps','steps');
  if(guide.keywords.length>8)fail('guide-collection-limit','Generated collection exceeds configured limits','keywords');
  const entries=claimEntries(guide);
  validateContentRules(guide,support,input);
  // Populate quotations only after all model-output and uncertainty checks pass.
  // Explanations remain in their original fields, separate from these stored excerpts.
  for(const entry of entries) {
    const quotations=support.filter(s=>s.path===entry.path).map(({path,...quotation})=>quotation);
    if(quotations.length)entry.evidence.quotations=quotations;
  }
  try{return {guide:parseGuides([guide],{allowedSourceUrls:new Set(input.sources.map(s=>s.url))})[0],support};}
  catch(error){if(error instanceof GuideValidationError)throw new GuideValidationError('final-guide-schema',error.code,error.message,error.fieldPath,error.evidenceId);throw error;}
}
