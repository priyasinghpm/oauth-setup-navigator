import 'server-only';
import {createJobApi} from './api';
import {jobStore} from './runtime';
export const jobApi=createJobApi({store:jobStore,enabled:()=>process.env.GUIDE_GENERATION_ENABLED==='true',configured:()=>Boolean(process.env.GEMINI_API_KEY?.trim())});
