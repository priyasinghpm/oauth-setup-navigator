# Generated-guide evidence quality — 2026-11-05

## Audit scope

The available saved generated HubSpot result is from **2026-11-03**, originally `/tmp/hubspot-generation-canonical-ids-result.json`. Its unchanged guide is now preserved as an offline regression artifact in [audits/hubspot-generated-2026-11-03.json](audits/hubspot-generated-2026-11-03.json). The independently retained public source text is in [audits/hubspot-source-snapshot.json](audits/hubspot-source-snapshot.json). Neither artifact is imported by the application or used as a generation fallback.

A newer successful homepage response was not saved in the accessible artifacts. This audit does not assume it has the same claims or omissions as the November 3 result. The previously corrected [editorial audit](audits/hubspot-content-audit.md) remains separate from raw generated output; no generated result is relabeled human-reviewed.

## Claim-by-claim findings in the saved response

| Claim/instruction | Selected support | Finding |
| --- | --- | --- |
| Account with administrative or developer access | Editorial inference, source reference only | Exact role applicability not established; should not be a confirmed requirement. |
| Prepare OAuth backend | Overview paragraph on multi-account OAuth and backend hosting | Directly supports the high-level prerequisite, but the old quotation ends mid-sentence. |
| Install the HubSpot CLI | Client-secret confidentiality paragraph | Selected quotation is irrelevant. CLI material occurs in preceding context, not the quotation. |
| Configure auth/distribution | Overview paragraph explicitly describes OAuth and distribution | Direct support for OAuth and private/marketplace choice. Marketplace choice is not proof of listing approval. |
| Configure redirect URL | A single `redirectUrls` line from a larger config | Supports that field/example, but is an incomplete configuration block. Production HTTPS qualification was missing. |
| Retrieve client ID/secret using console navigation | Paragraph says credentials can be found in HubSpot | Broad action supported; `hs project open` and Project Components navigation occur only in context. Auth-tab location is elsewhere in the retained source. Project upload is omitted. |
| Build authorization URL | Token-reference prose plus a clipped quickstart introduction | Basic authorization supported; endpoint and singular `scope` parameter appear in examples/context rather than the chosen quote. The prose says `scopes`, creating a format ambiguity resolved by the actual example/table. |
| Handle callback `code` | Prose describing callback plus a lone `app.get(...) {` line | Callback receipt supported. The handler line is an incomplete code block. Single-use semantics are documented elsewhere, not by these chosen quotations. |
| Exchange code for tokens | Prose specifying form POST to `/oauth/v3/token` plus a `redirect_uri` command fragment | High-level exchange supported. Full command, grant type and URI details are incomplete/context-only. Absolute endpoint examples differ between retained reference and quickstart; select evidence for the actual endpoint being instructed. |
| 30-minute access-token lifetime | In surrounding context of the exchange quote | The retained source does document a current 30-minute lifetime, but the chosen quote does not. Prefer response `expires_in`; quote its direct support. |
| Long-lived refresh token | No direct lifetime evidence selected | Unsupported lifetime implication; renewal role is documented, a duration is not established. |
| Contact read/write scope purposes | A `redirectUrls` quotation for each | Irrelevant selected quotation; scope names occur only in context. The write scope's precise documented example is creating contacts, not every possible mutation. |
| Difficulty/30–60 minute effort | Editorial estimates | Not provider requirements. The saved effort qualification improperly includes backend token-exchange implementation; prompt now explicitly excludes it from registration/configuration effort. |
| Approval, waiting time and recovery | Unknown entries with no citations | Correct uncertainty representation; preserve it. |
| Agent/developer tasks and next actions | Editorial recommendations | Not executed actions or official approval. Retain those labels. |

Missing lifecycle stages in this saved result include explicit project creation/upload and token renewal. Credentials, authorization and exchange are present at a basic level, so it would be inaccurate to call them entirely absent in this particular archive; their detailed support is incomplete. The newer unsaved result's exact coverage cannot be audited retroactively.

## Extraction and generation changes

New research excerpts use versioned **whole blocks**: complete paragraphs, Markdown fenced code/configuration blocks, and safe complete-sentence fallback for oversized prose. Oversized tables/lists/configuration, unclosed fences and terminal blocks cut by a source character limit are omitted instead of cropped or repaired. HTML `pre` whitespace is preserved in the retained text; paragraph boundaries are retained. Quotations remain exact contiguous slices of that extracted text, not byte-identical HTML.

Source URL, section heading, offsets and before/after context remain attached. The per-excerpt bound is now **1,600 characters** to admit complete commands/configs; per-page 24,000-character extraction limits, research request/byte/time limits, generation source limits (54,000 characters total), and the 36,000-character evidence budget remain unchanged. Complete block selection is prioritized across lifecycle topics within those same budgets. This is ranking, not semantic verification.

Historical caches are explicitly validated with the read-only legacy extractor; their original IDs/text remain unchanged. New block-based excerpts have versioned IDs. No old guide is silently rewritten or re-cited. Clipped records are excluded from generation preparation and rejected as support for documented steps/prerequisites/scopes.

The prompt requires directly relevant complete selections, exact supporting commands/endpoints/values, and coverage of registration, configuration, credentials, scopes, redirects, authorization, exchange, renewal and distribution where evidence supports them. Related stages can be combined within the existing 4–8 step bound. Missing evidence must be disclosed rather than padded with invented instructions. No schema expansion or second model was added.

## Deterministic checks and limits

Existing compact-ID membership, canonical source mapping, exact text/context, uncertainty, identity and not-tested checks remain. New typed rules reject:

- `guide-evidence-clipped`: clipped support for documented steps, prerequisites or scopes.
- `guide-evidence-command-incomplete`: detectable unfinished commands, dangling continuations/options, or unclosed code fences.
- `guide-evidence-literal-missing`: a step's explicit command/URL/configuration assignment/duration or a scope name is missing from its selected quotation. Context alone cannot supply it. Configuration pair checks require the selected key/value association.
- `guide-evidence-topic-mismatch`: the selected quotation lacks necessary topic terms for an explicitly named lifecycle action.

These are necessary, conservative checks, not a semantic entailment engine, shell execution/syntax proof, exhaustive configuration parser, or OAuth test. Some directly supported paraphrases/alternative syntax may require better evidence selection or editorial qualification. A keyword/literal match can still accompany an irrelevant interpretation. Failures do not trigger evidence substitution, fabricated citations, discarded references or model retries.

Lifecycle coverage is reported as topic signals, not completeness certification. Backend success warnings flag absent stages; the generated UI lists stages with no detected documented step. Unknown/estimated mentions do not count as documented coverage. Distribution topic matches do not establish approval requirements.

## Generated frontend presentation

Generated claims use **“Cites retrieved documentation · relevance needs review”** instead of implying their interpretations were officially verified. Each cited instruction has a direct official-source link opening in a new tab, a visible exact quotation, source heading/research date, and expandable bounded context. Historical partial quotations are explicitly flagged when rendered. Existing AI-generated, not-human-reviewed and not-end-to-end-tested warnings remain.

Static guide data, static labels and static route content were not changed. The shared components receive an explicit generated flag; their existing static presentation remains the default.

## Offline results and remaining gaps

Re-extracting the existing HubSpot text selected **29 excerpts across five sources**, including **eight complete code blocks and zero clipped excerpts**. Retained source text: **54,000 characters**. Selected quotation/context/heading text: **34,920 characters**, within the existing **36,000** budget. Topic signals were present for all lifecycle categories; review requirements, approval timing and troubleshooting recovery flags all remained missing/unknown. These are source-coverage observations, not a newly generated or verified guide.

- **105/105 automated tests pass**, including nine new extraction/evidence-quality cases and a generated/static frontend regression case.
- **TypeScript and production build pass.** All three static guide routes still build.
- Historical regressions demonstrate genuine-but-irrelevant scope evidence, context-only command support, invalid IDs, clipped evidence, incomplete commands, unsupported URLs/configuration values, direct supported config pairs and missing renewal.
- DOM integration tests verify direct source links, cautious labels, dates, lifecycle warnings and unchanged static labels. Actual mobile/browser rendering was not visually checked in this task.

A future explicitly authorized live test is needed to confirm the model selects these new block references and covers the lifecycle adequately. Human review remains necessary for semantic relevance, account-specific permissions, production security/storage/CSRF handling, approval/review applicability and recovery. Developer-run registration/consent/exchange/renewal tests remain unperformed. No Gemini calls, paid services, retries, billing changes, server restarts or generation activation occurred here.

## Files

Added: research evidence-ID utility and legacy validation extractor; `lib/generation/evidence-quality.ts`; `lib/oauth-lifecycle.ts`; `tests/evidence-quality.test.ts`; the dated raw HubSpot guide artifact; this report. Modified: block extraction/research metadata, bounded evidence preparation/resolution, generation prompt/validator/warnings, typed rule codes, generated evidence/checklist/presentation components, regression tests and README. `data/guides.json` remains unchanged.
