import {test} from 'node:test';
import assert from 'node:assert/strict';
// Opt-in production-server regression, never starts generation or writes data.
// First build/start on another port, then set PRODUCTION_TEST_ORIGIN locally.
const origin=process.env.PRODUCTION_TEST_ORIGIN;
test('production guide routes render static content and return 404 for missing UUIDs instead of DYNAMIC_SERVER_USAGE',{skip:!origin},async()=>{
 const u=new URL(origin!);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.protocol,'http:');
 for(const slug of ['google-calendar','slack','notion']){
  const response=await fetch(new URL('/guides/'+slug,u),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);assert.ok((await response.text()).includes('OAuth guide'));
 }
 for(const id of ['00000000-0000-4000-8000-000000000000','not-a-provider']){
  const response=await fetch(new URL('/guides/'+id,u),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,404);assert.ok(!(await response.text()).includes('DYNAMIC_SERVER_USAGE'));
 }
});
