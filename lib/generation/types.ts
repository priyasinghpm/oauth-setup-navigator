import type {RecoveryState} from './recovery';
import type {ProviderDiagnostic} from './provider-diagnostics';
import type {ValidationDiagnostic} from './diagnostics';
import type { OAuthGuide, OfficialSource, OfficialQuotation } from '../types';
import type { ResearchResult, ResearchExcerpt } from '../research/types';
export const GENERATION_MODEL = 'gemini-3.5-flash-lite';
export const GENERATION_LIMITS = {maxSources:5,maxCharsPerSource:12000,maxInputChars:54000,maxOutputBytes:70000,maxOutputTokens:8192,maxExcerptsPerSource:12,maxEvidenceChars:36000,timeoutMs:60000} as const;
export interface GenerationInput { provider: string; slug: string; research: ResearchResult }
export interface InputSource extends OfficialSource { originalText?:string; text: string; truncated: boolean; excerpts: ResearchExcerpt[] }
export interface EvidenceReference { readonly id:string; readonly sourceId:string; readonly evidenceId:string }
export interface PreparedInput { providerDomain:string; delegatedSourceUrls?:string[]; evidenceRegistry:readonly EvidenceReference[]; provider: string; slug: string; researchedAt: string; sources: InputSource[]; reviewEvidenceMissing: boolean; approvalTimingMissing: boolean; troubleshootingEvidenceMissing: boolean; warnings: string[] }
export interface EvidenceSelection { evidenceIds: string[] }
export interface ClaimSupport extends OfficialQuotation { path: string }
export interface ModelRequest { systemInstruction: string; contents: string; jsonSchema: unknown }
export interface ModelReply { text: string; finishReason?: string; returnedModel?: string }
export type ModelTransport = ((request: ModelRequest) => Promise<ModelReply>) & {readonly model?:string;readonly provider?:string};
export type GenerationError = 'invalid-input' | 'missing-key' | 'rate-limited' | 'timeout' | 'provider-error' | 'invalid-json' | 'invalid-guide';
export type GenerationResult = {
  ok: true; guide: OAuthGuide; support: ClaimSupport[]; sources: Omit<InputSource,'text'|'originalText'|'excerpts'>[]; warnings: string[];
  model: string; realRequestCount: number; jsonValid: true; schemaValid: true;
} | {
  ok: false; partial?:RecoveryState; error: GenerationError; message: string; sanitizedProviderError?: string; diagnostic?:ValidationDiagnostic; providerDiagnostic?:ProviderDiagnostic; realRequestCount: number; jsonValid: boolean; schemaValid: false;
};
