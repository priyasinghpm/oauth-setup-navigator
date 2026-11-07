import {GuideValidationError,type ValidationCode} from './validation-errors';
import type { Claim, Evidence, OAuthGuide, OfficialSource, OfficialQuotation } from './types';
function fail(path: string, reason: string, code:ValidationCode): never { throw new GuideValidationError('guide-schema',code,`Invalid guide data at ${path}: ${reason}`,path); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function record(value: unknown, path: string) { if (!isRecord(value)) fail(path, 'expected an object','schema-object-required'); return value; }
function string(value: unknown, path: string): string { if (typeof value !== 'string' || !value.trim()) fail(path, 'expected nonempty text','schema-text-required'); return value; }
function list<T>(value: unknown, path: string, parse: (value: unknown, path: string) => T, nonempty = true): T[] {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) fail(path, 'expected a nonempty array','schema-nonempty-array-required');
  return value.map((item: unknown, i: number) => parse(item, `${path}[${i}]`));
}
function date(value: unknown, path: string) {
  const result = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) fail(path, 'expected a valid ISO date','schema-date-invalid');
  return result;
}
function positive(value: unknown, path: string): number { if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) fail(path, 'expected positive integer minutes','schema-positive-minutes-required'); return value; }
function quotation(value:unknown,path:string):OfficialQuotation {
  const v=record(value,path);
  const plain=(value:unknown,p:string)=>{if(typeof value!=='string')fail(p,'expected text','schema-text-type');return value;};
  const startOffset=v.startOffset,endOffset=v.endOffset;
  if(typeof startOffset!=='number' || typeof endOffset!=='number' || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset<0 || endOffset<=startOffset)fail(path,'invalid quotation offsets','schema-quotation-offsets');
  const quote=string(v.quote,`${path}.quote`);
  if(endOffset-startOffset!==quote.length || typeof v.clipped!=='boolean')fail(path,'invalid quotation metadata','schema-quotation-metadata');
  return {evidenceId:string(v.evidenceId,`${path}.evidenceId`),sourceId:string(v.sourceId,`${path}.sourceId`),sourceUrl:string(v.sourceUrl,`${path}.sourceUrl`),sourceTitle:string(v.sourceTitle,`${path}.sourceTitle`),quote,contextBefore:plain(v.contextBefore,`${path}.contextBefore`),contextAfter:plain(v.contextAfter,`${path}.contextAfter`),sectionHeading:plain(v.sectionHeading,`${path}.sectionHeading`),startOffset,endOffset,clipped:v.clipped};
}
function evidence(value: unknown, path: string): Evidence {
  const v = record(value,path);
  const status = v.status;
  if (status !== 'documented' && status !== 'estimated' && status !== 'unknown') fail(path, 'invalid evidence status','schema-evidence-status');
  const sourceIds = list(v.sourceIds, `${path}.sourceIds`, string, false);
  const qualification = v.qualification === undefined ? undefined : string(v.qualification, `${path}.qualification`);
  if (status === 'documented' && sourceIds.length === 0) fail(path, 'documented claims need sources','schema-documented-source-required');
  if (status !== 'documented' && !qualification) fail(path, 'estimates and unknowns need an explanation','schema-qualification-required');
  const quotations=v.quotations===undefined?undefined:list(v.quotations,`${path}.quotations`,quotation);
  if(quotations && (status!=='documented' || quotations.some(q=>!sourceIds.includes(q.sourceId))))fail(path,'quotations require documented, cited sources','schema-quotation-status');
  return {status,sourceIds,...(qualification ? {qualification} : {}),...(quotations?{quotations}:{})};
}
function claim(value: unknown, path: string): Claim { const v=record(value,path); return {text:string(v.text,`${path}.text`),evidence:evidence(v.evidence,`${path}.evidence`)}; }
const officialHosts = new Set(['developers.google.com','docs.slack.dev','developers.notion.com']);
export interface GuideValidationOptions { allowedSourceUrls?: ReadonlySet<string> }
function source(value: unknown, path: string, options: GuideValidationOptions): OfficialSource {
  const v=record(value,path); const url=string(v.url,`${path}.url`);
  let parsed: URL; try { parsed = new URL(url); } catch { return fail(path,'invalid source URL','schema-source-url-invalid'); }
  if (parsed.protocol !== 'https:' || (!officialHosts.has(parsed.hostname) && !options.allowedSourceUrls?.has(url)) || parsed.username || parsed.password) fail(path,'source must be an official HTTPS documentation URL','schema-source-url-disallowed');
  const id=string(v.id,`${path}.id`); if (!/^[a-z0-9-]+$/.test(id)) fail(path,'source ID must be anchor-safe','schema-source-id-invalid');
  return {id,title:string(v.title,`${path}.title`),url,inspectedAt:date(v.inspectedAt,`${path}.inspectedAt`)};
}
function parseGuide(value: unknown, path: string, options: GuideValidationOptions): OAuthGuide {
  const v=record(value,path); const slug=string(v.slug,`${path}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(path,'invalid slug','schema-slug-invalid');
  if (v.verificationStatus !== 'source-backed' || v.oauthTestStatus !== 'not-tested') fail(path,'research must not imply end-to-end testing','schema-not-tested-required');
  const d=record(v.difficulty,`${path}.difficulty`); const level=d.level;
  if (level !== 'Easy' && level !== 'Moderate' && level !== 'Complex') fail(path,'invalid difficulty','schema-difficulty-invalid');
  const difficulty: OAuthGuide['difficulty']={level,explanation:string(d.explanation,`${path}.difficulty.explanation`),evidence:evidence(d.evidence,`${path}.difficulty.evidence`)};
  if (difficulty.evidence.status !== 'estimated') fail(path,'difficulty must be editorial','schema-difficulty-editorial');
  const t=record(v.setupEstimate,`${path}.setupEstimate`);
  const setupEstimate={minMinutes:positive(t.minMinutes,`${path}.setupEstimate.minMinutes`),maxMinutes:positive(t.maxMinutes,`${path}.setupEstimate.maxMinutes`),evidence:evidence(t.evidence,`${path}.setupEstimate.evidence`)};
  if (setupEstimate.maxMinutes < setupEstimate.minMinutes || setupEstimate.evidence.status !== 'estimated') fail(path,'invalid editorial time range','schema-effort-invalid');
  const r=record(v.responsibilities,`${path}.responsibilities`);
  return {
    slug,name:string(v.name,`${path}.name`),category:string(v.category,`${path}.category`),mark:string(v.mark,`${path}.mark`),summary:string(v.summary,`${path}.summary`),keywords:list(v.keywords,`${path}.keywords`,string),
    verificationStatus:v.verificationStatus,oauthTestStatus:v.oauthTestStatus,lastResearchedAt:date(v.lastResearchedAt,`${path}.lastResearchedAt`),difficulty,setupEstimate,
    approvalSummary:claim(v.approvalSummary,`${path}.approvalSummary`),approvalWaitingTime:claim(v.approvalWaitingTime,`${path}.approvalWaitingTime`),
    prerequisites:list(v.prerequisites,`${path}.prerequisites`,claim),
    steps:list(v.steps,`${path}.steps`,(value,p)=>{ const s=record(value,p); return {title:string(s.title,`${p}.title`),description:string(s.description,`${p}.description`),expectedOutcome:string(s.expectedOutcome,`${p}.expectedOutcome`),evidence:evidence(s.evidence,`${p}.evidence`)}; }),
    scopes:list(v.scopes,`${path}.scopes`,(value,p)=>{ const s=record(value,p); return {name:string(s.name,`${p}.name`),purpose:string(s.purpose,`${p}.purpose`),evidence:evidence(s.evidence,`${p}.evidence`)}; }),
    approval:list(v.approval,`${path}.approval`,claim),
    blockers:list(v.blockers,`${path}.blockers`,(value,p)=>{ const s=record(value,p); return {issue:string(s.issue,`${p}.issue`),action:string(s.action,`${p}.action`),evidence:evidence(s.evidence,`${p}.evidence`)}; }),
    responsibilities:{agent:list(r.agent,`${path}.responsibilities.agent`,claim),developer:list(r.developer,`${path}.responsibilities.developer`,claim)},sources:list(v.sources,`${path}.sources`,(value,p)=>source(value,p,options)),nextActions:list(v.nextActions,`${path}.nextActions`,claim)
  };
}
export function guideEvidence(guide: OAuthGuide): Evidence[] {
  return [guide.difficulty.evidence,guide.setupEstimate.evidence,guide.approvalSummary.evidence,guide.approvalWaitingTime.evidence,...[...guide.prerequisites,...guide.steps,...guide.scopes,...guide.approval,...guide.blockers,...guide.responsibilities.agent,...guide.responsibilities.developer,...guide.nextActions].map(item=>item.evidence)];
}
export function parseGuides(value: unknown, options: GuideValidationOptions = {}): OAuthGuide[] {
  const guides=list(value,'guides',(value,path)=>parseGuide(value,path,options));
  const slugs=new Set<string>();
  const allSourceIds=new Set<string>();
  for (const guide of guides) {
    if (slugs.has(guide.slug)) fail(guide.slug,'duplicate slug','schema-duplicate-slug'); slugs.add(guide.slug);
    const ids=new Set<string>();
    for (const source of guide.sources) {
      if (allSourceIds.has(source.id)) fail(guide.slug,'duplicate source ID','schema-duplicate-source'); ids.add(source.id); allSourceIds.add(source.id);
      if (source.inspectedAt > guide.lastResearchedAt) fail(guide.slug,'source inspection is later than guide research date','schema-source-date-order');
    }
    for (const item of guideEvidence(guide)) {
      for (const id of item.sourceIds) if (!ids.has(id)) fail(guide.slug,`unknown source reference ${id}`,'schema-unknown-source');
      for(const q of item.quotations??[]) {
        const source=guide.sources.find(s=>s.id===q.sourceId);
        if(!source || q.sourceUrl!==source.url || q.sourceTitle!==source.title)fail(guide.slug,'quotation source mapping mismatch','schema-quotation-mapping');
      }
    }
  }
  return guides;
}

// Partial generated sections reuse the exact same primitive evidence parsers.
// Absence is allowed here only; the section schema and final full parser enforce required fields.
export function parseGuideFragment(value:unknown):Partial<OAuthGuide>{
 const v=record(value,'section'),out:Partial<OAuthGuide>={};
 if(v.summary!==undefined)out.summary=string(v.summary,'section.summary');
 if(v.difficulty!==undefined){
  const d=record(v.difficulty,'section.difficulty'),level=d.level;
  if(level!=='Easy'&&level!=='Moderate'&&level!=='Complex')fail('section.difficulty','invalid difficulty','schema-difficulty-invalid');
  out.difficulty={level,explanation:string(d.explanation,'section.difficulty.explanation'),evidence:evidence(d.evidence,'section.difficulty.evidence')};
  if(out.difficulty.evidence.status!=='estimated')fail('section.difficulty','difficulty must be editorial','schema-difficulty-editorial');
 }
 if(v.setupEstimate!==undefined){const t=record(v.setupEstimate,'section.setupEstimate');out.setupEstimate={minMinutes:positive(t.minMinutes,'section.setupEstimate.minMinutes'),maxMinutes:positive(t.maxMinutes,'section.setupEstimate.maxMinutes'),evidence:evidence(t.evidence,'section.setupEstimate.evidence')};if(out.setupEstimate.maxMinutes<out.setupEstimate.minMinutes||out.setupEstimate.evidence.status!=='estimated')fail('section.setupEstimate','invalid editorial time range','schema-effort-invalid');}
 if(v.prerequisites!==undefined)out.prerequisites=list(v.prerequisites,'section.prerequisites',claim);
 if(v.steps!==undefined)out.steps=list(v.steps,'section.steps',(value,p)=>{const s=record(value,p);return {title:string(s.title,p+'.title'),description:string(s.description,p+'.description'),expectedOutcome:string(s.expectedOutcome,p+'.expectedOutcome'),evidence:evidence(s.evidence,p+'.evidence')};});
 if(v.scopes!==undefined)out.scopes=list(v.scopes,'section.scopes',(value,p)=>{const s=record(value,p);return {name:string(s.name,p+'.name'),purpose:string(s.purpose,p+'.purpose'),evidence:evidence(s.evidence,p+'.evidence')};});
 if(v.approvalSummary!==undefined)out.approvalSummary=claim(v.approvalSummary,'section.approvalSummary');
 if(v.approvalWaitingTime!==undefined)out.approvalWaitingTime=claim(v.approvalWaitingTime,'section.approvalWaitingTime');
 if(v.approval!==undefined)out.approval=list(v.approval,'section.approval',claim);
 if(v.blockers!==undefined)out.blockers=list(v.blockers,'section.blockers',(value,p)=>{const b=record(value,p);return {issue:string(b.issue,p+'.issue'),action:string(b.action,p+'.action'),evidence:evidence(b.evidence,p+'.evidence')};});
 if(v.responsibilities!==undefined){const r=record(v.responsibilities,'section.responsibilities');out.responsibilities={agent:list(r.agent,'section.responsibilities.agent',claim),developer:list(r.developer,'section.responsibilities.developer',claim)};}
 if(v.nextActions!==undefined)out.nextActions=list(v.nextActions,'section.nextActions',claim);
 return out;
}
