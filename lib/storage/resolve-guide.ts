import {getGuide} from '../guides';
import {isSavedGuideId} from './file-guide-store';
import type {GuideStore} from './file-guide-store';
// One URL namespace, with existing static slugs taking precedence.
export async function resolveGuideTarget(id:string,store:Pick<GuideStore,'get'>){
 const guide=getGuide(id);if(guide)return {guide,saved:null};
 if(!isSavedGuideId(id))return null;
 const saved=await store.get(id);return saved?{guide:saved.guide,saved}:null;
}
