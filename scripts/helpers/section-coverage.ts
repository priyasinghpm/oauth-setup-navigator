import type {OAuthGuide} from '../../lib/types';
export const SECTION_TOPICS=['authorization-request','callback','token-request','client-authentication','request-encoding','token-response'] as const;
export type SectionTopic=typeof SECTION_TOPICS[number];
// Necessary lexical/literal checks, never a semantic correctness verdict.
const rules:Record<SectionTopic,(text:string)=>boolean>={
 'authorization-request':s=>/https:\/\/[^\s`]+(?:authorize|authorization)/i.test(s)&&/client_id/.test(s),
 callback:s=>/redirect_uri|callback/i.test(s)&&/register|match/i.test(s),
 'token-request':s=>/\bPOST\b/.test(s)&&/https:\/\/[^\s`]+token/.test(s)&&/authorization_code/.test(s)&&/grant_type/.test(s)&&/\bcode\b/.test(s)&&/redirect_uri/.test(s),
 'client-authentication':s=>/Basic/.test(s)&&/client_id/.test(s)&&/client_secret/.test(s),
 'request-encoding':s=>s.includes('application/x-www-form-urlencoded'),
 'token-response':s=>/access[_\s-]token/i.test(s)&&/refresh[_\s-]token/i.test(s),
};
export function sectionCoverage(steps:OAuthGuide['steps']){
 return SECTION_TOPICS.map(topic=>({topic,covered:steps.some(s=>{
  const instruction=s.description+'\n'+s.expectedOutcome;
  const direct=(s.evidence.quotations??[]).map(q=>q.quote).join('\n');
  return rules[topic](instruction)&&rules[topic](direct);
 })}));
}
export function validateSectionLiterals(instruction:string,direct:string){
 // Plain-text values also count: backticks must not be a way to bypass checks.
 const exact=[...instruction.matchAll(/\bapplication\/[a-z0-9.+-]+|\b(?:grant_type|client_id|client_secret|redirect_uri|access_token|refresh_token|authorization_code)\b/g)].map(m=>m[0].replace(/\.+$/,''));
 for(const literal of exact)if(!direct.includes(literal))throw new Error('section-direct-literal-missing');
}

function methodUrls(text:string){
 return [...text.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(https:\/\/[^\s`<>"')\]]+)/g)]
  .map(m=>({method:m[1],url:m[2].replace(/[.,;]+$/,'')}));
}
function isEndpointOfExample(endpoint:string,example:string){
 const a=new URL(endpoint),b=new URL(example);
 return !a.search&&!a.hash&&!!b.search&&a.origin===b.origin&&a.pathname===b.pathname;
}
export function validateSectionMethodUrls(instruction:string,quotes:readonly string[]){
 const supported=quotes.flatMap(methodUrls);
 for(const pair of methodUrls(instruction))if(!supported.some(p=>p.method===pair.method&&(p.url===pair.url||isEndpointOfExample(pair.url,p.url))))throw new Error('section-http-method-unsupported');
}
export function validateSectionInterpretation(instruction:string,direct:string){
 // A directly quoted documentation example is not the developer's configuration.
 const explanation=instruction.replace(/https:\/\/[^\s`<>"')\]]+/g,'');
 for(const match of instruction.matchAll(/https:\/\/[^\s`<>"')\]]+/g)){
  const url=new URL(match[0].replace(/[.,;]+$/,''));
  if(url.searchParams.has('client_id')&&url.searchParams.get('client_id')&&
   !(/\b(?:examples?|samples?|illustrative)\b/i.test(explanation)&&/\b(?:replace[ds]?|replacing|substitute[ds]?|substituting)\b/i.test(explanation)))throw new Error('section-example-values-unqualified');
 }
 const both=/access\s+and\s+refresh\s+tokens?/i;
 if(both.test(instruction)&&!(/access[_\s-]tokens?/i.test(direct)&&/refresh[_\s-]tokens?/i.test(direct)))throw new Error('section-token-outcome-unsupported');
}
