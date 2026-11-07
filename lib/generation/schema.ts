// JSON Schema mirrors OAuthGuide; the existing runtime parser remains authoritative.
const text = {type:'string'};
// Avoid counted-array constraints: Gemini expands them into large grammar states.
// All collection limits are enforced after generation instead.
const array = (items: unknown, _maxItems=8) => ({type:'array',items});
const object = (properties: Record<string,unknown>) => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function generationProperties() {
  // Keep selection constraints in the request-owned backend registry. Repeating
  // large enums here multiplies grammar branches across every claim shape.
  const evidenceId={type:'string'};
  const evidence=object({status:{type:'string',enum:['documented','estimated','unknown']},evidenceIds:{type:'array',items:evidenceId},qualification:text});
  const claim=object({text,evidence});
  return {
    slug:text,name:text,category:text,mark:text,summary:text,keywords:array(text),
    verificationStatus:{type:'string',enum:['source-backed']},oauthTestStatus:{type:'string',enum:['not-tested']},lastResearchedAt:text,
    difficulty:object({level:{type:'string',enum:['Easy','Moderate','Complex']},explanation:text,evidence}),
    setupEstimate:object({minMinutes:{type:'integer'},maxMinutes:{type:'integer'},evidence}),
    approvalSummary:claim,approvalWaitingTime:claim,prerequisites:array(claim,4),
    steps:array(object({title:text,description:text,expectedOutcome:text,evidence}),8),
    scopes:array(object({name:text,purpose:text,evidence}),4),approval:array(claim,4),
    blockers:array(object({issue:text,action:text,evidence}),3),
    responsibilities:object({agent:array(claim,3),developer:array(claim,3)}),
    nextActions:array(claim,3),
  };
}
export function generationSchema(){return object({guide:object(generationProperties())});}

