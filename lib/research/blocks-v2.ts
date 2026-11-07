import {createHash} from 'node:crypto';
import {relevance} from './extract';
import {researchSourceId} from './evidence-id';
import type {ResearchExcerpt} from './types';
export {researchSourceId} from './evidence-id';
export const EXCERPT_LIMITS={maxLength:1600,contextChars:360,maxPerPage:80} as const;
// Whole, contiguous extracted-text blocks only. Oversized/unclosed blocks are
// omitted rather than cropped or repaired. Existing page/request budgets apply.
export function extractBlockEvidenceV2(text:string,sourceUrl:string,sourceTitle:string,truncated=false):ResearchExcerpt[]{
 const lines=[...text.matchAll(/[^\n]*(?:\n|$)/g)].filter(m=>m[0].length);
 const result:ResearchExcerpt[]=[];let heading='';
 function add(start:number,end:number,kind:'paragraph'|'code',split=true){
  while(end>start&&/\s/.test(text[end-1]))end--;
  const quote=text.slice(start,end);
  if(quote.length>EXCERPT_LIMITS.maxLength&&kind==='paragraph'&&split){
   if(/^(?:\s*\||\s*[\[{]|\s*[-*]\s|\s*\d+\.\s|\s*(?:curl|hs|npm)\s)/m.test(quote))return;
   let begin=0;
   for(const m of quote.matchAll(/[\s\S]*?[.!?](?=\s|$)/g)){
    const end=m.index!+m[0].length;
    if((quote.slice(begin,end).match(/`/g)?.length??0)%2===0){add(start+begin,start+end,'paragraph',false);begin=end;}
   }
   return;
  }
  if(quote.trim().length<20||quote.length>EXCERPT_LIMITS.maxLength||(truncated&&end===text.trimEnd().length))return;
  const contextBefore=text.slice(Math.max(0,start-360),start),contextAfter=text.slice(end,end+360);
  const id='evidence-'+createHash('sha256').update(JSON.stringify(['blocks-v2',sourceUrl,start,end,quote,contextBefore,contextAfter,heading])).digest('hex').slice(0,24);
  result.push({id,sourceId:researchSourceId(sourceUrl),sourceUrl,sourceTitle,quote,contextBefore,contextAfter,sectionHeading:heading,startOffset:start,endOffset:end,clipped:false,extractionVersion:'blocks-v2',kind});
 }
 for(let i=0;i<lines.length;){
  const line=lines[i][0],start=lines[i].index!;
  if(!line.trim()){i++;continue;}
  if(/^#{1,6}\s/.test(line)){heading=line.trimEnd().slice(0,240);i++;continue;}
  const fence=line.match(/^\s*(`{3,}|~{3,})/);
  if(fence){let j=i+1;const close=new RegExp('^\\s*'+fence[1][0]+'{'+fence[1].length+',}\\s*$');while(j<lines.length&&!close.test(lines[j][0].trimEnd()))j++;
   if(j<lines.length)add(start,lines[j].index!+lines[j][0].length,'code');i=j+1;continue;
  }
  let j=i+1;
  while(j<lines.length&&lines[j][0].trim()&&!/^\s*(?:#{1,6}\s|`{3,}|~{3,})/.test(lines[j][0]))j++;
  add(start,lines[j-1].index!+lines[j-1][0].length,'paragraph');i=j;
 }
 return result.sort((a,b)=>relevance(b.quote)-relevance(a.quote)||a.startOffset-b.startOffset).slice(0,80);
}
