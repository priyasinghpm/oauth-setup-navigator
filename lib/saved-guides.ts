import 'server-only';
import {createSupabaseGuideStore} from './storage/supabase-guide-store';
import {join} from 'node:path';
import {createFileGuideStore,GuideStorageError} from './storage/file-guide-store';
import type {GuideStore} from './storage/file-guide-store';
function disk(){
 // Serverless writable temporary files are not a durable shared store.
 if(process.env.VERCEL||process.env.AWS_LAMBDA_FUNCTION_NAME)throw new GuideStorageError('unavailable');
 return createFileGuideStore(process.env.GUIDE_STORAGE_DIR||join(process.cwd(),'.local','generated-guides'));
}
function selected():GuideStore{
 const kind=process.env.GUIDE_STORAGE_BACKEND||'file';
 if(kind==='supabase')return createSupabaseGuideStore(process.env.SUPABASE_URL||'',process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
 if(kind!=='file')throw new GuideStorageError('unavailable');
 return disk();
}
export const savedGuides:GuideStore={ready:()=>selected().ready(),save:(r,id)=>selected().save(r,id),get:id=>selected().get(id)};
