import {EXCERPT_LIMITS} from '../research/evidence';
import {GuideValidationError,type ValidationCode} from '../validation-errors';
import { researchSourceId } from '../research/evidence';
import type { Evidence } from '../types';
import type { ClaimSupport, InputSource, PreparedInput } from './types';
import type { ResearchExcerpt } from '../research/types';
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object' && v!==null && !Array.isArray(v);}
function fail(code:ValidationCode,message:string,path?:string,id?:string):never{throw new GuideValidationError('evidence-resolution',code,message,path,id);}
// There is deliberately no fallback from an unknown model ID to a guessed source.
export function resolveModelEvidence(value:unknown,input:PreparedInput):{guideValue:unknown;support:ClaimSupport[]} {
  if(!record(value) || !record(value.guide) || Object.keys(value).some(k=>k!=='guide'))fail('evidence-draft-shape','Expected an evidence-ID-only guide draft');
  if(!input.sources.length)fail('evidence-registry-empty','Research source registry is empty');
  const sources=new Map<string,InputSource>();
  const evidence=new Map<string,{source:InputSource;excerpt:ResearchExcerpt}>();
  for(const source of input.sources) {
    if(source.id!==researchSourceId(source.url) || sources.has(source.id))fail('evidence-source-id-mismatch','Inconsistent or duplicate research source ID');
    sources.set(source.id,source);
    for(const excerpt of source.excerpts) {
      if(excerpt.sourceId!==source.id || excerpt.sourceUrl!==source.url || excerpt.sourceTitle!==source.title)fail('evidence-source-mapping','Evidence/source registry mapping mismatch','sources',excerpt.id);
      if(evidence.has(excerpt.id))fail('evidence-id-duplicate','Duplicate research evidence ID','sources',excerpt.id);
      if(excerpt.quote.trim().length<20 || excerpt.quote.length>EXCERPT_LIMITS.maxLength || (source.originalText??source.text).slice(excerpt.startOffset,excerpt.endOffset)!==excerpt.quote || (source.originalText??source.text).slice(excerpt.startOffset-excerpt.contextBefore.length,excerpt.startOffset)!==excerpt.contextBefore || (source.originalText??source.text).slice(excerpt.endOffset,excerpt.endOffset+excerpt.contextAfter.length)!==excerpt.contextAfter)fail('evidence-exact-text-mismatch','Stored quotation/context does not match retained source text','sources',excerpt.id);
      evidence.set(excerpt.id,{source,excerpt});
    }
  }
  // Resolve the supplied compact selections through the retained registry, not
  // positional guesses, hash repair, or a model-authored mapping.
  const selections=new Map<string,{source:InputSource;excerpt:ResearchExcerpt}>();
  const registered=new Set<string>();
  if(!Array.isArray(input.evidenceRegistry)||input.evidenceRegistry.length!==evidence.size)fail('evidence-reference-registry','Evidence reference registry is incomplete','evidenceRegistry');
  for(const ref of input.evidenceRegistry){
    const found=evidence.get(ref.evidenceId);
    if(!/^e[1-9][0-9]{0,2}$/.test(ref.id)||selections.has(ref.id)||registered.has(ref.evidenceId)||!found||found.source.id!==ref.sourceId)fail('evidence-reference-registry','Evidence reference registry mapping mismatch','evidenceRegistry');
    selections.set(ref.id,found);registered.add(ref.evidenceId);
  }
  const support:ClaimSupport[]=[];
  function resolveClaim(v:unknown,path:string):Evidence {
    if(!record(v) || !Array.isArray(v.evidenceIds) || v.evidenceIds.some(id=>typeof id!=='string') || Object.keys(v).some(k=>!['status','evidenceIds','qualification'].includes(k)))fail('evidence-selection-shape',`Malformed evidence-ID selection at ${path}`,path);
    if(v.status!=='documented' && v.status!=='estimated' && v.status!=='unknown')fail('evidence-status-invalid',`Invalid evidence status at ${path}`,path);
    if(typeof v.qualification!=='string' || !v.qualification.trim())fail('evidence-qualification-required',`Missing evidence qualification at ${path}`,path);
    if(v.evidenceIds.length>12 || new Set(v.evidenceIds).size!==v.evidenceIds.length)fail('evidence-selection-limit',`Duplicate or excessive evidence IDs at ${path}`,path);
    if(v.status==='unknown' && v.evidenceIds.length)fail('evidence-unknown-has-citations',`Unknown claim must not attach unsupported evidence at ${path}`,path);
    const sourceIds:string[]=[];
    for(const id of v.evidenceIds) {
      const found=selections.get(id);
      if(!found)fail('evidence-id-unknown',`Unknown or unsent evidence ID at ${path}: ${id}`,path,id);
      const {source,excerpt}=found;
      if(!sources.has(excerpt.sourceId!))fail('evidence-source-missing','Evidence source record is missing');
      if(!sourceIds.includes(source.id))sourceIds.push(source.id);
      if(v.status==='documented')support.push({path,sourceId:source.id,evidenceId:excerpt.id,sourceUrl:source.url,sourceTitle:source.title,quote:excerpt.quote,contextBefore:excerpt.contextBefore,contextAfter:excerpt.contextAfter,sectionHeading:excerpt.sectionHeading,startOffset:excerpt.startOffset,endOffset:excerpt.endOffset,clipped:excerpt.clipped});
    }
    if(support.length>40)fail('evidence-support-limit','Too many support excerpts');
    return {status:v.status,qualification:v.qualification,sourceIds};
  }
  function hydrate(node:unknown,path:string):unknown {
    if(Array.isArray(node))return node.map((child,i)=>hydrate(child,path?`${path}.${i}`:String(i)));
    if(!record(node))return node;
    const out:Record<string,unknown>={};
    for(const [key,child] of Object.entries(node)) {
      if(/^(sources?|sourceIds?|quote|quotations?|excerpts?|contextBefore|contextAfter|sectionHeading)$/i.test(key))fail('evidence-model-metadata',`Model-authored source/quotation metadata is not permitted at ${path||'guide'}`,path);
      out[key]=key==='evidence'?resolveClaim(child,path):hydrate(child,path?`${path}.${key}`:key);
    }
    return out;
  }
  const draft=hydrate(value.guide,'');
  if(!record(draft))fail('evidence-guide-shape','Invalid guide draft');
  const sourceRecords=input.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt}));
  return {guideValue:{...draft,sources:sourceRecords},support};
}
