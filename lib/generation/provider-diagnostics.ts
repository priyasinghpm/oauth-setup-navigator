// Only bounded metadata leaves this module; never log Error/message/stack/body.
export const PROVIDER_STAGES=['request-preparation','generation-admission','provider-request','provider-response','response-json'] as const;
export const PROVIDER_CATEGORIES=['request-build','authentication','permission','not-found','invalid-request','rate-limit','timeout','upstream-unavailable','upstream-error','transport-or-sdk','unexpected-model','incomplete-response','invalid-json','invalid-output-size','unknown'] as const;
const PROVIDER_CODES=['INVALID_ARGUMENT','FAILED_PRECONDITION','UNAUTHENTICATED','PERMISSION_DENIED','NOT_FOUND','RESOURCE_EXHAUSTED','DEADLINE_EXCEEDED','UNAVAILABLE','INTERNAL','UNKNOWN','ABORTED','CANCELLED','OUT_OF_RANGE','ALREADY_EXISTS'] as const;
const FINISH_REASONS=['MAX_TOKENS','SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII','MALFORMED_FUNCTION_CALL','OTHER','MODEL_ARMOR','IMAGE_SAFETY','UNEXPECTED_TOOL_CALL'] as const;
export interface ProviderDiagnostic {
 stage:typeof PROVIDER_STAGES[number];category:typeof PROVIDER_CATEGORIES[number];providerHttpStatus?:number;providerCode?:typeof PROVIDER_CODES[number];finishReason?:typeof FINISH_REASONS[number];
 sourceCount?:number;excerptCount?:number;schemaBytes?:number;evidenceEnumEntries?:number;
}
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function http(v:unknown):number|undefined{return typeof v==='number'&&Number.isInteger(v)&&v>=100&&v<=599?v:undefined;}
export function sanitizeProviderDiagnostic(value:unknown):ProviderDiagnostic {
 const v=record(value)?value:{};
 const stage=PROVIDER_STAGES.find(s=>s===v.stage)??'provider-request';
 const category=PROVIDER_CATEGORIES.find(c=>c===v.category)??'unknown';
 const providerHttpStatus=http(v.providerHttpStatus);
 const providerCode=PROVIDER_CODES.find(c=>c===v.providerCode);
 const finishReason=FINISH_REASONS.find(c=>c===v.finishReason);
 const counts:Pick<ProviderDiagnostic,'sourceCount'|'excerptCount'|'schemaBytes'|'evidenceEnumEntries'>={};
 for(const key of ['sourceCount','excerptCount','schemaBytes','evidenceEnumEntries'] as const){const n=v[key];if(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=1000000)counts[key]=n;}
 return {stage,category,...providerHttpStatus!==undefined?{providerHttpStatus}:{},...providerCode?{providerCode}:{},...finishReason?{finishReason}:{},...counts};
}
export function classifyProviderError(error:unknown):ProviderDiagnostic {
 const e=record(error)?error:{};
 const status=http(e.status);
 const timedOut=e.name==='TimeoutError'||e.name==='AbortError';
 const category=timedOut?'timeout':status===400||status===422?'invalid-request':status===401?'authentication':status===403?'permission':status===404?'not-found':status===429?'rate-limit':status===408||status===504?'timeout':status===503?'upstream-unavailable':status!==undefined&&status>=500?'upstream-error':'transport-or-sdk';
 // The installed SDK exposes ApiError.status and a message that may contain a
 // JSON error envelope. Extract only its canonical status code, never its text.
 let providerCode:unknown=e.code;
 if(typeof e.message==='string'&&e.message.length<=16000){try{const body:unknown=JSON.parse(e.message);if(record(body)&&record(body.error))providerCode=body.error.status;}catch{/* No message parsing heuristics or raw text logging. */}}
 return sanitizeProviderDiagnostic({stage:'provider-request',category,providerHttpStatus:status,providerCode});
}
export interface ProviderFailureLog extends ProviderDiagnostic {event:'oauth-guide-generation-failed';requestId:string;timestamp:string;httpStatus:number}
export function providerFailureLog(requestId:string,httpStatus:number,value:unknown):ProviderFailureLog {
 return {event:'oauth-guide-generation-failed',requestId:/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(requestId)?requestId:'invalid-request-id',timestamp:new Date().toISOString(),httpStatus:http(httpStatus)??502,...sanitizeProviderDiagnostic(value)};
}
