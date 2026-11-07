# Backend-owned official source excerpts

The research layer now creates exact excerpt records. Gemini selects IDs and writes simplified explanations; it does not write the official quotation strings. No frontend integration or static guide content was changed.

## Data flow

1. Retrieval keeps the extracted page text, URL, title and retrieval metadata as before. `extractEvidence()` creates bounded, contiguous text slices and attaches them to `ResearchPage.excerpts`. The research CLI stores these records when an output path is supplied.
2. Each record contains a content-derived evidence ID, source URL/title, exact quote, offsets, nearest Markdown heading where available, up to 360 characters of preceding/following context, and a `clipped` flag. IDs are deterministic for the same URL, text, offsets and context. Changes to those inputs produce a new ID.
3. Older cached research without excerpts can be upgraded locally from its retained text, without fetching or calling a model. A supplied stored registry is checked against that retained text: changed quotation wording, context, IDs, duplicate IDs or source mappings are rejected.
4. Preparation selects bounded excerpts from the selected retrieved sources. Gemini receives these records as untrusted reference material plus their source registry. Only sent evidence IDs are eligible for selection.
5. The model output contains `support` entries with only `path`, `sourceId`, and `evidenceId`. Its output schema contains no quotation-text field. Model-authored `quote`, `quotations`, excerpt or context fields are rejected by backend validation even if the model ignores the schema.
6. After all guide, citation, selection and uncertainty checks pass, the backend resolves each ID and copies the stored strings into `guide.<claim>.evidence.quotations`. AI explanations remain in their existing `description`, `text`, `purpose`, `action`, or `expectedOutcome` fields. Resolved quotations also appear in the returned support audit.

No quotation string, source URL or surrounding context is taken from a model-authored quote. For future presentation, use the explanation and official excerpt as separate text fields. Excerpts/context should be rendered as plain text, with the source link, heading and clipping indicator; this phase adds no rendering component.

## Exactness, context, and limits

Exactness is relative to the retained extracted page text. HTML parsing removes markup, scripts and navigation and normalizes layout whitespace before evidence extraction; it does not create a byte-for-byte HTML facsimile. Markdown text is retained as retrieved apart from the existing outer trim/size bounds. Evidence extraction and resolution do not paraphrase, normalize, splice discontinuous passages, or add ellipses to quotations.

The quotation length remains 20–400 characters, preserving the previous quote-length checks. Long passages may be split with a clipping flag; the before/after slices and heading travel with the quotation so it is not presented without context. Context is bounded and is not a guarantee that every relevant condition elsewhere in a document has been captured.

The research layer retains up to 80 excerpts per page. Generation sends up to 12 excerpts per selected source with a 36,000-character combined quote/context/heading budget. Existing source-text, output-token, response-size, request deadline and single-attempt limits remain in place. No search, grounding, paid fallback, or extra model tools are enabled.

An exact quotation proves only that the stored string came from that retained source text. It **does not prove that Gemini’s explanation follows from it**, that the source is still current, or that an OAuth flow was tested. The generation result explicitly warns that human review is required. The existing nonempty section rules, unknown approval entries with no unsupported citations, editorial estimate qualifications, and `not-tested` status remain required.

## Automated validation

**39 tests passed**, plus TypeScript and production build checks. Tests cover stable evidence IDs; exact offsets and text; source URL and context retention; actual research results containing excerpts; offline legacy-corpus upgrades; tampered cached records; ID-only model output; invalid, missing, duplicate and cross-source selections; model-authored quote rejection; backend insertion and reparsing; unknown approval/recovery rules; safe API failures; and the existing guide/search and retrieval protections.

The `OAuthGuide` model adds optional backend-populated `Evidence.quotations`; static JSON does not need a migration. The normal parser preserves and validates those records and their source mappings. Gemini is never permitted to populate that optional property directly.

## One live HubSpot test — 2026-11-03

The existing retrieved corpus was upgraded locally to `/tmp/hubspot-research-with-evidence.json`, containing **505 exact excerpt records**. No additional research HTTP request was made. A single Gemini request used the confirmed free-tier `gemini-3.5-flash-lite` model, with no grounding, retries or paid fallback. It selected from a bounded subset of this registry.

Gemini returned syntactically valid JSON, but the guide was rejected with this exact error:

```text
Invalid guide data at hubspot: unknown source reference hubspot-source-3ae9f630ec8b5f383c9cdf88
```

That ID is not in the backend’s source registry. The backend did not guess a mapping, substitute a source, accept any quotation, or make a repair request. The complete guide did **not** pass validation. Later evidence-selection and uncertainty gates were not reached. The failure result is retained locally in `/tmp/hubspot-generation-evidence-ids.json`; the model body was not retained in that fail-closed result.

The known input gaps remain approval/review requirements, approval timing, and explicit error recovery instructions. The rejected answer’s other interpretations have not passed a full provenance/semantic audit. This is a separate issue from exact quotation ownership: mocked tests verify that accepted model selections are resolved exclusively to stored source text, but this particular live answer failed before it could be accepted.

Exactly **one real Gemini request** was made for this change. No additional generation was attempted. No frontend, static guide, or billing configuration was modified.

## Main implementation files

- `lib/research/evidence.ts`: stable excerpt extraction and cached-record integrity checks.
- `lib/research/types.ts` / `research.ts`: excerpt records stored with research pages.
- `lib/generation/prepare.ts`, `prompt.ts`, `schema.ts`, `validate.ts`: bounded evidence registry, model ID selection, strict mapping checks and backend quote insertion.
- `lib/types.ts` / `lib/validate-guides.ts`: optional resolved quotations retained by the existing guide parser.
- CLI output and mocked tests were updated for the ID-selection contract. No new dependencies were required.
