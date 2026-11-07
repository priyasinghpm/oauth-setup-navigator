import 'server-only';
import {join} from 'node:path';
import {createJobStore} from './store';
export function jobStore(){if(process.env.VERCEL||process.env.AWS_LAMBDA_FUNCTION_NAME)throw Error('persistent-disk-required');return createJobStore(process.env.GUIDE_JOB_DIR||join(process.cwd(),'.local','generation-jobs'));}
