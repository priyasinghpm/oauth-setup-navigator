// Diagnostic-only validator for the exact keyword subset used by generationSchema.
// Not a replacement for OAuthGuide, evidence or uncertainty validation.
export function checkResponseSchema(value:unknown,schema:unknown):string[]{
 const failures:string[]=[];
 function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
 function check(v:unknown,s:unknown,path:string){
  if(!record(s)||Object.keys(s).some(k=>!['type','enum','properties','required','additionalProperties','items'].includes(k)))throw new Error('Unsupported diagnostic schema keyword');
  const type=s.type;
  const typed=type==='object'?record(v):type==='array'?Array.isArray(v):type==='string'?typeof v==='string':type==='integer'?typeof v==='number'&&Number.isInteger(v):type==='number'?typeof v==='number'&&Number.isFinite(v):type==='boolean'?typeof v==='boolean':false;
  if(!typed){failures.push(path+':type');return;}
  if(Array.isArray(s.enum)&&!s.enum.some(x=>x===v))failures.push(path+':enum');
  if(type==='object'&&record(v)){
   if(!record(s.properties))throw new Error('Object schema lacks properties');
   for(const key of Array.isArray(s.required)?s.required:[]){if(typeof key!=='string')throw new Error('Invalid required key');if(!(key in v))failures.push(path+'.'+key+':required');}
   for(const key of Object.keys(v)){
    if(!(key in s.properties)){if(s.additionalProperties===false)failures.push(path+':additional-property');continue;}
    check(v[key],s.properties[key],path+'.'+key);
   }
  }
  if(type==='array'&&Array.isArray(v))v.forEach((item,i)=>check(item,s.items,path+'.'+i));
 }
 check(value,schema,'$');return failures;
}
