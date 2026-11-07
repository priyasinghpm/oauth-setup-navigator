# Separate context navigation from evidence citations

Retained full-guide request `e2d799ae-0371-4586-8181-04b08be7cd3b` confirmed that the
model selected context-window labels (`w1`–`w4`) as evidence IDs. Those labels were
present in the old input representation but never valid citations. No evidence/source
mapping defect was found. The response remains rejected and is retained unchanged
under the Git-ignored `.local/generation-debug/` directory.

`modelEvidence` now emits context windows containing only `startOffset` and `text`.
Each excerpt has a source-local, zero-based `contextWindowIndex` into that source's
window array. Windows no longer expose `id`, and excerpts no longer expose
`contextWindowId`. Only excerpt `id` fields contain selectable `e1`, `e2`, etc.
Production and staged prompts explicitly state that context positions are not citations.

Backend-owned canonical evidence IDs, compact registry mappings, exact quotations,
surrounding context, section headings and source URLs are unchanged. No aliases are
converted or guessed; `w1`, `0`, numeric 0 and context pointers remain invalid selections.
This removes a competing ID namespace, not the possibility of future model errors.
Semantic relevance and complete OAuth coverage still need review.

Offline checks: all 182 tests, TypeScript and production build passed. Reconstructed
full request keeps the same evidence manifest and 6,431-byte response schema. Estimated
body changes from 33,241 to 33,289 bytes (prompt clarification offsets representation
savings). All 20 excerpt references remain; no context blocks were removed or truncated.
Tests verify exact context coverage, no bridging gaps, source-local numeric positions,
unique evidence IDs and strict rejection of window IDs/indices.

No Gemini or research calls were made. Static guides, UI, storage, retry behavior,
model and timeout settings were not changed. Old retained responses and metadata were
not rewritten. A separately authorized live test is needed to assess model compliance
with the new input representation.
