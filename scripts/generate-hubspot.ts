// Explicit live-test command; never invoked by npm test or application builds.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { generateOAuthGuide } from '../lib/generation';
import { prepareGeneration } from '../lib/generation/prepare';
import type { ResearchResult } from '../lib/research/types';
async function main() {
  const args=process.argv.slice(2);
  const value=(flag:string)=>args[args.indexOf(flag)+1];
  if(!args.includes('--live') || !args.includes('--free-tier-confirmed') || !args.includes('--input')) {
    console.log('No API request made. Usage: npm run generate:hubspot -- --live --free-tier-confirmed --input /tmp/hubspot-research.json [--output /tmp/hubspot-generation.json]');
    return;
  }
  const raw=readFileSync(value('--input'),'utf8');
  if(Buffer.byteLength(raw)>2_000_000)throw new Error('Research input is too large');
  const research:ResearchResult=JSON.parse(raw);
  const input={provider:'HubSpot',slug:'hubspot',research};
  const prepared=prepareGeneration(input); // Validate before reading credentials or sending a request.
  const apiKey=parseEnv(readFileSync('.env.local','utf8')).GEMINI_API_KEY;
  const result=await generateOAuthGuide(input,apiKey);
  if(args.includes('--output'))writeFileSync(value('--output'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.ok?{
    ok:result.ok,model:result.model,realRequestCount:result.realRequestCount,jsonValid:result.jsonValid,schemaValid:result.schemaValid,
    inputSourceCount:prepared.sources.length,retainedSourceTextCharacters:prepared.sources.reduce((n,s)=>n+s.text.length,0),
    inputExcerptCount:prepared.sources.reduce((n,s)=>n+s.excerpts.length,0),
    sources:result.sources,resolvedQuotationCount:result.support.length,steps:result.guide.steps.map(step=>({title:step.title,sourceIds:step.evidence.sourceIds,quotationIds:step.evidence.quotations?.map(q=>q.evidenceId)})),
    approvalSummary:result.guide.approvalSummary,approvalWaitingTime:result.guide.approvalWaitingTime,
    blockers:result.guide.blockers,oauthTestStatus:result.guide.oauthTestStatus,supportCount:result.support.length,warnings:result.warnings,
  }:result,null,2));
  if(!result.ok)process.exitCode=1;
}
main().catch(()=>{console.error('Live generation command failed before returning a result. No raw error or credentials are displayed.');process.exitCode=1;});
