import {parseGuideFragment} from './validate-guides';
import {RECOVERY_FIELDS,RECOVERY_TITLES,type RecoveryKey,type RecoveryView} from './generation/recovery-contract';
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function isKey(v:unknown):v is RecoveryKey{return typeof v==='string'&&Object.hasOwn(RECOVERY_FIELDS,v);}
export function parseRecoveryView(v:unknown):RecoveryView{
 if(!record(v)||typeof v.token!=='string'||v.token.length>1000100||!/^[-\w]+\.[a-f0-9]{64}$/.test(v.token)||typeof v.provider!=='string'||!v.provider||typeof v.researchDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.researchDate)||v.reviewStatus!=='not-human-reviewed'||v.oauthTestStatus!=='not-tested'||!Array.isArray(v.sections)||v.sections.length>8||!Array.isArray(v.pending)||!v.pending.every(isKey)||new Set(v.pending).size!==v.pending.length||!Array.isArray(v.sources)||!v.sources.length||v.sources.length>5||typeof v.canContinue!=='boolean'||v.canContinue!==(v.pending.length>0))throw Error('Invalid partial guide response');
 const sources=v.sources.map(s=>{if(!record(s)||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.url!=='string'||typeof s.inspectedAt!=='string')throw Error('Invalid partial source');const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid partial source');return {id:s.id,title:s.title,url:s.url,inspectedAt:s.inspectedAt};});
 const sections=v.sections.map(s=>{if(!record(s)||!isKey(s.key))throw Error('Invalid partial section');const key=s.key;return {key,title:RECOVERY_TITLES[key],content:parseGuideFragment(s.content)};});
 const complete=sections.map(s=>s.key);if(new Set(complete).size!==complete.length||complete.some(k=>v.pending instanceof Array&&v.pending.includes(k))||complete.length+v.pending.length!==8)throw Error('Invalid partial progress');
 const registry=new Map(sources.map(s=>[s.id,s]));
 function check(node:unknown){if(Array.isArray(node)){node.forEach(check);return;}if(!record(node))return;if(Array.isArray(node.sourceIds)&&node.sourceIds.some(id=>typeof id!=='string'||!registry.has(id)))throw Error('Invalid partial evidence');if(typeof node.sourceUrl==='string'&&(typeof node.sourceId!=='string'||registry.get(node.sourceId)?.url!==node.sourceUrl))throw Error('Invalid partial evidence mapping');Object.values(node).forEach(check);}
 sections.forEach(s=>check(s.content));
 return {token:v.token,provider:v.provider,researchDate:v.researchDate,sections,sources,pending:v.pending,canContinue:v.canContinue,reviewStatus:'not-human-reviewed',oauthTestStatus:'not-tested'};
}
export const PARTIAL_STORAGE_KEY='oauth-navigator:partial-guide';
export function retainPartial(view:RecoveryView|null){try{if(view)window.sessionStorage.setItem(PARTIAL_STORAGE_KEY,JSON.stringify(view));else window.sessionStorage.removeItem(PARTIAL_STORAGE_KEY);}catch{/* Current page still works if browser storage is unavailable. */}}
export function restorePartial():RecoveryView|null{try{const raw=window.sessionStorage.getItem(PARTIAL_STORAGE_KEY);return raw?parseRecoveryView(JSON.parse(raw)):null;}catch{return null;}}
