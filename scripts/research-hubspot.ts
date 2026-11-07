// No environment file is loaded and no model SDK is imported.
import { writeFileSync } from 'node:fs';
import { researchProvider } from '../lib/research';
async function main() {
const seeded=process.argv.includes('--seeded');
const result=await researchProvider({website:'https://developers.hubspot.com',...(seeded?{seedUrls:[
  'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview',
  'https://developers.hubspot.com/docs/api-reference/legacy/authentication/manage-oauth-tokens',
]}:{})});
const outputIndex=process.argv.indexOf('--output');
if (outputIndex>=0 && process.argv[outputIndex+1]) writeFileSync(process.argv[outputIndex+1],JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,pages:result.pages.map(({text,excerpts,...page})=>({...page,textCharacters:text.length,excerptCount:excerpts?.length??0}))},null,2));

}
main().catch(() => { console.error('Research command failed'); process.exitCode=1; });
