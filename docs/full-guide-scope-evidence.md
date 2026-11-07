# Full-guide scope evidence handling

The cached Pipedrive full-guide test (`39a9c792-1a29-4091-a639-c0695d058481`)
received HTTP 200 and valid JSON, then correctly failed with
`schema-documented-source-required` at `guide.scopes[0].evidence`.
The rejected response was not saved as a guide. No historical output was repaired.

The prompt now makes the scope contract explicit: named scope identifiers and their
purposes need directly relevant quotations and nonempty selected evidence IDs. Generic
mentions of scopes do not establish names. If names cannot be established, use one
nonempty gap entry named `Not established`, unknown status, empty IDs and an explanation.
Never estimate a scope or make up common names such as read/write. This is guidance
to the model, not a guarantee it will comply.

The runtime generated-guide validator now also rejects estimated scopes, unknown
entries using actual scope names, and documented entries using the gap placeholder.
The existing parser rejection for documented claims without sources, exact quotation
resolution, scope literal checks, invalid-ID rejection and nonempty scopes requirement
are unchanged. No invalid entry is converted to unknown automatically.

The production response JSON schema is unchanged (6,431 bytes); no repeated evidence
enums or conditional schema branches were added. The static guide parser, static guide
content, frontend and storage are unchanged. The staged proof of concept is separate.
Semantic relevance and whether prose contains unsupported interpretations still need
human review; these checks do not establish provider approval or OAuth testing.

Offline regressions are in `tests/generation-scopes.test.ts`: supported named scopes,
nonempty unknown gaps, exact previously failing rule, fabricated scope names, invalid
IDs, unsupported citations, estimates and mislabeled placeholders. All 180 tests,
TypeScript and production build passed. No Gemini or research requests were made.

Run offline:

```sh
node --import tsx --test tests/generation-scopes.test.ts
npm test
npm run typecheck
npm run build
```

A later live test requires separate authorization. Passing the scope rule will not
prove the remaining full guide is complete or correctly interpreted.
