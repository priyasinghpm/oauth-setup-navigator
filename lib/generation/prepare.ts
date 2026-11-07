import {selectGenerationEvidence} from './select-evidence';
import {documentationDelegation,allowedResearchUrl,discoveryScore} from '../research/discovery';
import {canonicalProviderName,assertProviderSources} from './identity';
import { checkedEvidence, researchSourceId } from '../research/evidence';
import { domainOf, safeUrl } from '../research/network';
import { GENERATION_LIMITS } from './types';
import type { GenerationInput, InputSource, PreparedInput } from './types';
export function prepareGeneration(input: GenerationInput): PreparedInput {
  if(!input.provider?.trim() || input.provider.length>100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length>80) throw new Error('Invalid provider identity');
  const research=input.research;
  if(!research || research.status==='website-required' || !research.website || !Array.isArray(research.pages) || !research.pages.length) throw new Error('Retrieved documentation is required');
  const domain=domainOf(safeUrl(research.website));
  const delegations=research.delegations??[];
  if(delegations.length>4)throw new Error('Documentation delegation budget exceeded');
  const verifiedDelegations:typeof delegations=[];
  for(const edge of delegations){
    const parent=research.pages.find(p=>p.url===edge.from);
    const link=parent?.discoveryLinks?.find(l=>{try{return safeUrl(new URL(l.href,edge.from).href).href===edge.to}catch{return false}});
    if(!parent||!link||!research.requests.some(r=>r.url===edge.from&&r.status===200&&!r.error)||!documentationDelegation(safeUrl(edge.from),safeUrl(edge.to),link,domain,verifiedDelegations))throw new Error('Unverified documentation delegation');
    verifiedDelegations.push(edge);
  }
  const delegatedSourceUrls=delegations.map(d=>d.to);
  const provider=canonicalProviderName(input.provider,domain);
  const warnings=['Official quotations are inserted by the backend from stored evidence. AI explanations are separate; matching a quotation does not prove the interpretation is correct.', 'Generated guidance requires human review. Source membership and exact excerpts do not establish semantic correctness. No OAuth flow has been tested.'];
  let remaining: number=GENERATION_LIMITS.maxInputChars;
  let evidenceRemaining: number=GENERATION_LIMITS.maxEvidenceChars;
  const sources:InputSource[]=[];const seen=new Set<string>();
  const pages=[...research.pages].sort((a,b)=>{
    const score=(p:typeof a)=>discoveryScore(safeUrl(p.url),p.title)+p.topics.length*10;
    return score(b)-score(a);
  });
  for(const page of pages) {
    if(sources.length>=GENERATION_LIMITS.maxSources || remaining<100)break;
    const url=allowedResearchUrl(page.url,domain,delegations).href;
    const sourceId=researchSourceId(url);
    if(page.sourceId!==undefined && page.sourceId!==sourceId)throw new Error('Research source ID does not match its canonical URL');
    if(seen.has(url) || !page.text?.trim() || page.trust!=='untrusted-source-text')continue;
    if(!research.requests.some(r=>r.url===url && r.status===200 && !r.error)) throw new Error('Source has no successful retrieval record');
    const inspectedAt=page.retrievedAt?.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(inspectedAt) || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(inspectedAt).toISOString().slice(0,10)!==inspectedAt) throw new Error('Invalid retrieval date');
    const text=page.text.slice(0,Math.min(GENERATION_LIMITS.maxCharsPerSource,remaining));remaining-=text.length;
    const truncated=page.truncated || text.length<page.text.length;
    // Research owns the strings. A cached registry is verified against retained text.
    const candidates=checkedEvidence(page.text,url,page.title,page.excerpts,page.truncated);
    if(!candidates.some(e=>/oauth|authoriz|client[_ -]?(?:id|secret)|token|scope|redirect|callback|app.{0,30}(?:review|approv|register|creat)/i.test(e.quote)))continue;
    const selection=selectGenerationEvidence(candidates,{
      maxChars:Math.min(GENERATION_LIMITS.maxEvidenceChars/GENERATION_LIMITS.maxSources,evidenceRemaining),
      maxExcerpts:GENERATION_LIMITS.maxExcerptsPerSource,
    });
    const excerpts=selection.excerpts;
    evidenceRemaining-=selection.usedChars;
    if(selection.bundleReports.some(b=>!b.complete))warnings.push('Some related request-configuration evidence blocks did not fit the selection budget. Missing request or response details must remain unknown; surrounding context is not a substitute for direct evidence.');
    if(!excerpts.length)continue;
    sources.push({originalText:page.text,id:sourceId,url,title:page.title.slice(0,300),inspectedAt,text,truncated,excerpts});seen.add(url);
  }
  assertProviderSources(provider,domain,sources,delegatedSourceUrls);
  if(!sources.length || !sources.some(s=>/oauth|authorization.code/i.test(s.text)))throw new Error('No usable OAuth documentation in retrieved input');
  if(sources.some(s=>s.truncated))warnings.push('Source summaries or research text were truncated. Only selected exact excerpts and their context are evidence; other text is not supplied to the model.');
  if(pages.length>sources.length)warnings.push('Only the highest-ranked sources were sent; unsent pages cannot support generated claims.');
  const joined=sources.flatMap(s=>s.excerpts.map(e=>e.sectionHeading+'\n'+e.contextBefore+e.quote+e.contextAfter)).join('\n');
  const reviewEvidenceMissing=research.missingTopics.includes('review') || !/app.review|security.review|verification.require|approval.require|marketplace.{0,40}review/i.test(joined);
  const approvalTimingMissing=reviewEvidenceMissing || !/(?:review|approval|verification)[^.\n]{0,160}\b\d+[–\-\d ]*\s*(?:business\s+)?(?:days?|weeks?|hours?)\b/i.test(joined);
  const errorSections=[...sources.flatMap(s=>s.excerpts.map(e=>e.sectionHeading+'\n'+e.quote)).join('\n').matchAll(/(?:^|\n)#{1,4}[^\n]*(?:error|troubleshoot)[^\n]*\n([\s\S]*?)(?=\n#{1,4} |$)/gi)].map(match=>match[1]);
  const troubleshootingEvidenceMissing=research.missingTopics.includes('troubleshooting') || !errorSections.some(section=>/retry|try again|reauthoriz|re-authoriz|check|correct|ensure|contact.{0,20}support/i.test(section));
  if(troubleshootingEvidenceMissing)warnings.push('No explicit recovery instructions were established in error/troubleshooting sections; blocker fixes must remain unknown.');
  // Request-local compact references point at research-owned canonical IDs.
  // Retain these bindings; never reconstruct them from a model response.
  const evidenceRegistry=Object.freeze(sources.flatMap(source=>source.excerpts.map(excerpt=>({sourceId:source.id,evidenceId:excerpt.id}))).map((entry,i)=>Object.freeze({id:`e${i+1}`,...entry})));
  return {delegatedSourceUrls,evidenceRegistry,providerDomain:domain,provider,slug:input.slug,researchedAt:sources.map(s=>s.inspectedAt).sort().at(-1)!,sources,reviewEvidenceMissing,approvalTimingMissing,troubleshootingEvidenceMissing,warnings};
}
