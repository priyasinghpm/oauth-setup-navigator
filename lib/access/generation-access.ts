import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {sameOrigin,readBody} from '../api/generate-guide';
export const ACCESS_COOKIE='oauth-guide-access';
const TTL=8*60*60;
export function accessConfig(env:Record<string,string|undefined>=process.env){
 const pin=env.GUIDE_ACCESS_PIN||'';
 return {required:Boolean(pin)||Boolean(env.VERCEL)||env.NODE_ENV==='production',pin:pin.length>=12&&pin.length<=128?pin:undefined};
}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function accessToken(pin:string,now=Date.now()){const expiry=String(Math.floor(now/1000)+TTL);return expiry+'.'+createHmac('sha256',pin).update('oauth-guide-access:'+expiry).digest('hex');}
export function validAccess(token:string|undefined,pin:string|undefined,now=Date.now()){
 if(!pin||!token||!/^\d{10}\.[a-f0-9]{64}$/.test(token))return false;
 const [expiry,mac]=token.split('.');const seconds=Math.floor(now/1000);if(Number(expiry)<=seconds||Number(expiry)>seconds+TTL)return false;
 return equal(mac,createHmac('sha256',pin).update('oauth-guide-access:'+expiry).digest('hex'));
}
export function accessDenied(request:Request):Response|null{
 const config=accessConfig();if(!config.required)return null;
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(ACCESS_COOKIE+'='))?.slice(ACCESS_COOKIE.length+1);
 if(validAccess(cookie,config.pin))return null;
 return Response.json({ok:false,status:'failed',error:{code:config.pin?'access-required':'access-unavailable',message:config.pin?'Enter the shared access code before generating a guide.':'Generation access is not configured.'}},{status:config.pin?401:503,headers:{'Cache-Control':'no-store'}});
}
export function createAccessHandler(options:{env?:()=>Record<string,string|undefined>;now?:()=>number}={}){
 const attempts:number[]=[];const now=options.now??Date.now;
 return async(request:Request)=>{
  const reply=(status:number,code:string)=>Response.json({ok:false,error:{code}},{status,headers:{'Cache-Control':'no-store'}});
  if(!sameOrigin(request))return reply(403,'cross-origin');
  const config=accessConfig(options.env?.()??process.env);if(!config.pin)return reply(503,'access-unavailable');
  const time=now();while(attempts.length&&time-attempts[0]>=15*60000)attempts.shift();
  if(attempts.length>=5)return reply(429,'access-rate-limit');attempts.push(time);
  let body:unknown;try{body=await readBody(request);}catch{return reply(400,'invalid-input');}
  if(!body||typeof body!=='object'||!('pin'in body)||typeof body.pin!=='string'||body.pin.length>128||!equal(body.pin,config.pin))return reply(401,'invalid-access-code');
  const secure=new URL(request.url).protocol==='https:'||Boolean((options.env?.()??process.env).VERCEL);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`${ACCESS_COOKIE}=${accessToken(config.pin,time)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL}${secure?'; Secure':''}`}});
 };
}
