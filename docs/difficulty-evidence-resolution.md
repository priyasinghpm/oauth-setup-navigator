# Difficulty evidence selections — 2026-11-04

## Diagnosis

The supplied diagnostic (`evidence-resolution` / `evidence-id-unknown` / `difficulty`, 5 sources, 39 excerpts, 13 selection entries) is raised only when a difficulty-selected ID is absent from the prepared evidence map. It is not a schema-level objection to difficulty having citations.

Tracing the implementation:

1. Research creates stable evidence IDs from the source URL, offsets, exact text and context before generation.
2. Preparation checks cached research against that registry and selects bounded excerpts. It preserves their IDs; omitted excerpts are not eligible evidence for this request.
3. The prompt serializes exactly those prepared excerpts and IDs.
4. The resolver builds its lookup from the same prepared excerpts. It uses the same lookup for difficulty, estimated effort, setup instructions and every other evidence object. There is no special ID-renaming or filtering branch for difficulty.
5. Difficulty must remain `estimated` under the existing guide schema. A valid evidence basis derives source references, while exact quotation support is populated for `documented` claims such as setup steps. An editorial rating is not presented as an official quotation. The general schema parser also checks source references in difficulty and effort, even though the generated-claim loop focuses on factual sections.

No backend loss of a valid difficulty ID was found, and regression tests demonstrate valid difficulty references resolving correctly. The selected ID in the reported request was invalid **relative to that request's prepared registry**. Its exact value and that request's source snapshot are not available in saved artifacts, so we cannot distinguish an invented/mistyped ID from a real ID copied from unsent material or independently prove the history of that particular ID.

## Confirmed contract defect and correction

The structured output schema allowed any string in `evidenceIds`. Its `_sourceIds` argument was unused, so the instructions to copy valid IDs were not enforced by the request schema.

The request builder now passes actual prepared **evidence IDs**, and every `evidenceIds.items` has a JSON Schema enum containing exactly those IDs. The enum is built from the same records serialized into the prompt. It includes no source IDs, unsent sources or guessed aliases. No array-count grammar constraints or new schema mechanism were introduced.

The prompt explicitly applies this rule to difficulty and setup estimates as well as documented instructions. A purely editorial assessment may choose `[]`, as already permitted by validation; a selected basis must be an exact allowed evidence ID. This is a generation instruction, not post-processing: invalid model selections are never removed, normalized, repaired, or replaced. The resolver still rejects them even if a mocked model ignores the schema. Existing qualification, unknown-approval, exact-quotation and not-tested checks remain unchanged.

## Tests and limits

- `npm test`: **77/77 pass**.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- Five new tests cover prompt/schema catalog equality for all selectors, valid multi-source difficulty references, invalid/mistyped/source-ID references, real but unsent evidence, optional uncited editorial difficulty, rejection of documented difficulty ratings and invalid estimate references. Existing diagnostics, exact quotation, uncertainty, API, frontend and static-guide regressions still pass.
- No live Gemini calls, provider requests, frontend edits, static-guide edits, generation activation, paid services or billing changes.

Changed files: `lib/generation/schema.ts`, `lib/generation/prompt.ts`, `tests/difficulty-evidence.test.ts`, this report, README. Research ID creation, resolver behavior and validators were not changed.

One future deliberate live test is needed to confirm the current Gemini model accepts and honors the enum-constrained schema. No such test was performed automatically. If the service rejects the schema, stop and inspect its sanitized diagnostic rather than dropping constraints or retrying. Finite selections reduce fabricated-reference risk but do not establish that a chosen excerpt supports the AI's interpretation; existing local validation and human content review remain necessary.
