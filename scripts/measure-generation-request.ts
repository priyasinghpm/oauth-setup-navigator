// Offline reconstruction. Never imports the Gemini adapter or loads environment files.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareGeneration} from '../lib/generation/prepare';
import {buildGenerationRequest} from '../lib/generation/prompt';
import {requestMetrics} from '../lib/generation/request-metrics';
import type {ResearchResult} from '../lib/research/types';
try{
 const args=process.argv.slice(2),input=args[args.indexOf('--input')+1],provider=args[args.indexOf('--provider')+1];
 if(!args.includes('--input')||!args.includes('--provider')||!provider)throw Error();
 const raw=readFileSync(input);if(raw.length>2000000)throw Error();
 const research:ResearchResult=JSON.parse(raw.toString('utf8'));
 const slug=provider.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const prepared=prepareGeneration({provider,slug,research});
 const result={inputSha256:createHash('sha256').update(raw).digest('hex'),...requestMetrics(buildGenerationRequest(prepared),prepared)};
 if(args.includes('--output'))writeFileSync(args[args.indexOf('--output')+1],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}catch{console.error('Offline measurement failed. Supply --input <saved research JSON> --provider <name>. No raw content or exception is displayed.');process.exitCode=1;}
