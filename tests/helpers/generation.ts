// Synthetic research and evidence-only model output. No network or credentials.
import type {GenerationInput,PreparedInput} from '../../lib/generation/types';
import type {EvidenceStatus} from '../../lib/types';
export const doc='Create an app in the developer dashboard. Register the redirect URI and choose read scope. Use authorization code exchange on your backend.';
export function input():GenerationInput {
  return {provider:'Example',slug:'example',research:{status:'partial',website:'https://docs.example.com',domainEstablishedBy:'user-website',message:'Retrieved',pages:[{url:'https://docs.example.com/oauth',requestedUrl:'https://docs.example.com/oauth',title:'Example OAuth',text:doc,topics:['app-creation','redirect-uris','authorization','scopes'],discoveredFrom:'https://docs.example.com',retrievedAt:'2026-11-03T00:00:00Z',truncated:false,trust:'untrusted-source-text',indexing:'unspecified'}],requests:[{url:'https://docs.example.com/oauth',kind:'page',status:200}],failures:[],missingTopics:['review','troubleshooting'],requestCount:1,limits:{maxRequests:24,maxPages:8,maxBytes:3000000,maxTextChars:24000,timeoutMs:6000,totalTimeoutMs:60000,maxRedirects:3},limitations:[]}};
}
export function fixture(p:PreparedInput) {
  const documented=()=>({status:'documented' as EvidenceStatus,evidenceIds:[p.evidenceRegistry[0].id],qualification:'From retrieved documentation.'});
  const estimated=()=>({status:'estimated' as EvidenceStatus,evidenceIds:[] as string[],qualification:'Unmeasured editorial estimate assuming existing accounts; excludes callback implementation, OAuth testing, and external review.'});
  const unknown=()=>({status:'unknown' as EvidenceStatus,evidenceIds:[] as string[],qualification:'Not established from retrieved documentation.'});
  return {guide:{slug:p.slug,name:p.provider,category:'Developer tools',mark:'E',summary:'OAuth setup guidance.',keywords:['oauth'],verificationStatus:'source-backed',oauthTestStatus:'not-tested',lastResearchedAt:p.researchedAt,
    difficulty:{level:'Moderate',explanation:'Multiple configuration decisions.',evidence:estimated()},setupEstimate:{minMinutes:20,maxMinutes:40,evidence:estimated()},
    approvalSummary:{text:'Review requirements are unknown.',evidence:unknown()},approvalWaitingTime:{text:'Waiting time is unknown.',evidence:unknown()},
    prerequisites:[{text:'Access to the developer dashboard.',evidence:documented()}],steps:['Create app','Register callback','Select scope','Exchange code'].map(title=>({title,description:doc,expectedOutcome:'Configuration ready for an independent test.',evidence:documented()})),scopes:[{name:'read',purpose:'Example read permission.',evidence:documented()}],approval:[{text:'Approval requirements and timing could not be established.',evidence:unknown()}],blockers:[{issue:'Recovery information unavailable',action:'Unknown; confirm with provider.',evidence:unknown()}],responsibilities:{agent:[{text:'Draft a checklist.',evidence:estimated()}],developer:[{text:'Own credentials and test the flow.',evidence:estimated()}]},nextActions:[{text:'Review before implementation.',evidence:estimated()}]}};
}
