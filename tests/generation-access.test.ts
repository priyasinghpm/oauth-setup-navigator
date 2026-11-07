import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessConfig,accessToken,validAccess,createAccessHandler,accessDenied,ACCESS_COOKIE} from '../lib/access/generation-access';
const pin='OFFLINE_ONLY_TEST_CODE';const base=1800000000000;
const req=(code=pin,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/access',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({pin:code})});
test('hosted access fails closed; local development remains opt-in',()=>{
 assert.equal(accessConfig({VERCEL:'1'}).required,true);assert.equal(accessConfig({NODE_ENV:'production'}).required,true);assert.equal(accessConfig({}).required,false);assert.equal(accessConfig({GUIDE_ACCESS_PIN:'1234'}).pin,undefined);
});
test('signed cookie expires, rejects tampering and is revoked by rotating the code',()=>{
 const token=accessToken(pin,base);assert.ok(validAccess(token,pin,base));assert.equal(validAccess(token,pin,base+8*3600000),false);assert.equal(validAccess(token,pin+'changed',base),false);assert.equal(validAccess(token+'0',pin,base),false);assert.equal(validAccess(accessToken(pin,base+1000),pin,base),false);assert.ok(!token.includes(pin));
});
test('unlock sets HTTP-only cookie, rejects foreign origins and incorrect codes without disclosing code',async()=>{
 const handler=createAccessHandler({env:()=>({GUIDE_ACCESS_PIN:pin}),now:()=>base});
 assert.equal((await handler(req(pin,'https://evil.example'))).status,403);
 const bad=await handler(req('wrong'));assert.equal(bad.status,401);assert.ok(!(await bad.text()).includes(pin));
 const good=await handler(req());assert.equal(good.status,200);const cookie=good.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Max-Age=28800/);assert.ok(!cookie.includes(pin));
 const https=new Request('https://example.test/api/access',{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({pin})});assert.match((await handler(https)).headers.get('set-cookie')!,/Secure/);
});
test('PIN attempt guard expires naturally without resets; configuration absence is safe',async()=>{
 let now=base;const handler=createAccessHandler({env:()=>({GUIDE_ACCESS_PIN:pin}),now:()=>now});
 for(let i=0;i<5;i++)assert.equal((await handler(req('wrong'))).status,401);
 assert.equal((await handler(req())).status,429);now+=15*60000;assert.equal((await handler(req())).status,200);
 assert.equal((await createAccessHandler({env:()=>({VERCEL:'1'})})(req())).status,503);
});
test('direct generation requests require cookie before downstream work',()=>{
 const previous=process.env.GUIDE_ACCESS_PIN;process.env.GUIDE_ACCESS_PIN=pin;
 try{assert.equal(accessDenied(new Request('http://localhost/api/guides/generate'))?.status,401);const token=accessToken(pin);assert.equal(accessDenied(new Request('http://localhost/api/guides/generate',{headers:{cookie:`${ACCESS_COOKIE}=${token}`}})),null);}finally{if(previous===undefined)delete process.env.GUIDE_ACCESS_PIN;else process.env.GUIDE_ACCESS_PIN=previous;}
});
