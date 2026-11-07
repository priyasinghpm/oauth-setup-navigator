import type {Delegation,DiscoveryLink} from './discovery';
export interface ResearchExcerpt {
  extractionVersion?:'blocks-v2'|'blocks-v3'; kind?:'paragraph'|'code';
  id: string; sourceId?: string; sourceUrl: string; sourceTitle: string; quote: string;
  contextBefore: string; contextAfter: string; sectionHeading: string;
  startOffset: number; endOffset: number; clipped: boolean;
}
export type Topic = 'app-creation' | 'redirect-uris' | 'scopes' | 'authorization' | 'review' | 'distribution' | 'troubleshooting';
export interface ResearchInput { provider?: string; website?: string; seedUrls?: string[] }
export interface ResearchLimits { maxRequests: number; maxPages: number; maxBytes: number; maxTextChars: number; timeoutMs: number; totalTimeoutMs: number; maxRedirects: number }
export interface ResearchPage { discoveryMethod?:'pattern-probe'; discoveryLinks?:DiscoveryLink[]; sourceId?: string; excerpts?: ResearchExcerpt[]; url: string; requestedUrl: string; title: string; text: string; topics: Topic[]; discoveredFrom: string; retrievedAt: string; truncated: boolean; trust: 'untrusted-source-text'; indexing: 'noindex' | 'unspecified' }
export interface RequestLog { url: string; status?: number; error?: string; kind: 'robots' | 'sitemap' | 'page' }
export interface ResearchResult {
  patternFallback?:{triggered:boolean;candidateUrls:string[];attemptedUrls:string[];requestCount:number};
  delegations?:Delegation[];
  status: 'complete' | 'partial' | 'website-required';
  website?: string; domainEstablishedBy?: 'user-website' | 'reviewed-registry';
  message: string; pages: ResearchPage[]; requests: RequestLog[];
  failures: { url: string; reason: string }[];
  missingTopics: Topic[]; limits: ResearchLimits; requestCount: number;
  limitations: string[];
}
export interface WireResponse { status: number; headers: Record<string, string | undefined>; body: string }
export interface ResolvedAddress { address: string; family: number }
export interface TransportOptions { address: ResolvedAddress; timeoutMs: number; maxBytes: number }
export interface ResearchDependencies {
  resolve(hostname: string): Promise<ResolvedAddress[]>;
  request(url: URL, options: TransportOptions): Promise<WireResponse>;
}
