# Structured-output simplification — 2026-11-04

## Findings and measured change

The supplied diagnostic reports provider HTTP 400 / `INVALID_ARGUMENT` before guide generation, with 39 prepared excerpts. Offline measurement exactly reproduced its schema size and count.

The full evidence-ID enum was serialized into **12** claim shapes: difficulty, effort, approval summary, waiting time, prerequisites, steps, scopes, approval entries, blockers, agent responsibilities, developer responsibilities and next actions. Thus 39 × 12 = **468** evidence enum alternatives. Reusing a JavaScript object does not deduplicate its serialized JSON; the schema contained 12 copies. This is unnecessary data-dependent grammar branching. String enums themselves are supported; the diagnostic does not establish a precise provider compiler threshold or prove that enum complexity was its only objection.

| Measurement | Before: 39 excerpts | After |
| --- | ---: | ---: |
| JSON schema bytes | 23,387 | 6,431 |
| Evidence selector shapes | 12 | 12 |
| Evidence-ID enum entries | 468 | 0 |
| Model-facing reference length | 33-character canonical hash IDs | `e1`…`e39` (2–3 characters) |

Schema size is now independent of the number of retrieved excerpts. Small categorical enums for status, difficulty and not-tested status remain. No additional array counting constraints, `$ref` grammar or new wire format for the final guide was introduced.

## Smallest safe simplification

1. Research still owns stable canonical evidence IDs and original excerpts; extraction and hashing are unchanged.
2. Preparation creates one frozen, request-local reference registry before the model request. Each compact ID points to an existing canonical evidence ID and source ID. It stores bindings, not another copy of the source text.
3. The prompt supplies those compact IDs beside the corresponding exact excerpts. It does not expose canonical hashes as selectable IDs. Gemini returns compact selections in the existing `evidenceIds` arrays.
4. The structured schema accepts string selections without a repeated enum. Instructions require exact copying of supplied compact IDs.
5. The resolver validates the retained registry's completeness, unique references, canonical membership and source mappings, then resolves model selections through that registry. It never guesses from positions, normalizes a mistyped value, invents a canonical ID or drops a bad reference.
6. Final quotations keep the original canonical `evidenceId`, source URL/title, exact text, offsets and surrounding context. Compact handles do not alter the final guide schema or frontend contract.

The registry is retained from preparation rather than rebuilt after the model replies. Its bindings still work if the prepared source array's order changes. Handles are local to the current request, not durable citation identifiers; an `e1` in another request may refer to a different canonical excerpt. No cross-request cache or persistence was added.

Unknown handles (`e999`), misspellings (`E1`, `e01`, spaces), source IDs and canonical hashes sent in place of compact selectors are rejected. An incomplete/duplicate/mismatched registry produces typed `evidence-reference-registry` diagnostics. Safe diagnostic IDs now allow compact handles as well as canonical hashes. Existing schema, source mapping, exact quotation, uncertainty, nonempty-section, editorial difficulty and not-tested validation remain enforced.

## Trade-off and next test

Previously, decoder constraints attempted to prevent nonexistent references but created substantial repeated enum branching. Now the smaller decoder schema leaves membership enforcement to the backend. This reduces schema complexity and makes IDs easier to copy, while allowing Gemini to emit a bad string that the backend will reject. It does not guarantee that every generation will succeed, nor that a valid citation supports its interpretation. No invalid guide is accepted as a fallback.

After reviewing this trade-off, one future explicitly authorized live test would be appropriate to verify service acceptance and the compact-reference round trip. No such test was performed here. If it fails, use the existing request ID and server provider/validation diagnostics rather than retrying automatically or relaxing checks. The reported HTTP 400 cannot be retroactively attributed to a specific undocumented complexity limit.

This supersedes the enum-based request constraint described in the earlier difficulty-evidence report. The older reports remain historical records.

## Validation and changed files

- `npm test`: **88/88 pass** (including four additional compact-registry regression tests and updated existing difficulty/reference tests).
- `npm run typecheck`: pass.
- `npm run build`: pass; API, homepage and all static guide routes build.
- Tests cover exact source text and canonical IDs, multi-source/difficulty references, source reordering, invalid references without mutation, source/registry tampering, unknown approval, static/frontend regressions, and catalog-independent schema size.
- Existing provider diagnostics now report `evidenceEnumEntries: 0` and the actual reduced schema size.
- No Gemini calls, live retries, server restarts, generation activation, billing changes, frontend changes or static-guide content changes.

Modified generation files: `schema.ts`, `types.ts`, `prepare.ts`, `prompt.ts`, `resolve.ts`, `diagnostics.ts`; shared validation-code definitions; synthetic test fixtures and generation/difficulty/provider tests. Added `tests/compact-evidence.test.ts`, this report and a README entry. No research extraction or public guide data was changed.
