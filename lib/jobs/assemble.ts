import type {GenerationResult,PreparedInput} from '../generation/types';
import type {SectionCheckpoint} from './types';
import {SECTION_KEYS} from './types';
import {record} from './guards';
import {validateGeneratedGuide} from '../generation/validate';
export function assembleSections(sections:SectionCheckpoint[]):Extract<GenerationResult,{ok:true}>{
 if(sections.length!==4||sections.some((s,i)=>s.key!==SECTION_KEYS[i]))throw Error('incomplete-sections');
 const first=sections[0].input;
 const sources:PreparedInput['sources']=[],registry:PreparedInput['evidenceRegistry'][number][]=[];
 for(const section of sections){
  if(section.input.provider!==first.provider||section.input.slug!==first.slug)throw Error('inconsistent-section-provider');
  for(const source of section.input.sources){let target=sources.find(s=>s.id===source.id);if(!target){target={...source,excerpts:[]};sources.push(target);}else if(target.url!==source.url||target.inspectedAt!==source.inspectedAt||target.originalText!==source.originalText)throw Error('inconsistent-section-source');
   for(const e of source.excerpts)if(!target.excerpts.some(x=>x.id===e.id))target.excerpts.push(e);
  }
  for(const ref of section.input.evidenceRegistry){const prior=registry.find(r=>r.id===ref.id||r.evidenceId===ref.evidenceId);if(prior){if(prior.id!==ref.id||prior.evidenceId!==ref.evidenceId||prior.sourceId!==ref.sourceId)throw Error('inconsistent-section-registry');}else registry.push(ref);}
 }
 const input:PreparedInput={...first,sources,evidenceRegistry:registry,researchedAt:sources.map(s=>s.inspectedAt).sort().at(-1)!,warnings:[...new Set(sections.flatMap(s=>s.input.warnings))]};
 const parts=sections.map(s=>{if(!record(s.draft)||!record(s.draft.section))throw Error('invalid-section-draft');return s.draft.section;});
 const raw={guide:{slug:first.slug,name:first.provider,category:'OAuth provider',mark:first.provider.slice(0,1).toUpperCase(),keywords:['oauth',first.provider],verificationStatus:'source-backed',oauthTestStatus:'not-tested',lastResearchedAt:input.researchedAt,...parts[0],...parts[3],steps:parts.flatMap(p=>Array.isArray(p.steps)?p.steps:[]),nextActions:parts.flatMap(p=>Array.isArray(p.nextActions)?p.nextActions:[])}};
 const {guide,support}=validateGeneratedGuide(raw,input);
 return {ok:true,guide,support,sources:sources.map(({text:_,originalText:__,excerpts:___,...s})=>s),warnings:[...input.warnings,'Assembled from independently validated AI-generated sections. Not human reviewed; no OAuth flow was tested.'],model:sections[0].model,realRequestCount:0,jsonValid:true,schemaValid:true};
}
