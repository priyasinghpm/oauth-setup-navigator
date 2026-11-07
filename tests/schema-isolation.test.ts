import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generationSchema} from '../lib/generation/schema';
import {checkResponseSchema} from '../scripts/helpers/check-response-schema';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
test('actual production schema stays byte-identical and synthetic wire drafts conform',()=>{
 const schema=generationSchema();assert.equal(Buffer.byteLength(JSON.stringify(schema)),6431);assert.equal(createHash('sha256').update(JSON.stringify(schema)).digest('hex'),'01ab391bb5451c35c8ab201e39a3bf720730c9ef223599ae97826741e1935cd9');
 assert.deepEqual(checkResponseSchema(fixture(prepareGeneration(input())),schema),[]);
});
test('schema diagnostic rejects required fields, wrong types, enums and additional properties',()=>{
 const valid=fixture(prepareGeneration(input()));
 for(const change of [(v:any)=>delete v.guide.name,(v:any)=>v.guide.setupEstimate.minMinutes=1.2,(v:any)=>v.guide.oauthTestStatus='tested',(v:any)=>v.guide.sources=[],(v:any)=>v.guide.steps[0].evidence.evidenceIds='wrong']){const v=structuredClone(valid);change(v);assert.ok(checkResponseSchema(v,generationSchema()).length);}
 assert.throws(()=>checkResponseSchema({}, {type:'object',properties:{},oneOf:[]}),/Unsupported/);
});
