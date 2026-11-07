# Step 4B: source-ID consistency (2026-11-03)

## Diagnosis from saved artifacts, before any API request

`/tmp/hubspot-generation-evidence-ids.json` recorded the unknown reference `hubspot-source-3ae9f630ec8b5f383c9cdf88`. That identifier does not occur in the retrieved source registry. Its suffix exactly matches the real `evidence-3ae9f630ec8b5f383c9cdf88` excerpt from the v3 token documentation. The previous generation source ID for that URL was `hubspot-source-dc7408e03f` (a different, 10-character URL hash).

The bad identifier was therefore not a backend-generated source ID: it combined the source prefix with an evidence hash. The previous protocol made Gemini reproduce both namespaces and the source registry, enabling this model namespace error. The failure artifact does not retain the raw model response, so we cannot identify the exact returned field or determine whether it also omitted registry entries. No API call was made to diagnose this.

## Fix

Research owns canonical source IDs (`source-` plus a 16-character SHA-256 URL digest) and the existing stable evidence IDs. Newly retrieved pages and excerpts retain their source IDs. Cached legacy research may acquire missing metadata offline; explicit inconsistent IDs or changed excerpts/context are rejected rather than repaired. Existing evidence IDs remain unchanged.

Gemini's structured output contains claim-local `evidenceIds`, never source IDs, source registries, quotation strings, or a separate support array. The backend resolves those selections against only the prepared, sent research excerpts, derives source references, builds the authoritative complete source registry, and inserts exact quotations with context and offsets. Unknown/unsent evidence IDs, duplicate IDs, model-authored source metadata, missing records, and mismatched source mappings fail closed. Existing schema, nonempty-section, unknown-approval, provenance, and exact-excerpt validation remain in place. No frontend or static-guide changes were made.

Modified files: `lib/research/{types,evidence,research}.ts`; `lib/generation/{prepare,types,schema,prompt,validate}.ts`; new `lib/generation/resolve.ts`; `tests/generation.test.ts`; this report and README.

## Validation and one live test

- `npm test`: 41/41 pass (mock-only generation tests plus research/static-guide regressions).
- `npm run typecheck`: pass.
- `npm run build`: pass; the original three guide routes still build.
- Regression cases include missing source records, inconsistent research IDs, invalid/unsent evidence IDs, the historical namespace error, valid multi-source claims, exact quotation/context tampering, unknown approval and fabricated citations.
- Exactly one real request: `gemini-3.5-flash-lite`, no grounding, retries, continuation, paid fallback, or billing changes.
- Valid JSON and complete guide validation both passed: five source records, 36 input excerpts, 14 resolved supporting quotations, five setup steps, `oauthTestStatus: not-tested`.
- Reused eight saved HubSpot pages; five were selected within the generation budgets. No new documentation retrieval was performed. Saved result: `/tmp/hubspot-generation-canonical-ids-result.json` (temporary, not a published guide).

Major-step sources: app configuration uses the create-app and authentication overview pages; credential retrieval uses create-app; authorization and callback steps use the token reference and OAuth quickstart; token exchange uses the token reference. The formerly confused evidence ID now resolves to its correct token-reference source.

## Remaining limitations and unsupported interpretations

Passing structural/provenance validation does not verify every interpretation. This guide remains an unpublished AI draft requiring human review; no OAuth connection was tested.

- Approval/review requirements, external waiting time, and concrete troubleshooting recovery remain explicitly unknown with no unrelated citations.
- The generated token step asserts a 30-minute expiry and long-lived refresh token; its selected excerpts do not establish those durations. These assertions require further evidence review before use.
- Scope strings occur in retained surrounding context, but their selected quotation is a redirect-URL line; read/write semantics are not established by that quotation alone.
- The CLI prerequisite selects a client-secret quotation with CLI material in surrounding context. CLI installation and precise account-role requirements need a better-supported interpretation.
- The first step assumes an existing local project; the draft is not a complete project-creation walkthrough.
- The unmeasured 30–60 minute estimate incorrectly includes backend token-exchange implementation in its qualification, beyond the intended registration/configuration scope. It should not be used as a reliable setup estimate.
- Source truncation and excerpt selection leave coverage gaps. Exact excerpts are preserved, but do not automatically prove the simplified explanations correct.

No further Gemini request was made to repair these content issues. No generated content was added to the static guide library or frontend.
