import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readModelConfig,selectModelTransport} from '../lib/generation/model-config';
import {generateWithTransport} from '../lib/generation/generate';
import {input,fixture} from './helpers/generation';
import {prepareGeneration} from '../lib/generation/prepare';
test('default model unchanged and explicit model configurable without credentials',()=>{
 assert.deepEqual(readModelConfig({}),{provider:'gemini',model:'gemini-3.5-flash-lite'});
 assert.deepEqual(readModelConfig({GUIDE_MODEL:'gemini-example'}),{provider:'gemini',model:'gemini-example'});
 for(const env of [{GUIDE_MODEL:'https://evil.example'}, {GUIDE_MODEL_PROVIDER:'openai'},{GUIDE_MODEL_PROVIDER:'bad/provider'}])assert.throws(()=>readModelConfig(env));
});
test('adapter selection fails closed with no fallback and invokes selected adapter only once',async()=>{
 let calls=0;const config={provider:'example',model:'example-model'};
 const transport=selectModelTransport(config,{example:()=>async()=>{calls++;return {text:'{}',finishReason:'STOP'};}});
 assert.equal(transport.model,'example-model');assert.equal(transport.provider,'example');
 await transport({systemInstruction:'',contents:'',jsonSchema:{}});assert.equal(calls,1);
 assert.throws(()=>selectModelTransport({provider:'openai',model:'example-model'},{example:()=>transport}),/model-provider-not-configured/);
 assert.equal(calls,1);
});
test('configured model is validated and recorded; wrong returned model still rejected',async()=>{
 const i=input(),p=prepareGeneration(i),draft=fixture(p);
 const transport=selectModelTransport({provider:'example',model:'example-model'},{example:()=>async()=>({text:JSON.stringify(draft),finishReason:'STOP',returnedModel:'example-model'})});
 const result=await generateWithTransport(i,transport);assert.ok(result.ok);assert.equal(result.model,'example-model');
 const wrong=selectModelTransport({provider:'example',model:'example-model'},{example:()=>async()=>({text:JSON.stringify(draft),returnedModel:'different-model'})});
 const rejected=await generateWithTransport(i,wrong);assert.ok(!rejected.ok);assert.equal(rejected.providerDiagnostic?.category,'unexpected-model');
});
