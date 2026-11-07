import 'server-only';
import {join} from 'node:path';
import {createFileGuideStore,GuideStorageError} from './storage/file-guide-store';
import type {GuideStore} from './storage/file-guide-store';
function disk(){
 // Serverless writable temporary files are not a durable shared store.
 if(process.env.VERCEL||process.env.AWS_LAMBDA_FUNCTION_NAME)throw new GuideStorageError('unavailable');
 return createFileGuideStore(process.env.GUIDE_STORAGE_DIR||join(process.cwd(),'.local','generated-guides'));
}
export const savedGuides:GuideStore={ready:()=>disk().ready(),save:r=>disk().save(r),get:id=>disk().get(id)};
