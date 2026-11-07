import {safeUrl,domainOf} from './network';
export interface DiscoveryLink {href:string;text:string;context:string;nofollow?:boolean}
export interface Delegation {from:string;to:string;label:string}
const setup=/oauth|authentication|authorization|callback|client[-_ ]?(?:id|secret)|refresh[-_ ]?token/i;
const docs=/developer|documentation|\bdocs?\b|api reference/i;
export function discoveryScore(url:URL,label=''):number{
 const value=url.hostname+' '+url.pathname+' '+label;
 const developerHost=/^(?:developers?|docs?|api)\./i.test(url.hostname);
 const documentation=developerHost||/^\/(?:docs?|guides?|reference|tutorials)(?:\/|$)/i.test(url.pathname)||/developer|documentation|\bapi\b/i.test(label);
 const oauth=/oauth|client[-_ ]?(?:id|secret)|refresh[-_ ]?token|callback/i.test(value);
 return ((oauth||(documentation&&setup.test(value)))?200:documentation?100:0)+(developerHost?20:0)+(/sitemap|llms\.txt/i.test(url.pathname)?45:0)-(!setup.test(value)&&/\/marketplace(?:\/|$)|\/collections?\//i.test(url.pathname)?55:0)-(/\/(?:blog|changelog|pricing|customers|features|newsroom)\//i.test(url.pathname)?60:0);
}
// External delegation is an exact linked URL, never a host or path-prefix grant.
// Require an explicitly labelled docs destination on a provider-named tenant.
export function documentationDelegation(from:URL,to:URL,link:DiscoveryLink,rootDomain:string,prior:readonly Delegation[]=[]):Delegation|null{
 if(link.nofollow||domainOf(to)===rootDomain)return null;
 const firstParty=domainOf(from)===rootDomain;
 const delegatedParent=prior.some(d=>d.to===from.href);
 if(!firstParty&&!(delegatedParent&&from.origin===to.origin))return null;
 const brand=rootDomain.split('.')[0];
 const tenant=to.hostname.split('.')[0];
 const destinationDomain=domainOf(to);
 if(to.hostname!==destinationDomain&&to.hostname!==`${brand}.${destinationDomain}`)return null;
 if(tenant!==brand||!/^\/(?:docs?|guides?|reference)(?:\/|$)/i.test(to.pathname)||(firstParty&&!(docs.test(link.text+' '+link.context)||(/^\/docs?\//.test(from.pathname)&&setup.test(link.text)))))return null;
 safeUrl(to.href);
 return {from:from.href,to:to.href,label:link.text.slice(0,200)};
}
export function allowedResearchUrl(value:string,rootDomain:string,delegations:readonly Delegation[]):URL{
 const url=safeUrl(value);
 if(domainOf(url)!==rootDomain&&!delegations.some(d=>d.to===url.href))throw new Error('URL outside verified documentation scope');
 return url;
}

// Candidate generation uses an established domain, never a provider-name guess.
export function developerPatternCandidates(officialDomain:string):string[]{
 const root=safeUrl(`https://${officialDomain}/`);
 if(root.hostname!==officialDomain||domainOf(root)!==officialDomain)throw new Error('An established provider domain is required');
 return [...new Set([
  ...['developers','developer','api'].map(prefix=>`https://${prefix}.${officialDomain}/`),
  `https://${officialDomain}/docs`,`https://${officialDomain}/developers`,
 ])].map(value=>allowedResearchUrl(value,officialDomain,[]).href);
}
export function promisingDocumentation(url:URL,label=''):boolean{
 return /^(?:developers?|docs?|api)\./i.test(url.hostname)||/^\/(?:docs?|developers?|guides?|reference|oauth|authentication)(?:\/|$)/i.test(url.pathname)||/developer documentation|oauth setup|api reference/i.test(label);
}
