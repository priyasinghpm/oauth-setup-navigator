import 'server-only';
import {cache} from 'react';
import {connection} from 'next/server';
import {getGuide} from './guides';
import {resolveGuideTarget} from './storage/resolve-guide';
import {savedGuides} from './saved-guides';
import {isSavedGuideId} from './storage/file-guide-store';
export const resolveGuideRoute=cache(async(id:string)=>{
 const guide=getGuide(id);if(guide)return {guide,saved:null};
 if(!isSavedGuideId(id))return null;
 await connection(); // Saved records must be read at request time, not build time.
 return resolveGuideTarget(id,savedGuides);
});
