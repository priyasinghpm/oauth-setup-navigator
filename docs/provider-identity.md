# Canonical provider identity — 2026-11-04

## Confirmed cause and investigation limits

The supplied diagnostic for `1ff40c19-6a29-4dfe-9a20-61003310c9f7` identifies the exact generated-guide rule: `guide.name !== input.provider`. The backend originally required literal byte-for-byte name equality even though Gemini supplied the name as free text. Thus capitalization, spacing or an OAuth-guide suffix could fail despite describing the same provider.

The returned name is not retained in diagnostics, so this request cannot be classified definitively as a harmless variation or a genuine wrong-provider result. No raw name is inferred from the older HubSpot artifacts. The fix addresses the confirmed brittle identity contract without assuming every mismatch is harmless.

Original flow: the API used the submitted provider string, or the registrable domain for website-only input; preparation trimmed it; the prompt requested an exact copy; Gemini returned `guide.name`; the guide validator checked literal equality after evidence resolution. The new flow retains the returned name as an identity assertion but gives the backend authority over the final canonical display name.

## Changes

- Research and generation share the existing reviewed discovery identities in `lib/research/provider-registry.ts`. Their discovery URLs are unchanged.
- Preparation binds a canonical provider name to the supplied research domain. Reviewed names use known spelling (e.g. `hubspot` becomes `HubSpot`). A name or website that points to a different reviewed owner fails before calling the model. Unknown provider names must match the supplied domain or appear explicitly in retained source material. User-supplied websites still assert official-domain trust; this does not certify arbitrary website ownership.
- Domain-only requests do not infer a specific product from a reviewed documentation path: `google.com` is not silently renamed `Google Calendar`.
- Name comparison accepts case, whitespace/punctuation formatting and a narrow OAuth suffix grammar, including `HubSpot OAuth`, `HubSpot OAuth 2.0`, and `HubSpot OAuth 2.0 setup guide`. It does not use fuzzy edit distance, substring matching or arbitrary aliases.
- After the returned identity and target/source checks pass, the validator supplies `input.provider` as the canonical final name. It does not rewrite summaries, instructions, quotations or the original model object.
- Different and ambiguous names such as `Slack`, `Notion`, `HubSpot / Slack`, `HubSpoot`, or `HubSpot alternative` retain `guide-identity-mismatch` and are not relabeled. Slug and research date still require exact equality.
- Target/source checks run again during final guide validation. Explicit setup actions for a different reviewed provider, and summaries that directly identify a different reviewed provider as the guide subject, are rejected as `guide-provider-content-mismatch` even if the model copies `HubSpot` or an accepted suffix into its name. Source/domain mismatches have typed `guide-provider-source-mismatch` errors.

Compact evidence references, exact quotations/context, source IDs/URLs, uncertainty rules, required nonempty sections and `not-tested` status are unchanged. No new structured-output enum or schema growth was introduced.

## Tests and limitations

- `npm test`: **95/95 pass**, including seven new identity regression cases; naming tests iterate multiple variations and invalid identities.
- `npm run typecheck`: pass.
- `npm run build`: pass; original static routes, homepage and API still build.
- Tests cover exact/format-equivalent names, backend-owned canonical output, preservation of model content, valid source and quotation mappings, rejection before a mocked model call for wrong source domains, foreign-provider steps/summaries, strict slug/date/evidence/approval checks and product-versus-domain ambiguity.
- One existing research-ID test now compares valid formatting variants rather than intentionally labeling Example documentation as an unrelated provider. Research evidence/source ID generation itself remains unchanged.

These deterministic checks bind identity and provenance and catch explicit foreign-provider instructions; they are not a full semantic verifier for every possible third-party brand or unsupported interpretation. Full content review remains necessary. Alias and reviewed-domain rules are intentionally conservative: a legitimate but unlisted alternative domain/name needs explicit review rather than automatic acceptance. Successful canonical naming is not provider approval or an executed OAuth connection.

No Gemini calls, live retries, server restarts, frontend/static-guide content changes, generation activation or billing changes were performed. Offline tests verify this correction. A future explicitly authorized end-to-end request is still needed to confirm the current model's complete live response passes; it was not run automatically. If a genuinely different provider is returned, the request should continue failing.

Files added: `lib/generation/identity.ts`, `lib/research/provider-registry.ts`, `tests/provider-identity.test.ts`, this report. Modified: generation preparation/types/prompt/validator, shared typed error-code list, research registry import, the research-ID regression case, and README. Frontend and static guide JSON are unchanged.
