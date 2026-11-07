import {jobApi} from '@/lib/jobs/api-runtime';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return jobApi.resume(request,(await params).id);}
