# Offline Gemini request optimization — 2026-11-06

No model, token-count API, external research, billing, UI or storage changes were used. This is a payload optimization, not a demonstrated fix for HTTP 503 UNAVAILABLE.

## Baseline and comparison

The retained `/tmp/pipedrive-pattern-research.json` reproduces three sources and 20 selected excerpts. Its SHA-256, the full selected-evidence manifest hash, prompt/schema hashes and measured sizes are preserved in [the size comparison](audits/generation-request-size-comparison.json). This research file is historical local input, not a captured live Gemini request or a fabricated guide. A different input hash means the baseline is not directly comparable.

| Component | Before (UTF-8 bytes) | After (UTF-8 bytes) |
|---|---:|---:|
| System instructions | 7,565 | 4,705 |
| Evidence JSON/metadata | 26,283 | 19,920 |
| Response schema | 6,431 | 6,431 |
| Estimated serialized REST body | 42,045 | 32,187 |
| Rough input tokens | 10,059 | 7,753 |

The estimated body is 9,858 bytes (23.45%) smaller. REST serialization uses the same offline body estimator before/after, not a captured SDK wire body. Tokens are a coarse characters/4 estimate, not Gemini tokenizer measurements. Eight retained historical generation/audit JSON artifacts had no token-usage metadata, and the current adapter retains text/model/finish reason rather than usage. No output token usage was inferred from the resolved guide, which includes backend-inserted quotations. The output ceiling stays 8,192.

Reproduce optimized measurement without an API key or SDK transport:

```sh
node --import tsx scripts/measure-generation-request.ts \
  --input /tmp/pipedrive-pattern-research.json --provider Pipedrive \
  --output /tmp/pipedrive-request-current.json
```

Compare the input hash and evidence manifest against the stored baseline before interpreting size changes. The old instruction hash and baseline measurements are retained; the old prompt implementation is not duplicated into production or tests.

## What changed

`model-evidence.ts` merges overlapping or adjacent quotation-plus-context ranges separately per source. Each shared window is an exact slice of the original bounded research text. It contains every original before/after qualification; it never bridges omitted gaps. Excerpts keep their explicit exact quote, heading and original compact selection ID, plus a source-local context-window reference. Source URL/title are sent once per source. Backend offsets, canonical IDs, context strings and resolver records remain unchanged; internal extraction metadata is omitted from the model-facing presentation only.

All 20 selected quotations, 4,873 quotation characters and the complete 14,192 characters of original contextual coverage remain available. The selected-evidence manifest is identical. Some quote text intentionally also appears inside shared windows to keep both direct supporting quotations and surrounding conditions easy to read. No evidence was dropped for a size target. Existing lifecycle-prioritized preparation is unchanged.

The shorter prompt preserves prompt-injection boundaries, provider/version identity, evidence-ID-only response format, nonempty collections, editorial estimates, not-tested status and explicit unknowns. It explicitly forbids invented commands/endpoints/scopes/configuration values, requires directly supporting quotations rather than a related-topic match, and requires unknown disclosures for unsupported lifecycle stages. Context can qualify a claim but cannot silently provide missing direct support.

The response schema remains byte-identical, including zero evidence-ID enum entries. Removing required fields or introducing schema references would create compatibility risk without demonstrated equivalence for the configured model, so neither was done. Research discovery, lifecycle selection, SDK settings, generation limits, validators, saved-guide storage and UI remain untouched.

## Validation and limitations

136 automated tests, TypeScript and production build pass. New tests verify exact ID/quote retention, original qualifications, union coverage with no invented gaps, lifecycle signals, mismatched contexts/source references, strict unsupported command/endpoint/scope rejection, window-ID rejection and the unchanged evidence-only response contract. The authentic historical HubSpot guide still fails current evidence-quality validation at `steps.1` and the same eight audited claims; its evidence was not repaired and validation was not relaxed.

Pipedrive topic signals are unchanged across registration, configuration, credentials, redirects, scopes, authorization, exchange, renewal and distribution. These are keyword signals, not proof of semantic completeness. Registration/scope specifics can remain partial; approval/review requirements, timing and troubleshooting recovery remain unknown. Full-context preservation does not itself prove interpretation correctness.

The model must now follow an excerpt-to-window reference instead of receiving repeated inline contexts. Offline tests prove exact preservation and backend compatibility; they cannot prove that Gemini will interpret the reorganized context correctly, produce valid JSON or avoid 503. One separately authorized controlled live generation and human review are still needed. No live request was made during optimization.
