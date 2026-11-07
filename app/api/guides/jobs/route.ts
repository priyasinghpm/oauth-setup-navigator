import {accessDenied} from '@/lib/access/generation-access';
import {jobApi} from '@/lib/jobs/api-runtime';
export const runtime='nodejs';
export async function POST(request:Request){return accessDenied(request)??jobApi.create(request);}
