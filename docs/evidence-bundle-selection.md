# Actionable evidence bundle selection (offline)

## Change

Generation preparation now selects related request blocks together before filling
remaining space with the existing lifecycle-oriented selection. A structural group
must belong to one publisher URL and section heading; large intervening gaps split it.
Detected request anchors (HTTP, common curl syntax, or request.post-style examples)
are combined with available authentication, parameters, encoding and structured
response blocks. Initial exchange precedes authorization, renewal and resource usage.
“Initial access and refresh tokens” is treated as initial exchange, not renewal.

Selection uses greedy feature coverage, favoring whole blocks that cover multiple
available features. It never imposes Basic auth, a particular grant, scope, endpoint
or response field on a provider. Those protocol terms are ranking hints only. No
provider names, domains, particular endpoint URLs or canonical evidence IDs are
hardcoded into the selector. Pipedrive-specific canonical IDs occur only in fixtures.

The unchanged cap is 7,200 quote/context/heading characters and 12 excerpts per source,
36,000 total evidence characters, five sources, and existing source/input limits.
Every retained quotation and context is an existing record: no cropping, reconstruction,
ID repair, boundary security changes or new research. Existing checkedEvidence and
provenance/delegation admission run before selection. Response schema and validation
remain unchanged. Incomplete structural bundles produce a selection warning; generic
fallback retains other lifecycle material where space remains.

## Offline results

Pipedrive's initial token-exchange bundle previously selected zero of its four minimal
request blocks. It now retains all four: POST endpoint, encoding sentence, Basic-auth
paragraph and body-parameter table. This stays within the same source budget. Full
input remains three sources and 20 excerpts; estimated request changes from 33,289 to
34,238 bytes. Lifecycle topic signals remain present, but signals do not establish
complete or semantically correct instructions.

The full Pipedrive renewal bundle still does not fit. General renewal evidence in the
other source is retained, but that does not establish every refresh parameter or response
field. Missing details must remain unknown. Initial exchange response-field detail is
also not established by these request blocks. A bundle's `complete` flag means all
structurally detected members were selected, never that the OAuth lifecycle is complete.

HubSpot's retained audit corpus (extraction/selection check, not a fresh retrieval or
new ownership verification) now retains two of two detected initial request/response
blocks in both relevant documents, versus one and zero previously. Two of two refresh
blocks are retained in each, versus zero and one previously. Every source stays within
the same 7,200/12 limits. Platform versions and different provider flows remain distinct.

## Tests and reproducibility

All 189 offline tests, TypeScript and production build pass. Tests include cached
Pipedrive and HubSpot blocks, an alternate synthetic PKCE/provider-field example,
initial-vs-renewal ordering, insufficient budgets, clipped blocks, source/section
separation, deterministic selection and exact-source text preservation.

```sh
node --import tsx scripts/check-cached-evidence-bundles.ts research /tmp/pipedrive-pattern-research.json Pipedrive
node --import tsx scripts/check-cached-evidence-bundles.ts audit-corpus docs/audits/hubspot-source-snapshot.json
npm test
npm run typecheck
npm run build
```

The retained Pipedrive fixture is exact historical research material. The synthetic
PKCE example is test data, not an official provider claim. The acceptance script prints
counts and bundle metadata, not raw prompts or excerpts. It performs no network calls.

No Gemini calls, new research, UI/static-guide/storage changes or billing changes were
made. Historical model outputs must continue using their retained original registries;
new selections may assign different request-local compact aliases. No saved artifacts
have been rewritten to make them pass. Live model citation selection is still untested
with this change, and semantic relevance still requires human review. Formats not
recognized by structural heuristics fall back to ordinary selection; no missing content
is invented. This is bounded selection, not universal documentation understanding.
