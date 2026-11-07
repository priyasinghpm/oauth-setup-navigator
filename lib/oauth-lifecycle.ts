import type {OAuthGuide} from './types';
export const LIFECYCLE=[
 ['App registration',/creat\w*.{0,50}(?:app|project)|app registration|hs project create/i],
 ['OAuth configuration',/oauth|auth\.type|app-hsmeta/i],
 ['Client credentials',/client[_\s-]?(?:id|secret)|client credentials/i],
 ['Scopes',/\bscopes?\b|permissions|capabilities/i],
 ['Redirect URLs',/redirect|callback/i],
 ['Authorization',/authoriz\w*.{0,35}(?:url|consent|user|code)|consent/i],
 ['Token exchange',/authorization.?code|code.?exchange|(?:exchange|generate).{0,45}(?:code|token)|grant_type.{0,8}authorization_code/i],
 ['Token renewal',/refresh[_\s-]?token|token (?:renewal|refresh)/i],
 ['Distribution / approval',/distribution|marketplace|approval|verification|review requirements/i],
] as const;
export function lifecycleCoverage(guide:OAuthGuide){return LIFECYCLE.map(([stage,pattern])=>({stage,described:guide.steps.some(s=>s.evidence.status==='documented'&&pattern.test(s.title+' '+s.description))}));}
