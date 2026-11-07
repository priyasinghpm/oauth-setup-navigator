import {jobApi} from '@/lib/jobs/api-runtime';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return jobApi.get((await params).id);}
