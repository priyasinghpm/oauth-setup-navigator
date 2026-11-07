// Explicit long-running local worker. No work occurs unless generation is opted in.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {setTimeout} from 'node:timers/promises';
import {researchProvider} from '../lib/research';
import {configuredTransport} from '../lib/generation/model-runtime';
import {savedGuides} from '../lib/saved-guides';
import {jobStore} from '../lib/jobs/runtime';
import {recoverInterrupted,runOneJobStep,takeWorkerQuota} from '../lib/jobs/worker';
import {SECTION_LIMITS} from '../lib/jobs/sections';
async function main(){
 try{const local=parseEnv(readFileSync('.env.local','utf8'));for(const key of ['GEMINI_API_KEY','GUIDE_GENERATION_ENABLED','GUIDE_JOB_DIR','GUIDE_STORAGE_DIR','GUIDE_MODEL_PROVIDER','GUIDE_MODEL'])if(process.env[key]===undefined&&local[key]!==undefined)process.env[key]=local[key];}catch{}
 if(process.env.GUIDE_GENERATION_ENABLED!=='true'||!process.env.GEMINI_API_KEY){console.log('Worker disabled: explicitly enable GUIDE_GENERATION_ENABLED and configure the server key after confirming free-tier billing. No requests made.');return;}
 const store=jobStore();let stopping=false;process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
 await store.lock('worker',async()=>{
  await recoverInterrupted(store);console.log('Guide worker ready. Successful stages advance automatically; failures stop without automatic retries.');
  do{
   const worked=await runOneJobStep({store,guides:savedGuides,research:researchProvider,enabled:()=>!stopping,transport:requestId=>configuredTransport(process.env.GEMINI_API_KEY!,{requestId},SECTION_LIMITS.maxOutputTokens),takeQuota:()=>takeWorkerQuota(store)});
   if(process.argv.includes('--once'))break;
   await setTimeout(worked?250:2500);
  }while(!stopping);
 });
}
main().catch(()=>{console.error('Worker stopped safely. Check persistent disk and whether another worker is active. No automatic retries or raw errors logged.');process.exitCode=1;});
