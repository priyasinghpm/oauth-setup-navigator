# Step 4B — Gemini transformation of retrieved evidence

The server-only module is implemented and mocked tests pass. **No live guide has been accepted.** The latest separately authorized test fixed the empty-approval failure but stopped at the exact supporting-excerpt check. Earlier attempts and the latest result are recorded chronologically below. No automatic retry, model switch, search tool, or paid fallback was attempted.

## Interface and boundaries

Import `generateOAuthGuide` from `lib/generation` in server-side Node.js code. Pass `{ provider, slug, research }`, where `research` is an actual `ResearchResult` with extracted text and successful retrieval records. The metadata-only report in `docs/hubspot-research-results.json` is not enough: it deliberately omits document bodies. The real test used the existing `/tmp/hubspot-research-seeded.json` source corpus.

The result is a discriminated union. Success returns an ordinary `OAuthGuide`, a separate supporting-excerpt audit, selected source metadata, warnings, model name, and request count. Failure returns a safe error category, request count, and JSON/schema status. Neither outcome edits the static guide library or UI.

The output envelope is `{ guide, support }`. The nested `guide` follows the existing `OAuthGuide` model; proof excerpts stay outside the user-facing guide. No generated HubSpot guide or provider-specific answer is hardcoded into production code. Tests construct a synthetic Example-provider response solely for mocking.

## Input, output, and evidence controls

- Fixed model: `gemini-3.5-flash-lite`, using the installed official Google Gen AI SDK. No grounding, URL context, functions, or other tools are configured.
- At most five sources, 12,000 characters per source, and 54,000 total documentation characters. Source identifiers are deterministic hashes of retrieved URLs, prefixed by provider slug. Titles/URLs/identity metadata are independently bounded.
- Sources must be within the supplied research website’s domain and have successful retrieval records. Truncated/unsent material cannot be used as evidence. Legacy v1 material is ranked lower to reduce accidental mixing with newer documentation.
- The provider, slug, research date, source IDs, URLs, titles, and inspection dates must match the prepared registry. Every documented claim requires an exact 20–400 character supporting excerpt from each cited source actually sent to Gemini. Every citation must resolve within that registry.
- The existing `parseGuides()` parser is reused. Its default static-provider host allowlist stays unchanged. Generated validation passes an explicit allowlist of exact retrieved URLs rather than broadly trusting new hosts.
- Missing review requirements, approval durations, and recovery instructions are detected conservatively and must remain `unknown`. Numeric waiting times cannot be inserted into unknown approval duration. Difficulty and setup effort remain qualified editorial estimates. The guide must be `not-tested`.
- Documentation is JSON-encoded under an untrusted-data field; system instructions explicitly reject commands embedded in documents. No webpage text is executed, no credentials are included in the prompt, and the model has no tools.
- Valid source IDs and matching excerpts establish provenance, **not semantic entailment**. A paraphrase could still misrepresent its excerpt. Any accepted result requires human factual review before publication. The module does not claim that deterministic checks eliminate prompt injection or hallucination.

## API usage and failures

One generation attempt per invocation, a 60-second deadline, 8,192 maximum output tokens, and a 70 KB response limit. SDK retries and automatic continuation are disabled. Only one generation may be active in this process. Missing keys and invalid research input cause no model call. HTTP 429, timeout/abort, provider rejection, incomplete responses, invalid JSON, and invalid schema/provenance are separate safe failures. No automatic JSON repair request or fallback is made. Errors do not expose raw SDK messages or credentials.

This module assumes the existing key is on the user-confirmed Free tier with billing disabled; it cannot inspect or force the project’s billing tier. No billing API or settings are touched. It is not exposed through a public API route, so shared distributed rate limiting is outside this phase.

## One real HubSpot test — 2026-11-03

- Requests made: **1**.
- Model requested: `gemini-3.5-flash-lite`.
- Research text supplied: **54,000 characters across five retrieved sources**.
- Result: **HTTP 400**, safe `provider-error` result.
- Gemini guide JSON produced: **No**.
- Schema/provenance validation of a live guide: **Not reached**.
- No generated guide was accepted or added to the application.

The adapter intentionally discarded the raw provider message, so the exact 400 reason is unconfirmed. Google documents that large/deep structured-output grammars and array-counting constraints can produce HTTP 400. After this failure, the request schema was simplified by removing repeated source-ID enums and counted-array/numeric bounds; the same bounds remain enforced in runtime validation. This is a mitigation consistent with the documentation, **not a confirmed fix**. The revised request has not been sent to Gemini, preserving the one-request limit.

Official references: [Structured output limitations and simplification](https://ai.google.dev/gemini-api/docs/structured-output#simplifying-complex-schemas), [model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), and [pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).

### Retrieved support available for the major setup stages

These are the actual sources sent, not citations from a successfully generated guide:

| ID | Retrieved page | Intended support |
| --- | --- | --- |
| `hubspot-source-dc7408e03f` | [v3 token management](https://developers.hubspot.com/docs/api-reference/legacy/authentication/manage-oauth-tokens) | Authorization-code/token exchange and documented error response |
| `hubspot-source-b360a5fa75` | [Create an app](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/create-an-app.md) | First concrete setup action and CLI registration |
| `hubspot-source-59f9552765` | [App configuration](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/app-configuration.md) | Redirect URLs, permission lists, auth/distribution configuration |
| `hubspot-source-1876a2b7bb` | [Authentication overview](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview) | Choosing OAuth and configuring authentication |
| `hubspot-source-97a278ade1` | [OAuth quickstart](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide.md) | Authorization URL and callback/token flow |

The supplied evidence does not establish provider review criteria or approval duration. An error response is documented, but explicit recovery instructions were not established by the conservative error-section check. Those three gap flags are true, and an attempted guide that fills them with unsupported facts is rejected. Actual account permissions, console behavior, OAuth execution, and estimate accuracy also remain untested.

## Tests and reproduction

`npm test` uses mocked transports only, never loads `.env.local`, and never imports the Gemini SDK through the generation tests. There are **30 passing tests total**, including **8 generation tests** for valid fixtures, invalid JSON/incomplete output, source/quote tampering, unknown gaps, safe quota/timeout/provider errors, bad research input, prompt/data separation, size bounds, and runtime enforcement after schema simplification. TypeScript and the production build pass.

Live tests are separate and require explicit flags:

```sh
npm run generate:hubspot -- --live --free-tier-confirmed \
  --input /tmp/hubspot-research-seeded.json \
  --output /tmp/hubspot-generation-result.json
```

Without those flags, the command makes no request. The key is read only from `.env.local` for this opt-in CLI command and is never printed. Output goes only to the caller-selected path; it is not a database or application guide artifact. Running this command again would make another real request and was **not** done after the HTTP 400.

## Files and scope

Added `lib/generation/` (preparation, schema, prompting, validation, orchestration, server-only SDK adapter and types), `scripts/generate-hubspot.ts`, `tests/generation.test.ts`, and this report. Extended `lib/validate-guides.ts` with optional exact-URL validation and added the CLI npm script/documentation. No dependencies, frontend components, static guide content, API routes, or database were added or changed for this step. Steps 4C/4D have not started.

## Revised-schema live test — 2026-11-03

A separately authorized follow-up made exactly **one additional real request**, using the revised schema, the same five HubSpot research excerpts, `gemini-3.5-flash-lite`, no tools/grounding, no SDK retry, and no automatic continuation. Total structured-generation attempts across the initial test and this follow-up: two.

The original HTTP 400 detail cannot be recovered: the first adapter discarded its body and saved only the generic status message. No rejected parameter or exact root cause can be established retrospectively. A sanitized provider-message capture is now retained for future provider failures, with exact key replacement before truncation, plus API-key-pattern, bearer-token, and key-query redaction.

**The revised structured-output schema was accepted and Gemini returned syntactically valid JSON.** The existing runtime guide validator then rejected it:

```text
Invalid guide data at guides[0].approval: expected a nonempty array
```

There was no new HTTP 400. This is an output-content/schema-contract failure: `approval` was empty rather than containing the required explicit unknown approval entry. JSON validity passed; OAuthGuide schema validity failed. The remaining source/excerpt checks were not reached, no guide was accepted, and the rejected response body was not retained for claim-by-claim auditing. The safe diagnostic result is stored locally at `/tmp/hubspot-generation-revised-result.json`.

Known evidence gaps remain provider review requirements, approval duration, and explicit recovery instructions. These are gaps in the retrieved input, not a completed audit of the rejected model answer. No statement is made that the rejected answer’s other claims were supported.

A plain-text JSON fallback is not indicated by this result: structured output itself worked. The smallest next correction is to require a nonempty unknown approval entry when evidence is missing, preserving existing local validation. No correction request or additional Gemini call was made. Frontend, the three static guides, billing, and later phases remain untouched.

Follow-up checks: **32 automated tests passed**, including diagnostic redaction and the exact empty-approval regression; TypeScript and production build passed.

## Minimal unknown-approval correction — 2026-11-03

The generation instructions now explicitly prohibit `approval: []` and provide the existing supported unknown representation: one explanatory approval claim with `evidence.status: "unknown"`, `sourceIds: []`, and a nonempty qualification. This is a missing-evidence disclosure, not an assertion that any review is required or unnecessary. No unrelated citations or support excerpts may be attached. The same nonempty-array requirement is spelled out for the other required guide sections, with correctly shaped unknown entries for gaps rather than fabricated facts. The runtime parser’s nonempty rules were not weakened.

Generation-only validation also rejects citations attached to missing review requirements or missing approval timing. The existing static guides and their validator defaults are preserved. Focused tests cover a valid unknown approval disclosure, empty approval rejection, fabricated/unrelated citations and support, and other missing-information arrays. **35 tests, TypeScript, and the production build passed before the live request.**

Exactly **one newly authorized real request** was then made with the same HubSpot research corpus and free-tier model, without grounding, retries, or paid fallback. Gemini returned valid JSON. Execution passed the existing guide parser, source-registry comparison, and structural checks, including nonempty approval. It then failed the supporting-excerpt validation with this exact error:

```text
Support quote does not occur in supplied source excerpt
```

The validator uses this message when a support quote fails the exact-substring or 20–400 character requirements. The failed model body was not retained by the fail-closed result, so the specific quote/claim cannot be audited retrospectively. The complete guide did **not** pass validation; no guide was accepted. Subsequent checks, including all final unknown-gap assertions, were not reached. No additional request or automatic repair was made.

The safe result is `/tmp/hubspot-generation-approval-correction.json`. Known input gaps remain provider review/approval requirements, approval waiting time, and explicit error recovery procedures. Other generated factual claims have not passed the full supporting-excerpt audit and must not be treated as verified. Frontend, static guides, billing, and later phases are unchanged.

## Backend-owned quotation update

Official supporting text is now resolved by the backend from stable retrieved evidence IDs, rather than copied by Gemini. See [the exact-evidence report](exact-evidence.md) for the revised contract and latest live test. That single test returned valid JSON but failed on an unknown source ID; no guide was accepted and no additional request was made.
