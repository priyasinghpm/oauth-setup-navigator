import type {InputSource,PreparedInput} from './types';
// Presentation-only compression; backend evidence and exact context stay intact.
export function modelEvidence(source:InputSource,registry:PreparedInput['evidenceRegistry']){
 const original=source.originalText??source.text;
 const ranges=source.excerpts.map(e=>{
  const start=e.startOffset-e.contextBefore.length,end=e.endOffset+e.contextAfter.length;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>original.length||original.slice(e.startOffset,e.endOffset)!==e.quote||original.slice(start,e.startOffset)!==e.contextBefore||original.slice(e.endOffset,end)!==e.contextAfter)throw new Error('Prepared model evidence does not match original text');
  return {start,end};
 }).sort((a,b)=>a.start-b.start||a.end-b.end);
 const merged:{start:number;end:number}[]=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});}
 // Context is located by array position, never a citation-like identifier.
 // Only excerpts expose selectable IDs; backend evidence IDs remain unchanged.
 const windows=merged.map(range=>({startOffset:range.start,text:original.slice(range.start,range.end)}));
 const excerpts=source.excerpts.map(e=>{
  const ref=registry.find(r=>r.evidenceId===e.id&&r.sourceId===source.id);
  const i=merged.findIndex(r=>r.start<=e.startOffset-e.contextBefore.length&&r.end>=e.endOffset+e.contextAfter.length);
  if(!ref||i<0)throw new Error('Prepared model evidence reference is missing');
  return {id:ref.id,quote:e.quote,sectionHeading:e.sectionHeading,contextWindowIndex:i};
 });
 return {title:source.title,url:source.url,truncated:source.truncated,contextWindows:windows,excerpts};
}
