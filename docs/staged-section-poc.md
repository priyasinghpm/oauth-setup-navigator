# Offline authorization/token-exchange proof of concept

This is a separate diagnostic, not a replacement generator, API route, complete guide,
storage fixture or aggregation system. No SDK transport or automatic continuation is
included. It cannot call Gemini. A separately authorized test can pass its ModelRequest
through the existing transport with the existing model/settings.

## Response contract

```json
{"section":{"steps":[{"title":"...","description":"...","expectedOutcome":"...","evidence":{"status":"documented","evidenceIds":["e3"],"qualification":"Applicability and limitations"}}],"gaps":[{"text":"Information not established from selected excerpts","evidence":{"status":"unknown","evidenceIds":[],"qualification":"What is missing"}}]}}
```

The 1,114-byte schema uses objects, required properties, strings, arrays and single-value
status enums; no repeated evidence-ID enum. Local validation enforces 1–4 documented
steps, at most six unknown gaps, nonblank bounded text, nonempty supporting citations,
and the original strict evidence registry. Unknown gaps cannot cite unrelated material;
estimates cannot substitute for documented instructions. IDs alone come from the model.
Backend code inserts exact original quotations, contexts, headings, canonical IDs,
source URLs/dates, research date, and not-tested/not-human-reviewed flags.

## Retained Pipedrive evidence

Input: `/tmp/pipedrive-pattern-research.json`, researched 2026-11-05.
The measurement script names six existing canonical IDs explicitly; it does not extract
new quotations or fetch documentation. `prepareSection` reuses full preparation's
source ownership/delegation checks and validates original stored evidence. Compact
references already in the full manifest are retained; additional selected *existing*
canonical excerpts receive explicit compact registry entries. Unknown IDs fail.

Sources:
- https://developers.pipedrive.com/docs/api/v1/Oauth
- https://pipedrive.readme.io/docs/marketplace-oauth-authorization

Selected material covers the outside-Marketplace authorization qualification, callback
matching/denial, a complete authorization URL example, token POST endpoint, HTTP Basic
client authentication, and authorization-code request parameters. Public example
identifiers remain examples, never developer configuration values. Context is retained,
including surrounding qualifications. Scope names, credential retrieval, response/error
handling, registration, renewal and approval are not established by this focused bundle.
Topic-keyword hits in metrics are not claims of lifecycle completeness.

## Reproduce offline

```sh
node --import tsx scripts/measure-staged-section.ts /tmp/pipedrive-pattern-research.json
node --import tsx --test tests/staged-section.test.ts
npm test
npm run typecheck
npm run build
```

The temporary snapshot must still exist. No key, research request, SDK call or saved
guide is needed. Measurement prints metadata/hashes only, not quotation text or prompts.
REST-body estimate: **10,972 bytes**, **2,603 rough input tokens** (characters / 4,
not a model tokenizer measurement), 1,283 instruction bytes, 8,028 content bytes,
1,114 schema bytes, 1,758 quotation characters; six excerpts/two sources. This uses
the existing 8,192 output-token ceiling for comparable accounting. No usage was billed.

## Validation boundaries

Existing resolver and instruction checks run unchanged: exact source mappings, original
text/context, clipped/incomplete blocks, quoted commands/endpoints/scope/configuration
literals, and topic checks. A type-only narrowing of the existing validator input allows
passing just its three consumed collections; no dummy complete guide is fabricated.
The POC additionally checks title literals and explicit HTTP-method/URL pairs.
Tests reject invalid IDs, altered context/mapping, clipping, unsupported commands,
endpoints/scopes, changed grant values and a GET-versus-POST contradiction.

These are necessary checks, not semantic entailment. Negation, omitted qualifications,
subtle contradictory prose, misleading outcomes or an incomplete unknown-gaps list may
still pass and require human review. No claim of official verification or successful
OAuth execution is made. No Gemini response has been produced or validated in this task.
The prepared request is ready for one separately authorized focused live diagnostic;
provider availability and model schema acceptance remain untested for this small schema.

## Follow-up: completeness and direct-support checks

After the single successful staged live diagnostic (request
`2d69a462-9193-4ceb-92bc-6a96085f59c0`), its unmodified steps and resolved evidence
were retained in `tests/fixtures/pipedrive-staged-historical.json`. This is historical
model output, not a synthetic success, complete guide or approved instructions.

The revised POC requires six named topics: authorization request, callback, token
request, client authentication, request encoding and token response. A topic needs
necessary actionable details in the explanation **and** selected direct quotations,
or an explicit unknown gap keyed to that topic. Duplicate gaps and gaps contradicting
detected coverage fail. Missing coverage cannot be hidden by an empty gaps array.
Unknown gaps disclose limitations of the section, not proof the provider lacks rules.
Plain-text encoding/configuration literals are checked as well as backtick literals.

The historical response now fails the stronger direct-support/completeness criteria:
its explanations omit the authorization endpoint/client ID, callback registration
matching, token endpoint/grant value, and direct token-response evidence. The encoding
claim occurs in surrounding context only. Existing source records are not repaired,
expanded, relabeled or silently substituted to make that response pass.

Revised offline request: 11,804 estimated REST-body bytes; 1,268 schema bytes;
approximately 2,811 input tokens (characters / 4). Six excerpts, two sources and the
original evidence manifest hash remain unchanged. This supersedes the earlier request
size/schema contract. Temporary live scripts with old size assertions must not be reused
unchanged. No new Gemini/research calls were made for this follow-up.

These lexical checks are conservative necessary conditions, not semantic entailment.
They cannot reliably catch negation, prove a qualification is sufficient, or establish
that an unknown gap is honest. Human review is still required. The full-guide production
schema, generation route, UI, storage and static guides remain untouched.

## Follow-up: URL punctuation and historical failure regression

Fixed the isolated HTTP-method check to compare normalized method/URL pairs rather
than substring matches including sentence punctuation. Trailing sentence periods,
commas and semicolons are ignored on both sides; changed methods, endpoints and query
values remain rejected. Ambiguous punctuation that is intentionally part of a URL
remains a limitation of prose extraction; this is not a general URL equivalence test.

Added narrow checks for authorization sample URLs containing concrete client_id values
(requires example/sample labeling and replacement guidance), and for natural-language
“access and refresh tokens” claims (requires both types in direct quotations).
These are lexical guardrails, not proof of semantic relevance or replacement correctness.
Other paraphrases and negation still require human review.

The exact second live output, request `1ac19304-5d4b-4d06-abf9-c8f760c66348`, is retained
unchanged in `tests/fixtures/pipedrive-staged-tightened-historical.json`. Tests use the
original manifest aliases and already-retained quotations. The authorization URL now
passes the punctuation check, but the unlabeled sample values, context-only encoding
claim and unsupported access/refresh outcome remain rejected independently. Historical
output and evidence have not been silently repaired or accepted as complete guidance.

Updated prompt makes those constraints explicit. Current request estimate: **12,245
bytes**, **1,268-byte schema**, **2,921 approximate input tokens**; same six excerpts,
two sources, exact quotations and canonical IDs. Prior temporary live scripts have stale
size assertions and must not be rerun unchanged. This follow-up made zero Gemini or
research calls. All 160 tests, TypeScript and production build passed. Full-guide
production generation, static guides, UI and storage remain unchanged.

## Direct encoding evidence added to the staged input

The retained research already contains a complete token-exchange paragraph:
`evidence-f9dc355fdfc1eab4c1d2eae3`, from
https://pipedrive.readme.io/docs/marketplace-oauth-authorization under
“Step 4 and Step 5: Getting the tokens”. Its exact quotation is:

> The content-type for the request must be `application/x-www-form-urlencoded`.

The measurement script now selects this seventh excerpt. `prepareSection` validates
it against the original cached page via `checkedEvidence`, retains canonical IDs and
context, and includes it in the request-local registry. Compact aliases are scoped
to each prepared request; historical output must use its original registry, never
be reinterpreted using a new bundle's aliases.

No historical response or citations were changed. An offline regression explicitly
shows that the Basic-auth quotation alone fails the encoding literal check, while
a deliberately constructed selection including the genuine encoding paragraph
supports that literal. This is not a claim the original model selected it or that
the complete historical response passes validation. The exact excerpt and provenance
are retained in `tests/fixtures/pipedrive-token-encoding-evidence.json`.

Current measured estimate: **12,445 bytes**, **1,268-byte schema**, **2,967 rough input
tokens**, seven excerpts from two sources. No network requests or Gemini calls occurred.
Production discovery, generator, UI, static guides and storage were not changed.

The new direct-encoding regression also exposed a narrow MIME literal parsing bug:
a sentence-ending period was included in the media type. The staged-only check now
strips trailing periods, with a regression preserving rejection of application/json
when only application/x-www-form-urlencoded is supported. This does not accept
context-only evidence or alter the production full-guide validator.

## Per-step citation selection and complete offline audit

The staged prompt now receives a backend-derived `directLiteralIndex`: compact evidence
ID plus exact URLs, durations and configuration/media-type literals occurring in that
record's **direct quote only**. Context-only facts never enter the index. These hints
help citation selection; they do not prove semantic relevance. The instructions now
explicitly require support in each individual step for its title, description and
expected outcome, omission of optional unsupported details, and a token-response gap
where direct evidence is absent. Exact source quotations remain backend-owned.

`auditSection` reuses the same parser, resolver and per-step checks as `validateSection`
but reports bounded error codes/paths for all steps and missing coverage without
repairing output or accepting partial guidance. The strict validator still rejects
on failure and preserves the actual step index in typed errors. Neither path retries.

Two conservative-check defects were corrected: replacement guidance accepts “replaced”
and “replacing” as well as “replace”; a method + bare endpoint can be supported by the
same origin/path in a directly quoted query example. Different methods, paths and
nonempty query values remain rejected. This validates an endpoint's identity, not the
completeness of its parameters. Coverage checks and human review remain necessary.

The unchanged rejected live response and its original seven-excerpt prepared registry
are retained together in `tests/fixtures/pipedrive-seven-section-audit.json` (request
`c6a7cd21-3b9d-41f3-9931-2c37829fe152`). It contains public cached documentation,
not credentials or a successful/approved guide. Offline audit still finds:
- `guide-evidence-literal-missing`, `steps.1` (callback example URL/expiry unsupported
  by that step's direct quotation).
- `section-direct-literal-missing`, `steps.1` (literal parameter label is only context).
- `section-coverage-missing`, `token-response` (missing explicit gap).

No historical text, selected ID or supporting quotation has been changed to force a pass.
Reproduce without keys or network:

```sh
node --import tsx scripts/audit-staged-section.ts /tmp/pipedrive-pattern-research.json /tmp/staged-section-seven-live-output.json
npm test
npm run typecheck
npm run build
```

The script requires that exact seven-excerpt response/registry pair; compact aliases
must never be applied to output from another preparation. The retained test fixture
allows regression tests without depending on `/tmp`. Selection IDs now live in the
shared diagnostic-only `scripts/helpers/pipedrive-section-evidence.ts` module.

Current request estimate: 14,088 bytes, 1,268-byte unchanged response schema, about 3,360
input tokens (characters / 4). Evidence manifest remains unchanged. The small extra
input is an explicit trade-off for per-record literal hints. These changes cannot
force correct model reasoning or establish semantic verification. They improve selection
and rejection diagnostics; a future separately authorized live test is still needed.

## Required structured callback matching

The staged response now requires `section.callbackMatching`:

```json
{"rule":"must-match-registered","text":"The callback URL must match the registered URL.","evidence":{"status":"documented","evidenceIds":["e21"],"qualification":"The selected direct quotation establishes registration matching."}}
```

The example above illustrates the contract only. It is not a modified historical
response or claim of a completed OAuth flow. `rule` may instead be `unknown`, with
unknown status, no citations, and an explanation of the missing evidence. The resolver
attaches backend-owned exact quotations using the same strict registry as steps.

Matching is validated independently from callback delivery prose: documented rule,
nonempty source support, explicit matching/registration instruction, and matching
language in a directly selected quotation. Obvious negated rules are rejected.
Unknown is rejected when the prepared direct evidence explicitly establishes matching.
Callback coverage now comes from this field; an unknown field itself discloses that gap.
Other coverage and all step evidence checks remain in effect. Lexical checks still do
not prove semantic entailment; human review remains required.

Historical responses missing this field correctly fail the new schema. They remain
unchanged. Some offline tests explicitly construct a new-schema draft around historical
steps, with a clearly labeled test claim and the original callback evidence, to continue
exercising downstream failures; those drafts are not live results and are never saved.

Measured request: **15,031 bytes**, **1,774-byte schema**, **3,596 estimated input tokens**;
same two sources/seven excerpts. Temporary live scripts with previous size/schema
assertions must be updated before a separately authorized test. No model, timeout,
retry, production schema, frontend or guide-store changes were made.
