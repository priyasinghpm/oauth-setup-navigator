import {GuideValidationError,VALIDATION_CODES,VALIDATION_STAGES} from '../validation-errors';
import type {ValidationCode,ValidationStage} from '../validation-errors';
import type {PreparedInput} from './types';
export interface ValidationDiagnostic {
 stage:ValidationStage;code:ValidationCode;fieldPath?:string;evidenceId?:string;
 sourceCount:number;excerptCount:number;selectedEvidenceCount:number;
 reviewEvidenceMissing?:boolean;approvalTimingMissing?:boolean;troubleshootingEvidenceMissing?:boolean;
 requiredOAuthTestStatus:'not-tested';declaredOAuthTestStatus:'not-tested'|'invalid-or-missing';
}
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
const fields=new Set('guide guides section evidenceRegistry slug name category mark summary keywords verificationStatus oauthTestStatus lastResearchedAt difficulty level explanation setupEstimate minMinutes maxMinutes approvalSummary approvalWaitingTime prerequisites steps scopes approval blockers responsibilities agent developer sources nextActions text title description expectedOutcome purpose issue action evidence status evidenceIds sourceIds qualification quotations evidenceId sourceId sourceUrl sourceTitle quote contextBefore contextAfter sectionHeading startOffset endOffset clipped id url inspectedAt'.split(' '));
function safePath(v:unknown):string|undefined{
 if(typeof v!=='string'||v.length>200)return;
 const path=v.replace(/^guides\[\d{1,5}\]/,'guide');
 if(!/^[a-zA-Z0-9.[\]]+$/.test(path))return;
 const tokens=path.split(/[.\[\]]/).filter(Boolean);
 if(tokens.length&&tokens.every(t=>fields.has(t)||/^\d{1,5}$/.test(t)))return path;
}
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000?v:0;
// Positive allowlist: never copy arbitrary error/result properties or messages.
export function sanitizeValidationDiagnostic(value:unknown):ValidationDiagnostic{
 const v=record(value)?value:{};
 const stage=VALIDATION_STAGES.find(s=>s===v.stage)??'guide-validation';
 const code=VALIDATION_CODES.find(c=>c===v.code)??'validation-unclassified';
 const fieldPath=safePath(v.fieldPath);
 const evidenceId=typeof v.evidenceId==='string'&&/^(?:evidence-[a-f0-9]{24}|e[1-9][0-9]{0,2})$/.test(v.evidenceId)?v.evidenceId:undefined;
 return {stage,code,...fieldPath?{fieldPath}:{},...evidenceId?{evidenceId}:{},sourceCount:count(v.sourceCount),excerptCount:count(v.excerptCount),selectedEvidenceCount:count(v.selectedEvidenceCount),requiredOAuthTestStatus:'not-tested',declaredOAuthTestStatus:v.declaredOAuthTestStatus==='not-tested'?'not-tested':'invalid-or-missing',...typeof v.reviewEvidenceMissing==='boolean'?{reviewEvidenceMissing:v.reviewEvidenceMissing}:{},...typeof v.approvalTimingMissing==='boolean'?{approvalTimingMissing:v.approvalTimingMissing}:{},...typeof v.troubleshootingEvidenceMissing==='boolean'?{troubleshootingEvidenceMissing:v.troubleshootingEvidenceMissing}:{}};
}
export function validationDiagnostic(error:unknown,input:PreparedInput,value:unknown):ValidationDiagnostic{
 const guide=record(value)&&record(value.guide)?value.guide:{};
 const claims:unknown[]=[guide.difficulty,guide.setupEstimate,guide.approvalSummary,guide.approvalWaitingTime];
 for(const key of ['prerequisites','steps','scopes','approval','blockers','nextActions'])if(Array.isArray(guide[key]))claims.push(...guide[key]);
 if(record(guide.responsibilities))for(const role of ['agent','developer'])if(Array.isArray(guide.responsibilities[role]))claims.push(...guide.responsibilities[role]);
 const selectedEvidenceCount=claims.reduce<number>((n,c)=>n+(record(c)&&record(c.evidence)&&Array.isArray(c.evidence.evidenceIds)?c.evidence.evidenceIds.length:0),0);
 return sanitizeValidationDiagnostic({...(error instanceof GuideValidationError?{stage:error.stage,code:error.code,fieldPath:error.fieldPath,evidenceId:error.evidenceId}:{}),sourceCount:input.sources.length,excerptCount:input.sources.reduce((n,s)=>n+s.excerpts.length,0),selectedEvidenceCount,reviewEvidenceMissing:input.reviewEvidenceMissing,approvalTimingMissing:input.approvalTimingMissing,troubleshootingEvidenceMissing:input.troubleshootingEvidenceMissing,declaredOAuthTestStatus:guide.oauthTestStatus});
}
export interface ValidationLog extends ValidationDiagnostic {event:'oauth-guide-validation-failed';requestId:string;timestamp:string}
export function validationLog(requestId:string,value:unknown):ValidationLog{
 return {event:'oauth-guide-validation-failed',requestId:/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId)?requestId:'invalid-request-id',timestamp:new Date().toISOString(),...sanitizeValidationDiagnostic(value)};
}
