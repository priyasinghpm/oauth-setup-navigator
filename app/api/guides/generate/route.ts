import {savedGuides} from '../../../../lib/saved-guides';
import {createGenerateHandler} from '../../../../lib/api/generate-guide';
import {researchProvider} from '../../../../lib/research';
import {generateOAuthGuide} from '../../../../lib/generation';

export const runtime='nodejs';
export const maxDuration=150;
export const POST=createGenerateHandler({
  storage:savedGuides,
  research:input=>researchProvider(input),
  generate:(input,context)=>generateOAuthGuide(input,undefined,context),
  enabled:()=>process.env.GUIDE_GENERATION_ENABLED==='true',
  configured:()=>Boolean(process.env.GEMINI_API_KEY?.trim()),
});
