import {queueWaiting} from './queue-status';
import {sameOrigin,inputOf,readBody} from '../api/generate-guide';
import type {JobStore} from './store';
import {JobBusyError,validJobId} from './store';
import {jobView} from './view';
export function createJobApi(deps:{store:()=>JobStore;enabled:()=>boolean;configured:()=>boolean}){
 const fail=(status:number,code:string)=>Response.json({ok:false,error:{code}},{status,headers:{'Cache-Control':'no-store'}});
 const success=async(job:Parameters<typeof jobView>[0],status=200)=>{const view=jobView(job);if(job.status==='queued')view.waiting=await queueWaiting(deps.store(),job.stageIndex>0&&job.stageIndex<5);return Response.json({ok:true,job:view},{status,headers:{'Cache-Control':'no-store'}});};
 function guard(request:Request){if(!sameOrigin(request))return fail(403,'cross-origin');if(!deps.enabled())return fail(503,'generation-disabled');if(!deps.configured())return fail(503,'generation-unavailable');if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return fail(415,'invalid-input');}
 return {
 async create(request:Request){const error=guard(request);if(error)return error;let input;
  try{input=inputOf(await readBody(request));if(input.provider&&/AIza[\w-]{20,}|Bearer\s|sk-[\w-]{20,}|client_secret\s*=/i.test(input.provider))throw Error();}catch{return fail(400,'invalid-input');}
  try{return success(await deps.store().create(input),201);}catch{return fail(503,'job-storage-unavailable');}
 },
 async get(id:string){if(!validJobId(id))return fail(404,'job-not-found');try{const job=await deps.store().get(id);return job?success(job):fail(404,'job-not-found');}catch{return fail(503,'job-storage-unavailable');}},
 async resume(request:Request,id:string){const error=guard(request);if(error)return error;if(!validJobId(id))return fail(404,'job-not-found');
  try{const body:unknown=await readBody(request);if(!body||typeof body!=='object'||Object.keys(body).length) return fail(400,'invalid-input');}catch{return fail(400,'invalid-input');}
  try{let conflict=false;const job=await deps.store().update(id,j=>{if(j.status!=='paused'&&j.status!=='failed'){conflict=true;return;}j.status='queued';delete j.error;});if(!job)return fail(404,'job-not-found');return conflict?fail(409,'job-busy'):success(job,202);}catch(e){return e instanceof JobBusyError?fail(409,'job-busy'):fail(503,'job-storage-unavailable');}
 }};
}
