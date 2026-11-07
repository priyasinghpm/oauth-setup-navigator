// Read-only validation of historical saved excerpts; never silently reassign their IDs.
import { createHash } from 'node:crypto';
import { relevance } from './extract';
import type { ResearchExcerpt } from './types';
import {researchSourceId} from './evidence-id';
export const LEGACY_LIMITS={maxLength:400,contextChars:360,maxPerPage:80} as const;
// All quotation/context strings are contiguous slices of the retained extracted
// text. No model, whitespace normalization, paraphrase, or ellipsis insertion.
export function extractLegacyEvidence(text:string, sourceUrl:string, sourceTitle:string):ResearchExcerpt[] {
  const excerpts:ResearchExcerpt[]=[];
  let heading='';
  for(const match of text.matchAll(/[^\n]+/g)) {
    const line=match[0];const lineStart=match.index!;
    if(/^#{1,6}\s/.test(line)){heading=line.slice(0,240);continue;}
    if(line.trim().length<20 || /^\s*```/.test(line))continue;
    let relative=0;
    while(relative<line.length) {
      let end=Math.min(relative+LEGACY_LIMITS.maxLength,line.length);
      if(end<line.length) {
        const space=line.lastIndexOf(' ',end);
        if(space>relative+LEGACY_LIMITS.maxLength/2)end=space;
      }
      const startOffset=lineStart+relative,endOffset=lineStart+end;
      const quote=text.slice(startOffset,endOffset);
      if(quote.trim().length>=20) {
        const contextBefore=text.slice(Math.max(0,startOffset-LEGACY_LIMITS.contextChars),startOffset);
        const contextAfter=text.slice(endOffset,endOffset+LEGACY_LIMITS.contextChars);
        const id='evidence-'+createHash('sha256').update(JSON.stringify([sourceUrl,startOffset,endOffset,quote,contextBefore,contextAfter,heading])).digest('hex').slice(0,24);
        excerpts.push({id,sourceId:researchSourceId(sourceUrl),sourceUrl,sourceTitle,quote,contextBefore,contextAfter,sectionHeading:heading,startOffset,endOffset,clipped:relative>0||end<line.length});
      }
      relative=end;
    }
  }
  return excerpts.sort((a,b)=>relevance(b.quote)-relevance(a.quote)||a.startOffset-b.startOffset).slice(0,LEGACY_LIMITS.maxPerPage);
}
