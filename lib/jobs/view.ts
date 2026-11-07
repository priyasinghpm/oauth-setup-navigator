import type {GenerationJob,JobView} from './types';
import {STAGE_TITLES} from './types';
export function jobView(job:GenerationJob):JobView{
 return {id:job.id,status:job.status,stageIndex:job.stageIndex,createdAt:job.createdAt,updatedAt:job.updatedAt,attempts:job.attempts,provider:job.input.provider??job.input.website??'Provider',researchDate:job.sections[0]?.input.researchedAt??job.research?.pages.map(p=>p.retrievedAt.slice(0,10)).sort().at(-1),sourceCount:job.research?.pages.length??0,sections:job.sections.map(s=>({key:s.key,title:STAGE_TITLES[s.key],completedAt:s.completedAt,content:s.content,sources:s.input.sources.map(({id,title,url,inspectedAt})=>({id,title,url,inspectedAt}))})),error:job.error?{code:job.error.code,stage:job.error.stage,requestId:job.error.requestId}:undefined,saved:job.saved,reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};
}
