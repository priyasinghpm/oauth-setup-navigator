import {createHash} from 'node:crypto';
import {LIFECYCLE} from '../oauth-lifecycle';
import {GENERATION_LIMITS,type ModelRequest,type PreparedInput} from './types';
// Offline size estimator only. No SDK, tokenizer API, credentials or request text logs.
export function requestMetrics(request:ModelRequest,input:PreparedInput){
 const schema=JSON.stringify(request.jsonSchema);
 const body={contents:[{role:'user',parts:[{text:request.contents}]}],systemInstruction:{parts:[{text:request.systemInstruction}]},generationConfig:{responseMimeType:'application/json',responseJsonSchema:request.jsonSchema,maxOutputTokens:GENERATION_LIMITS.maxOutputTokens}};
 const excerpts=input.sources.flatMap(s=>s.excerpts);
 const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
 return {format:'generation-request-metrics-v1',sourceCount:input.sources.length,excerptCount:excerpts.length,
  evidenceManifestSha256:hash(JSON.stringify({registry:input.evidenceRegistry,excerpts})),
  systemInstructionBytes:Buffer.byteLength(request.systemInstruction),contentBytes:Buffer.byteLength(request.contents),schemaBytes:Buffer.byteLength(schema),estimatedRestBodyBytes:Buffer.byteLength(JSON.stringify(body)),
  roughInputTokens:Math.round((request.systemInstruction.length+request.contents.length+schema.length)/4),tokenMethod:'characters / 4; not a measured Gemini token count',
  quotationCharacters:excerpts.reduce((n,e)=>n+e.quote.length,0),originalContextCharacters:excerpts.reduce((n,e)=>n+e.contextBefore.length+e.contextAfter.length,0),
  topicSignals:LIFECYCLE.map(([stage,pattern])=>({stage,present:excerpts.some(e=>pattern.test(e.quote))})),
  instructionsSha256:hash(request.systemInstruction),schemaSha256:hash(schema),
 };
}
