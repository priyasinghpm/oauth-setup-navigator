// Offline only. Audits retained research or an audit corpus; no retrieval or SDK.
import {readFileSync} from 'node:fs';
import {checkedEvidence,extractEvidence} from '../lib/research/evidence';
import {prioritizeEvidence} from '../lib/research/evidence-selection';
import {selectGenerationEvidence,evidenceCost} from '../lib/generation/select-evidence';
import {GENERATION_LIMITS} from '../lib/generation/types';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {requestMetrics} from '../lib/generation/request-metrics';
import type {ResearchExcerpt,ResearchResult} from '../lib/research/types';
const [mode,path,provider]=process.argv.slice(2);
if(!path||!['research','audit-corpus'].includes(mode))throw Error('Usage: check-cached-evidence-bundles.ts research <snapshot> <provider> | audit-corpus <snapshot>');
const stored=JSON.parse(readFileSync(path,'utf8'));
const maxChars=GENERATION_LIMITS.maxEvidenceChars/GENERATION_LIMITS.maxSources,maxExcerpts=GENERATION_LIMITS.maxExcerptsPerSource;
function before(candidates:ResearchExcerpt[]){let chars=0;const selected:ResearchExcerpt[]=[];for(const e of prioritizeEvidence(candidates)){const cost=evidenceCost(e);if(!e.clipped&&selected.length<maxExcerpts&&chars+cost<=maxChars){selected.push(e);chars+=cost;}}return selected;}
const input=mode==='research'?{provider,slug:provider.toLowerCase().replace(/[^a-z0-9]+/g,'-'),research:stored as ResearchResult}:undefined;
const prepared=input?prepareGeneration(input):undefined;
const pages=prepared?prepared.sources.map(s=>stored.pages.find((p:{url:string})=>p.url===s.url)):stored.sources;
const reports=pages.map((p:{text:string;url:string;title:string;truncated:boolean;excerpts?:ResearchExcerpt[]})=>{
 const candidates=mode==='research'?checkedEvidence(p.text,p.url,p.title,p.excerpts,p.truncated):extractEvidence(p.text,p.url,p.title,p.truncated);
 const result=selectGenerationEvidence(candidates,{maxChars,maxExcerpts}),old=before(candidates);
 return {url:p.url,candidateCount:candidates.length,oldSelected:old.length,newSelected:result.excerpts.length,usedChars:result.usedChars,structuralBundles:result.bundleReports.map(b=>({sectionHeading:b.sectionHeading,featureCount:b.featureCount,memberCount:b.memberIds.length,oldMembersSelected:b.memberIds.filter(id=>old.some(e=>e.id===id)).length,newMembersSelected:b.selectedIds.length,allDetectedMembersSelected:b.complete}))};
});
console.log(JSON.stringify({mode,provenanceNote:prepared?'Original research provenance checked by prepareGeneration.':'Audit corpus only: extraction and selection tested; no new retrieval or ownership claim.',limits:{maxChars,maxExcerpts},reports,metrics:prepared?requestMetrics(buildGenerationRequest(prepared),prepared):undefined,requests:0},null,2));
