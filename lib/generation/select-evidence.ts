import type {ResearchExcerpt} from '../research/types';
import {prioritizeEvidence} from '../research/evidence-selection';
// Structural selection hints, not requirements or semantic verification. No
// provider domains, names, scope identifiers or endpoint values are hardcoded.
const signals=[
 /\b(?:GET|POST|PUT|PATCH|DELETE)`?(?:\s+request\s+to\s+`?|\s+)https?:\/\/|--request\s+(?:GET|POST|PUT|PATCH|DELETE)[\s\\]+--url\s+["']?https?:\/\/|\.(?:get|post|put|patch|delete)\(\s*["']https?:\/\//i,
 /\bBasic\b|\bBearer\b|client[_ -]secret|code_verifier|\bPKCE\b|Authorization:/i,
 /grant_type|code_verifier|request (?:body|parameters)|\|\s*`?code`?\s*\|/i,
 /\bapplication\/[a-z0-9.+-]+/i,
 /["'](?:access_token|refresh_token|token_type|expires_in)["']\s*:|\|\s*`?(?:access_token|refresh_token|token_type|expires_in)`?\s*\|/i,
] as const;
export const evidenceCost=(e:ResearchExcerpt)=>e.quote.length+e.contextBefore.length+e.contextAfter.length+e.sectionHeading.length;
function features(e:ResearchExcerpt){return signals.flatMap((p,i)=>p.test(e.quote)?[i]:[]);}
export interface EvidenceBundleReport {sourceUrl:string;sectionHeading:string;memberIds:string[];selectedIds:string[];featureCount:number;complete:boolean}
export function selectGenerationEvidence(candidates:ResearchExcerpt[],limits:{maxChars:number;maxExcerpts:number}){
 if(!Number.isSafeInteger(limits.maxChars)||limits.maxChars<0||!Number.isSafeInteger(limits.maxExcerpts)||limits.maxExcerpts<0)throw new Error('Invalid evidence selection limits');
 const usable=candidates.filter(e=>!e.clipped);
 const groups:ResearchExcerpt[][]=[];
 // Group within a single source and named section, in document order. Large
 // intervening gaps start a new group; repeated headings are not global joins.
 const bySection=new Map<string,ResearchExcerpt[]>();
 for(const e of usable){const key=JSON.stringify([e.sourceUrl,e.sectionHeading]);const list=bySection.get(key)??[];list.push(e);bySection.set(key,list);}
 for(const list of bySection.values()){
  const sorted=[...list].sort((a,b)=>a.startOffset-b.startOffset);let group:ResearchExcerpt[]=[];
  for(const e of sorted){if(group.length&&e.startOffset-group.at(-1)!.endOffset>2400){groups.push(group);group=[];}group.push(e);}if(group.length)groups.push(group);
 }
 const bundles=groups.flatMap(group=>{
  if(!group[0].sectionHeading||!group.some(e=>/oauth|authoriz|token|client_secret|code_verifier/i.test(e.quote+' '+e.sectionHeading)))return [];
  const available=new Set(group.flatMap(features));
  // A request anchor plus actual configuration material; no assumptions about
  // which authentication method, fields or response types a provider must use.
  if(!available.has(0)||(!available.has(1)&&!available.has(2)))return [];
  const members:ResearchExcerpt[]=[];const covered=new Set<number>();
  while(covered.size<available.size){
   const next=group.filter(e=>!members.includes(e)).map(e=>({e,gain:features(e).filter(f=>!covered.has(f)).length}))
    .filter(x=>x.gain>0).sort((a,b)=>b.gain-a.gain||evidenceCost(a.e)-evidenceCost(b.e)||a.e.startOffset-b.e.startOffset)[0];
   if(!next)break;members.push(next.e);features(next.e).forEach(f=>covered.add(f));
  }
  const heading=group[0].sectionHeading;
  const stagePriority=/exchang|getting.{0,25}tokens|initial.{0,40}tokens?/i.test(heading)?0:/refresh|renew/i.test(heading)?2:/using.{0,20}tokens|resource|api request/i.test(heading)?3:/authoriz|consent/i.test(heading)?1:0;
  return [{members,stagePriority,featureCount:available.size,cost:members.reduce((n,e)=>n+evidenceCost(e),0)}];
 }).sort((a,b)=>a.stagePriority-b.stagePriority||b.featureCount-a.featureCount||a.cost-b.cost||a.members[0].startOffset-b.members[0].startOffset);
 const excerpts:ResearchExcerpt[]=[];const seen=new Set<string>();let usedChars=0;
 const add=(e:ResearchExcerpt)=>{if(seen.has(e.id))return;excerpts.push(e);seen.add(e.id);usedChars+=evidenceCost(e);};
 for(const bundle of bundles){
  const fresh=bundle.members.filter(e=>!seen.has(e.id));
  if(excerpts.length+fresh.length<=limits.maxExcerpts&&usedChars+fresh.reduce((n,e)=>n+evidenceCost(e),0)<=limits.maxChars)fresh.forEach(add);
 }
 // Preserve broad lifecycle selection for the remaining space, including pages
 // without a detected request bundle. Never crop a block to make it fit.
 for(const e of prioritizeEvidence(usable))if(!seen.has(e.id)&&excerpts.length<limits.maxExcerpts&&usedChars+evidenceCost(e)<=limits.maxChars)add(e);
 const bundleReports:EvidenceBundleReport[]=bundles.map(b=>({sourceUrl:b.members[0].sourceUrl,sectionHeading:b.members[0].sectionHeading,memberIds:b.members.map(e=>e.id),selectedIds:b.members.filter(e=>seen.has(e.id)).map(e=>e.id),featureCount:b.featureCount,complete:b.members.every(e=>seen.has(e.id))}));
 return {excerpts,usedChars,bundleReports};
}
