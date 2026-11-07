import {discoveryScore,documentationDelegation,allowedResearchUrl,developerPatternCandidates,promisingDocumentation,type DiscoveryLink} from './discovery';
import {REVIEWED_PROVIDERS} from './provider-registry';
import { extractEvidence, researchSourceId } from './evidence';
import robotsParser from 'robots-parser';
import { safeUrl, domainOf, publicResolution, productionDependencies, USER_AGENT, bounded } from './network';
import { extractPage, TOPICS } from './extract';
import type { ResearchDependencies, ResearchInput, ResearchLimits, ResearchResult, WireResponse } from './types';
export const DEFAULT_LIMITS: ResearchLimits = {maxRequests:24,maxPages:8,maxBytes:3_000_000,maxTextChars:24000,timeoutMs:6000,totalTimeoutMs:60000,maxRedirects:3};
// Reviewed official domains, not a heuristic that appends .com to arbitrary names.
const reviewedWebsites: Record<string,string> = Object.fromEntries(REVIEWED_PROVIDERS.map(p=>[p.key,p.website]));
export async function researchProvider(input: ResearchInput, options: Partial<ResearchLimits> = {}, deps: ResearchDependencies = productionDependencies): Promise<ResearchResult> {
  const limits={...DEFAULT_LIMITS};
  for (const key of Object.keys(limits) as (keyof ResearchLimits)[]) {
    const value=options[key];
    if (value !== undefined) { if (!Number.isInteger(value) || value<1) throw new Error(`Invalid limit: ${key}`); limits[key]=Math.min(value,limits[key]); }
  }
  const result:ResearchResult={status:'partial',message:'',pages:[],requests:[],failures:[],missingTopics:Object.keys(TOPICS) as ResearchResult['missingTopics'],limits,requestCount:0,limitations:[
    'Website input asserts provider identity. External docs require an exact, provider-tenant documentation link from the provider site.',
    'No search index is built. noindex is retained as metadata; nofollow, robots disallow, and extraction restrictions are honored.',
    'Page text is untrusted evidence, never executable instructions. Topic matches indicate coverage candidates, not verified OAuth facts.',
    'No JavaScript rendering, login, CAPTCHA bypass, paywall access, LLM, or search API. Queries and non-HTTPS URLs are excluded.',
  ]};
  const value=input.website?.trim() || (input.provider ? reviewedWebsites[input.provider.trim().toLowerCase()] : undefined);
  if (!value) return {...result,status:'website-required',message:'Please provide the provider’s official website or developer documentation URL. The name is not in the reviewed domain registry.'};
  let start:URL;
  try {start=safeUrl(value.includes('://') ? value : `https://${value}`);} catch {return {...result,status:'website-required',message:'Provide a public HTTPS website without credentials, query parameters, literal IPs, or custom ports.'};}
  const domain=domainOf(start);const delegations:NonNullable<ResearchResult['delegations']>=[];result.delegations=delegations; result.website=start.href; result.domainEstablishedBy=input.website?'user-website':'reviewed-registry';
  const deadline=Date.now()+limits.totalTimeoutMs;
  const remaining=()=>Math.max(0,Math.min(limits.timeoutMs,deadline-Date.now()));
  const errors=(url:string,reason:string)=>{result.failures.push({url,reason});};
  const robots=new Map<string,ReturnType<typeof robotsParser>>();
  const robotsFailed=new Set<string>(); const lastRequest=new Map<string,number>();
  const queue:{url:string;from:string;score:number}[]=[]; const queued=new Set<string>(); const visited=new Set<string>();
  const sitemapSeen=new Set<string>();
  const patternFallback={triggered:false,candidateUrls:[] as string[],attemptedUrls:[] as string[],requestCount:0};
  result.patternFallback=patternFallback;
  const patternUrls=new Set<string>();let patternRequest=false;let initialDiscoveryAllowed=false;
  const usefulDocumentation=()=>result.pages.some(p=>promisingDocumentation(safeUrl(p.url),p.title)&&p.excerpts?.some(e=>/oauth|authorization.code|client[_ -]?(?:id|secret)|refresh[_ -]?token/i.test(e.quote)));
  const promisingDiscovery=()=>result.pages.some(p=>promisingDocumentation(safeUrl(p.url),p.title))||queue.some(p=>!patternUrls.has(p.url)&&!visited.has(p.url)&&promisingDocumentation(safeUrl(p.url)));
  function schedulePatternFallback(){
    if(patternFallback.triggered||!initialDiscoveryAllowed||promisingDiscovery())return;
    patternFallback.triggered=true;
    for(const candidate of developerPatternCandidates(domain)){
      if(queued.has(candidate)||visited.has(candidate))continue;
      patternUrls.add(candidate);patternFallback.candidateUrls.push(candidate);enqueue(candidate,start.href,30);
    }
  }

  function enqueue(raw:string,from:string,boost=0,link?:DiscoveryLink) {
    try {
      const candidate=safeUrl(new URL(raw,from).href);
      if(link){const delegation=documentationDelegation(safeUrl(from),candidate,link,domain,delegations);if(delegation&&!delegations.some(d=>d.to===delegation.to)&&delegations.length<4)delegations.push(delegation);}
      const url=allowedResearchUrl(candidate.href,domain,delegations);
      if (/\.(?:png|jpg|jpeg|gif|svg|webp|ico|zip|pdf|js|css|woff2?|mp4)$/i.test(url.pathname)) return;
      if (!queued.has(url.href) && queue.length<2000) { queued.add(url.href);queue.push({url:url.href,from,score:discoveryScore(url,link?link.text+' '+link.context:'')+boost+(delegations.some(d=>d.to===url.href)?40:0)}); }
    } catch { /* Unsafe links are not fetched or treated as research failures. */ }
  }
  async function rawRequest(url:URL,kind:'robots'|'sitemap'|'page'):Promise<WireResponse> {
    if(patternRequest&&patternFallback.requestCount>=10)throw new Error('Pattern fallback request allowance exhausted');
    if (result.requests.length>=limits.maxRequests || !remaining()) throw new Error('Research request/time budget exhausted');
    if(patternRequest)patternFallback.requestCount++;
    const log:{url:string;kind:typeof kind;status?:number;error?:string}={url:url.href,kind};result.requests.push(log);
    const begin=Date.now();
    try {
      const address=await publicResolution(deps.resolve,url.hostname,remaining());
      const timeoutMs=Math.min(remaining(),limits.timeoutMs-(Date.now()-begin));
      if(timeoutMs<=0) throw new Error('Request timed out');
      const response=await bounded(deps.request(url,{address,timeoutMs,maxBytes:limits.maxBytes}),timeoutMs);
      if(Buffer.byteLength(response.body)>limits.maxBytes) throw new Error('Response exceeds byte limit');
      log.status=response.status;lastRequest.set(url.origin,Date.now());return response;
    } catch(e) {log.error=e instanceof Error?e.message:'Retrieval failed';throw e;}
  }
  async function policy(url:URL):Promise<void> {
    if(robotsFailed.has(url.origin)) throw new Error('Robots policy unavailable or access denied');
    if(!robots.has(url.origin)) {
      const robotsUrl=new URL('/robots.txt',url);
      try {
        const response=await rawRequest(robotsUrl,'robots');
        if(response.status!==404 && response.status!==410 && response.status!==200) throw new Error(`robots.txt returned HTTP ${response.status}; failing closed`);
        const parser=robotsParser(robotsUrl.href,response.status===200?response.body:'');robots.set(url.origin,parser);
        for(const sitemap of parser.getSitemaps().slice(0,2)) enqueue(sitemap,url.href,5);
      }catch(e){robotsFailed.add(url.origin);throw e;}
    }
    const parser=robots.get(url.origin)!;
    if(parser.isAllowed(url.href,USER_AGENT)===false) throw new Error('Disallowed by robots.txt');
    const delay=parser.getCrawlDelay(USER_AGENT);
    const wait=delay ? delay*1000-(Date.now()-(lastRequest.get(url.origin)??0)) : 0;
    if(wait>0) {
      if(wait>remaining() || wait>1000) throw new Error('Crawl-delay exceeds this short research window');
      await new Promise(resolve=>setTimeout(resolve,wait));
    }
  }
  async function retrieve(value:string,kind:'page'|'sitemap'):Promise<{url:URL;response:WireResponse}> {
    let url=allowedResearchUrl(value,domain,delegations);const chain=new Set<string>();
    for(let i=0;i<=limits.maxRedirects;i++) {
      if(chain.has(url.href))throw new Error('Redirect loop');chain.add(url.href);
      await policy(url);
      const response=await rawRequest(url,kind);
      if([301,302,303,307,308].includes(response.status)) {
        if(!response.headers.location) throw new Error('Redirect missing Location');
        const destination=allowedResearchUrl(new URL(response.headers.location,url).href,domain,delegations);
        if(patternRequest){if(visited.has(destination.href))throw new Error('Pattern redirect destination already attempted');visited.add(destination.href);}
        url=destination;continue;
      }
      if(response.status!==200) throw new Error(`HTTP ${response.status}`);
      return {url,response};
    }
    throw new Error('Redirect limit exceeded');
  }
  enqueue(start.href,start.href,1000);
  // Standard discovery endpoints are probes, not assumed documentation sources.
  enqueue(new URL('/sitemap.xml',start).href,start.href,2);
  for (const seed of (input.seedUrls??[]).slice(0,6)) {
    try {safeUrl(seed,domain);enqueue(seed,start.href,50);} catch {errors('[rejected seed]','Seed must be a safe URL within the supplied official domain');}
  }
  while((queue.length||!patternFallback.triggered) && result.pages.length<limits.maxPages && result.requests.length<limits.maxRequests && remaining()) {
    schedulePatternFallback();
    if(!queue.length)break;
    queue.sort((a,b)=>b.score-a.score);
    const item=queue.shift()!;
    if(visited.has(item.url))continue;
    const pattern=patternUrls.has(item.url);
    if(pattern&&(usefulDocumentation()||patternFallback.requestCount>=10))continue;
    // Localized HTML sitemap copies are one discovery branch, not eight pages.
    if(/\/sitemap\/?$/i.test(new URL(item.url).pathname)&&result.pages.some(p=>/\/sitemap\/?$/i.test(new URL(p.url).pathname)))continue;
    if(/\/marketplace(?:\/|$)|\/collections?\//i.test(new URL(item.url).pathname)&&!(/oauth|authenticat/i.test(item.url))&&result.pages.filter(p=>/\/marketplace(?:\/|$)|\/collections?\//i.test(new URL(p.url).pathname)).length>=1)continue;visited.add(item.url);
    const sitemap=/\/sitemap(?:s?\/[^/]+|[^/]*)\.xml$/i.test(new URL(item.url).pathname);
    if(sitemap && sitemapSeen.size>=2)continue;
    if(sitemap)sitemapSeen.add(item.url);
    patternRequest=pattern;
    if(pattern)patternFallback.attemptedUrls.push(item.url);
    try {
      const {url,response}=await retrieve(item.url,sitemap?'sitemap':'page');visited.add(url.href);
      const type=response.headers['content-type']??'';
      if(!/text\/html|application\/xhtml\+xml|text\/plain|markdown|(?:application|text)\/xml/i.test(type)) throw new Error('Unsupported or missing content type');
      const parsed=extractPage(response.body,url.href,type,limits.maxTextChars);
      if(/page.{0,35}(?:not found|doesn.t exist)|^404\b/i.test(parsed.title))throw new Error('Page reports missing content');
      const directives=`${response.headers['x-robots-tag']??''},${parsed.robots}`;
      if(/\b(noai|nosnippet)\b/i.test(directives)) throw new Error('Content extraction excluded by publisher directive');
      if(item.url===start.href&&!/\b(nofollow|none)\b/i.test(directives))initialDiscoveryAllowed=true;
      // Bounded conventional probes on first-party developer entry hosts only.
      // These URLs are discovery attempts, never assumed documentation sources.
      if(!/\b(nofollow|none)\b/i.test(directives)&&domainOf(url)===domain&&url.pathname==='/'&&/^(?:developers?|docs?|api)\./i.test(url.hostname)){
        enqueue(new URL('/docs',url).href,url.href,60);enqueue(new URL('/llms.txt',url).href,url.href,50);
      }

      // noindex prohibits search indexing, not transient user-directed retrieval.
      // We build no search index; retain this policy and obey nofollow/none.
      for(const href of /\b(nofollow|none)\b/i.test(directives)?[]:parsed.links) {
        const detail=parsed.linkDetails.find(link=>link.href===href);
        if(detail?.nofollow)continue;
        try{const target=safeUrl(new URL(href,url).href);
          if(discoveryScore(target,detail?detail.text+' '+detail.context:'')>0)enqueue(href,url.href,0,detail);
        }catch{}
      }
      if(sitemap || /\/llms\.txt$/.test(url.pathname) || !parsed.text)continue;
      result.pages.push({...(pattern?{discoveryMethod:'pattern-probe' as const}:{}),discoveryLinks:parsed.linkDetails.filter(l=>!l.nofollow),sourceId:researchSourceId(url.href),url:url.href,requestedUrl:item.url,title:parsed.title,text:parsed.text,excerpts:extractEvidence(parsed.text,url.href,parsed.title,parsed.truncated),topics:parsed.topics,discoveredFrom:item.from,retrievedAt:new Date().toISOString(),truncated:parsed.truncated,trust:'untrusted-source-text',indexing:/\b(noindex|none)\b/i.test(directives)?'noindex':'unspecified'});
    }catch(e){errors(item.url,e instanceof Error?e.message:'Retrieval failed');}
    finally{patternRequest=false;}
  }
  result.requestCount=result.requests.length;
  result.missingTopics=result.missingTopics.filter(topic=>!result.pages.some(page=>page.topics.includes(topic)));
  result.status=result.pages.length && !result.missingTopics.length?'complete':'partial';
  result.message=result.pages.length?'Retrieved public source material; human review is required before treating it as setup guidance.':'No usable pages retrieved. Supply a more specific official documentation URL or review the reported restrictions.';
  if(queue.length)result.limitations.push('Discovery queue remains: request, page, or total-time cap stopped further retrieval.');
  return result;
}
