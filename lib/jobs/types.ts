import {WORKER_HOURLY_LIMIT} from './limits';
import type {ProviderDiagnostic} from '../generation/provider-diagnostics';
import type {ValidationDiagnostic} from '../generation/diagnostics';
import type {ResearchResult,ResearchInput} from '../research/types';
import type {PreparedInput} from '../generation/types';
import type {OAuthGuide} from '../types';
export const SECTION_KEYS=['foundation','authorization','renewal','distribution'] as const;
export type SectionKey=typeof SECTION_KEYS[number];
export const STAGES=['research',...SECTION_KEYS,'assemble'] as const;
export type JobStage=typeof STAGES[number];
export type JobStatus='queued'|'running'|'paused'|'failed'|'completed';
export interface SectionCheckpoint {key:SectionKey;input:PreparedInput;draft:unknown;content:Partial<OAuthGuide>;completedAt:string;model:string}
export interface GenerationJob {version:1;id:string;createdAt:string;updatedAt:string;input:ResearchInput;status:JobStatus;stageIndex:number;attempts:number;runId?:string;startedAt?:string;research?:ResearchResult;sections:SectionCheckpoint[];error?:{code:string;stage:JobStage;requestId?:string;validation?:ValidationDiagnostic;provider?:ProviderDiagnostic};saved?:{id:string;path:string};reviewStatus:'not-human-reviewed';oauthTestStatus:'not-tested'}
export const STAGE_TITLES:Record<JobStage,string>={research:'Research official documentation',foundation:'Registration, prerequisites and permissions',authorization:'Authorization and token exchange',renewal:'Token renewal',distribution:'Distribution, approval and troubleshooting',assemble:'Validate and save the complete guide'};
export interface QueueWaiting {reason:'rate-limit'|'worker-offline'|'awaiting-worker'|'unknown';worker:'running'|'not-running'|'unknown';quotaUsed:number;quotaLimit:typeof WORKER_HOURLY_LIMIT;retryAt?:string;retryAfterSeconds?:number}
export interface JobView {waiting?:QueueWaiting;id:string;status:JobStatus;stageIndex:number;createdAt:string;updatedAt:string;attempts:number;provider:string;researchDate?:string;sourceCount:number;sections:{key:SectionKey;title:string;completedAt:string;content:Partial<OAuthGuide>;sources:OAuthGuide['sources']}[];error?:GenerationJob['error'];saved?:GenerationJob['saved'];reviewStatus:'not-human-reviewed';oauthTestStatus:'not-tested'}
