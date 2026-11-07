// Browser remembers only the job UUID. The server remains the source of truth;
// no generated content, credentials, or automatic resume requests are stored here.
export const ACTIVE_JOB_KEY='oauth-navigator:active-job';
export function isJobPointer(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);}
export function readJobPointer():string|null{
 if(typeof window==='undefined')return null;
 const explicit=new URL(window.location.href).searchParams.get('job');if(isJobPointer(explicit))return explicit;
 try{const saved=window.localStorage.getItem(ACTIVE_JOB_KEY);return isJobPointer(saved)?saved:null;}catch{return null;}
}
export function rememberJob(id:string,updateUrl=false){
 if(typeof window==='undefined'||!isJobPointer(id))return;
 try{window.localStorage.setItem(ACTIVE_JOB_KEY,id);}catch{/* The job URL still works if browser storage is unavailable. */}
 if(updateUrl&&(window.location.pathname==='/'||window.location.pathname==='/generate/stepwise'))try{const url=new URL(window.location.href);url.searchParams.set('job',id);url.hash='generate';window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}catch{/* Persistence on the server is unaffected. */}
}
