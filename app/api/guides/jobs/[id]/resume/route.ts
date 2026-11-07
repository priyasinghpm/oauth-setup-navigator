import {accessDenied} from '@/lib/access/generation-access';
import {jobApi} from '@/lib/jobs/api-runtime';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return accessDenied(request)??jobApi.resume(request,(await params).id);}
