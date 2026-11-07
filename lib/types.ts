export interface OfficialQuotation {
  evidenceId: string; sourceId: string; sourceUrl: string; sourceTitle: string;
  quote: string; contextBefore: string; contextAfter: string; sectionHeading: string;
  startOffset: number; endOffset: number; clipped: boolean;
}
export type EvidenceStatus = 'documented' | 'estimated' | 'unknown';
export interface Evidence {
  quotations?: OfficialQuotation[];
  status: EvidenceStatus;
  sourceIds: string[];
  qualification?: string;
}
export interface Claim { text: string; evidence: Evidence }
export interface OfficialSource { id: string; title: string; url: string; inspectedAt: string }
export interface OAuthGuide {
  slug: string;
  name: string;
  category: string;
  mark: string;
  summary: string;
  keywords: string[];
  verificationStatus: 'source-backed';
  oauthTestStatus: 'not-tested';
  lastResearchedAt: string;
  difficulty: { level: 'Easy' | 'Moderate' | 'Complex'; explanation: string; evidence: Evidence };
  setupEstimate: { minMinutes: number; maxMinutes: number; evidence: Evidence };
  approvalSummary: Claim;
  approvalWaitingTime: Claim;
  prerequisites: Claim[];
  steps: { title: string; description: string; expectedOutcome: string; evidence: Evidence }[];
  scopes: { name: string; purpose: string; evidence: Evidence }[];
  approval: Claim[];
  blockers: { issue: string; action: string; evidence: Evidence }[];
  responsibilities: { agent: Claim[]; developer: Claim[] };
  sources: OfficialSource[];
  nextActions: Claim[];
}
