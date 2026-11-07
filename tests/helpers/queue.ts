// Synthetic, offline-only documentation and model drafts. Never a live guide.
import {input,fixture} from './generation';
import {prepareGeneration} from '../../lib/generation/prepare';
import {generationProperties} from '../../lib/generation/schema';
import type {ModelRequest,PreparedInput} from '../../lib/generation/types';
export function queueInput(){const i=input();i.research.pages[0].text+=' Refresh tokens on your backend. Review marketplace distribution requirements.';return i;}
export function sectionReply(request:ModelRequest){
 const data=JSON.parse(request.contents),doc=data.untrustedDocuments[0],ref=doc.excerpts[0].id;
 const p=prepareGeneration(queueInput()),full=fixture(p).guide;
 function replace(v:unknown):void{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(replace);return;}const r=v as Record<string,unknown>;if(r.evidence&&typeof r.evidence==='object'&&'evidenceIds'in r.evidence&&Array.isArray(r.evidence.evidenceIds)&&r.evidence.evidenceIds.length)r.evidence.evidenceIds=[ref];Object.values(r).forEach(replace);}
 replace(full);
 const schema=request.jsonSchema as {properties:{section:{required:string[]}}};
 const section=Object.fromEntries(schema.properties.section.required.map(k=>[k,k==='steps'?full.steps.slice(0,1):k==='nextActions'?full.nextActions.slice(0,1):full[k as keyof typeof full]]));
 return {text:JSON.stringify({section}),finishReason:'STOP'};
}
