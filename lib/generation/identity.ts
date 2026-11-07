import {domainOf,safeUrl} from '../research/network';
import {REVIEWED_PROVIDERS} from '../research/provider-registry';
import {GuideValidationError} from '../validation-errors';
import type {OAuthGuide} from '../types';
import type {InputSource,PreparedInput} from './types';
// Conservative formatting equivalence, not fuzzy matching or arbitrary aliases.
function normalized(value:string):string{return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');}
export function sameProviderName(actual:string,canonical:string):boolean{
 const name=normalized(actual),expected=normalized(canonical);
 return name===expected||(name.startsWith(expected)&&/^oauth(?:2(?:0)?)?(?:setup)?(?:guide|app|application|integration)?$/.test(name.slice(expected.length)));
}
function mismatch(field:string):never{throw new GuideValidationError('guide-rules','guide-provider-source-mismatch','Requested provider and retrieved documentation identity do not match',field);}
export function canonicalProviderName(requested:string,domain:string):string{
 const name=requested.trim();
 const known=REVIEWED_PROVIDERS.find(p=>normalized(p.name)===normalized(name)||(safeUrl(p.website).pathname==='/'&&domainOf(safeUrl(p.website))===name.toLowerCase()));
 const websiteOwner=REVIEWED_PROVIDERS.find(p=>safeUrl(p.website).pathname==='/'&&domainOf(safeUrl(p.website))===domain);
 if(known){if(domainOf(safeUrl(known.website))!==domain)mismatch('sources');return known.name;}
 // An explicitly supplied name must not override a different reviewed owner.
 if(websiteOwner&&!sameProviderName(name,websiteOwner.name))mismatch('name');
 return websiteOwner?.name??name;
}
export function assertProviderSources(provider:string,domain:string,sources:InputSource[],delegatedSourceUrls:readonly string[]=[]):void{
 if(!sources.length||sources.some(s=>domainOf(safeUrl(s.url))!==domain&&!delegatedSourceUrls.includes(s.url)))mismatch('sources');
 const known=REVIEWED_PROVIDERS.find(p=>p.name===provider);
 if(known){if(domainOf(safeUrl(known.website))!==domain)mismatch('sources');return;}
 // For unfamiliar providers require a domain/name match or an explicit name
 // mention in retained official text. The supplied website still asserts trust;
 // this is not independent certification of an arbitrary site's ownership.
 const domainName=domain.split('.')[0];
 const words=provider.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
 const pattern=words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s\\p{P}]*');
 const mentioned=!!pattern&&sources.some(s=>new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`,'iu').test(s.title+'\n'+s.text));
 if(normalized(provider)!==normalized(domain)&&normalized(provider)!==normalized(domainName)&&!mentioned)mismatch('sources');
}
export function assertGuideIdentity(guide:Pick<OAuthGuide,'slug'|'name'|'lastResearchedAt'|'summary'|'steps'>,input:PreparedInput):void{
 if(guide.slug!==input.slug||!sameProviderName(guide.name,input.provider)||guide.lastResearchedAt!==input.researchedAt)throw new GuideValidationError('guide-rules','guide-identity-mismatch','Generated identity or research date changed',guide.slug!==input.slug?'slug':!sameProviderName(guide.name,input.provider)?'name':'lastResearchedAt');
 assertProviderSources(input.provider,input.providerDomain,input.sources,input.delegatedSourceUrls);
 // Reject explicit foreign-provider setup actions even if the title was copied
 // correctly. This conservative guard is not a full semantic correctness proof.
 for(const other of REVIEWED_PROVIDERS){
  if(other.name===input.provider)continue;
  const brand=other.name.replace(/ /g,'\\s+');
  const foreignSummary=new RegExp(`^(?:${brand}\\s+(?:OAuth|app|integration)|(?:OAuth|setup|guide)\\s+(?:for|with)\\s+${brand}\\b)`,'i');
  if(foreignSummary.test(guide.summary.trimStart()))throw new GuideValidationError('guide-rules','guide-provider-content-mismatch','Generated summary targets a different provider','summary');
  const action=new RegExp(`\\b(?:create|register|configure|install|open|visit|log\\s+in\\s+to|sign\\s+in\\s+to)\\s+(?:(?:a|an|the|your)\\s+)?${brand}\\b|\\b(?:app|application|dashboard|console|workspace|integration)\\s+(?:in|on|for)\\s+${brand}\\b`,'i');
  for(let i=0;i<guide.steps.length;i++)if(action.test(guide.steps[i].title+'\n'+guide.steps[i].description))throw new GuideValidationError('guide-rules','guide-provider-content-mismatch','Generated setup instructions target a different provider',`steps.${i}`);
 }
}
