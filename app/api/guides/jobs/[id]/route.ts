import {accessDenied} from '@/lib/access/generation-access';
import {jobApi} from '@/lib/jobs/api-runtime';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return accessDenied(request)??jobApi.get((await params).id);}
