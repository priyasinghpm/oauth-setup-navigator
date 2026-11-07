import type {ResearchResult,ResearchExcerpt} from '../research/types';
import type {PreparedInput} from '../generation/types';
import {resolveModelEvidence} from '../generation/resolve';
export function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string');
function excerpt(v:unknown):v is ResearchExcerpt{
 return record(v)&&['id','sourceUrl','sourceTitle','quote','contextBefore','contextAfter','sectionHeading'].every(k=>typeof v[k]==='string')&&typeof v.startOffset==='number'&&typeof v.endOffset==='number'&&typeof v.clipped==='boolean'&&(v.sourceId===undefined||typeof v.sourceId==='string')&&(v.kind===undefined||v.kind==='code'||v.kind==='paragraph')&&(v.extractionVersion===undefined||v.extractionVersion==='blocks-v2'||v.extractionVersion==='blocks-v3');
}
function prepared(v:unknown):v is PreparedInput{
 return record(v)&&['providerDomain','provider','slug','researchedAt'].every(k=>typeof v[k]==='string')&&['reviewEvidenceMissing','approvalTimingMissing','troubleshootingEvidenceMissing'].every(k=>typeof v[k]==='boolean')&&strings(v.warnings)&&(v.delegatedSourceUrls===undefined||strings(v.delegatedSourceUrls))&&Array.isArray(v.evidenceRegistry)&&v.evidenceRegistry.every(r=>record(r)&&['id','sourceId','evidenceId'].every(k=>typeof r[k]==='string'))&&Array.isArray(v.sources)&&v.sources.every(s=>record(s)&&['id','title','url','inspectedAt','text'].every(k=>typeof s[k]==='string')&&(s.originalText===undefined||typeof s.originalText==='string')&&typeof s.truncated==='boolean'&&Array.isArray(s.excerpts)&&s.excerpts.every(excerpt));
}
export function parsePrepared(v:unknown):PreparedInput{if(!prepared(v))throw Error('invalid-job-evidence');resolveModelEvidence({guide:{}},v);return v;}
const topics=new Set(['app-creation','redirect-uris','scopes','authorization','review','distribution','troubleshooting']);
function research(v:unknown):v is ResearchResult{
 if(!record(v)||!['complete','partial','website-required'].includes(String(v.status))||typeof v.message!=='string'||!Array.isArray(v.pages)||!Array.isArray(v.requests)||!Array.isArray(v.failures)||!strings(v.missingTopics)||v.missingTopics.some(t=>!topics.has(t))||!strings(v.limitations)||typeof v.requestCount!=='number'||!record(v.limits))return false;
 const limits=v.limits;
 if(!['maxRequests','maxPages','maxBytes','maxTextChars','timeoutMs','totalTimeoutMs','maxRedirects'].every(k=>typeof limits[k]==='number'))return false;
 if(v.website!==undefined&&typeof v.website!=='string')return false;
 if(v.domainEstablishedBy!==undefined&&v.domainEstablishedBy!=='user-website'&&v.domainEstablishedBy!=='reviewed-registry')return false;
 if(v.delegations!==undefined&&(!Array.isArray(v.delegations)||!v.delegations.every(d=>record(d)&&['from','to','label'].every(k=>typeof d[k]==='string'))))return false;
 return v.pages.every(p=>record(p)&&['url','requestedUrl','title','text','discoveredFrom','retrievedAt'].every(k=>typeof p[k]==='string')&&typeof p.truncated==='boolean'&&p.trust==='untrusted-source-text'&&['noindex','unspecified'].includes(String(p.indexing))&&strings(p.topics)&&p.topics.every(t=>topics.has(t))&&(p.sourceId===undefined||typeof p.sourceId==='string')&&(p.excerpts===undefined||Array.isArray(p.excerpts)&&p.excerpts.every(excerpt))&&(p.discoveryMethod===undefined||p.discoveryMethod==='pattern-probe')&&(p.discoveryLinks===undefined||Array.isArray(p.discoveryLinks)&&p.discoveryLinks.every(l=>record(l)&&['href','text','context'].every(k=>typeof l[k]==='string')&&(l.nofollow===undefined||typeof l.nofollow==='boolean'))))&&v.requests.every(r=>record(r)&&typeof r.url==='string'&&['robots','sitemap','page'].includes(String(r.kind))&&(r.status===undefined||typeof r.status==='number')&&(r.error===undefined||typeof r.error==='string'))&&v.failures.every(f=>record(f)&&typeof f.url==='string'&&typeof f.reason==='string');
}
export function parseResearch(v:unknown):ResearchResult{if(!research(v))throw Error('invalid-job-research');return v;}
