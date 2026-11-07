import {createHash} from 'node:crypto';
export function researchSourceId(url:string):string {
  const canonical=new URL(url);canonical.hash='';
  return 'source-'+createHash('sha256').update(canonical.href).digest('hex').slice(0,16);
}
