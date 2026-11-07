import type {PreparedInput} from '../../lib/generation/types';
// Hints only, derived from direct quotations. Context never becomes support.
export function directLiterals(text:string):string[]{
 return [...new Set([
  ...text.matchAll(/https:\/\/[^\s`"'<>()[\]]+/g),
  ...text.matchAll(/\b\d+\s+(?:minutes?|hours?|days?|weeks?)\b/gi),
  ...text.matchAll(/\bapplication\/[a-z0-9.+-]+|\b(?:grant_type|client_id|client_secret|redirect_uri|access_token|refresh_token|authorization_code)\b/g),
 ].map(m=>m[0].replace(/[.,;]+$/,'')))];
}
export function sectionLiteralIndex(input:PreparedInput){
 return input.sources.flatMap(source=>source.excerpts.map(excerpt=>{
  const ref=input.evidenceRegistry.find(r=>r.sourceId===source.id&&r.evidenceId===excerpt.id);
  if(!ref)throw new Error('section-evidence-unknown');
  return {evidenceId:ref.id,directLiterals:directLiterals(excerpt.quote)};
 }));
}
