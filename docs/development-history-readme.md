# Historical development notes

Archived README; historical milestones below are not current setup instructions.
See the root README for the supported user flow.

# OAuth Setup Navigator

Phase 2 of a Composio take-home: a source-backed OAuth registration library for Google Calendar, Slack, and Notion. The existing Next.js App Router, TypeScript, Tailwind CSS, local JSON, directory search, and guide routes are retained.

## Run locally

Use Node.js 22 LTS or a newer compatible release and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js (normally http://127.0.0.1:3000). The handoff server uses **http://127.0.0.1:3001**. Stop your terminal server with Ctrl+C.

```sh
npm test             # Search, research-data integrity, and malformed-input tests
npm run typecheck    # TypeScript validation
npm run build        # Production build and static guide generation
npm start            # Serve the production build locally
```

Dev and build use Next.js’s supported webpack option because Turbopack worker socket creation failed in this execution environment. Dependencies are reproducible through `npm ci` and `package-lock.json`.

The [research and validation report](docs/phase-2-research.md) lists every inspected source, changed file, uncertain claim, and check result.

## Evidence and estimates

Every guide records a last-researched date and an independent `oauthTestStatus: "not-tested"`. **No actual OAuth connection was tested.** Application tests validate the navigator, not provider authorization.

- **Officially documented:** the cited official pages support the claim. This does not mean the app or a developer’s connection has been tested.
- **Estimated / inferred:** editorial difficulty, setup effort, suggested responsibilities, or a recommended procedure; the qualification explains its assumptions.
- **Needs confirmation:** unresolved documentation, account-specific behavior, or an unsupported duration. These are not silently filled in.

Setup ranges cover registration/configuration with existing accounts and permissions. They exclude implementing callbacks, OAuth testing, policy preparation, and external review. Later authorization/test steps describe work developers perform in their own applications; this navigator does not implement those steps.

External waiting time is displayed separately. Google’s sensitive-scope review guidance and Notion’s Marketplace response guidance apply only to those specific reviews and are not launch guarantees. Slack’s review or administrator approval duration remains unknown.

Initial research was performed on **2026-11-01**. Slack and Notion setup instructions were reviewed on **2026-11-03**. Notion’s authorization and public-integration references now use their current canonical URLs; source IDs are preserved. All 18 stored official source URLs were opened during research. Source references are available beside each claim and in each guide’s references section.

## Browser checklist

1. Open the homepage. All three provider cards should show research status, estimated effort, and “Not end-to-end tested.”
2. Search `Slack`, `SLACK`, and `documents`. Select Notion while searching Slack to see the empty state; reset to restore all three cards.
3. Open each card and each direct URL: `/guides/google-calendar`, `/guides/slack`, `/guides/notion`. Confirm all nine sections and the return link.
4. Read the overview: hands-on effort excludes implementation and testing; external waiting is separate. Google’s review time and Notion’s response time should have different labels and citations.
5. Toggle prerequisites with mouse and Space while focused; check the readiness count. Leave the guide and return: progress should reset. Nothing persists to storage.
6. Follow a claim’s source reference to the matching source entry, then open its official external link. Review the research date and evidence qualification.
7. Open `/guides/unknown`: expect the helpful 404 page.
8. Check a 375px mobile viewport and a desktop viewport. Look for wrapped scope URLs, no horizontal scrolling, readable evidence labels, and usable checklist labels.
9. Tab through search, filters, cards, checklist controls, source links, and navigation. Confirm visible focus and the skip-to-content link.

The loading boundary remains available for guide navigation without artificial delays. Browser automation is not available in this session: mobile appearance, interactive reset/checklist behavior, and keyboard focus need manual browser validation. Search behavior is covered by unit tests; HTTP checks cover the rendered routes and anchors.

## Data and extension

- `data/guides.json`: all provider content, structured claims, source IDs, and research dates.
- `lib/types.ts`: the model for future research output. `verificationStatus: "source-backed"` is separate from `oauthTestStatus: "not-tested"`.
- `lib/validate-guides.ts`: parses unknown JSON into typed guides without unchecked assertions. Rejects incomplete content, invalid dates, unsupported statuses, inverted effort ranges, duplicate slugs/source IDs, nonofficial source hosts, undocumented evidence, and unresolved source references.
- `lib/guides.ts`: the local-data boundary; search remains in `lib/search.ts`.
- `components/claim-evidence.tsx`: evidence labels and source-reference links.
- `components/prerequisite-checklist.tsx`: client-only checklist interaction with temporary component state.
- `app/guides/[slug]/page.tsx`: shared guide layout. The existing parent layout continues validating slugs before the loading boundary can stream a response.

To extend a guide, add claims with `evidence.status`, `evidence.sourceIds`, and a qualification for estimates or unknowns. Add each inspected source with a unique ID, canonical official HTTPS URL, title, and inspection date. Documented claims require at least one source; all IDs must resolve within that provider. Read and review cited content: a validator can enforce structure, not factual accuracy. Adding providers on other documentation hosts requires an explicit allowlist update.

## Remaining uncertainties and boundaries

- Difficulty and setup ranges are editorial and unmeasured; actual effort depends on familiarity and existing access.
- Google verification applicability depends on scopes, audience, and exceptions. Workspace policies may impose additional restrictions.
- Slack administrator policies and review turnaround depend on the workspace and distribution path; no duration is invented.
- The November 3 Notion documentation review resolved the earlier review-gate ambiguity: OAuth can start after credentials and the redirect URI are configured, without Marketplace submission or review. Organization-specific policies still need confirmation.
- Current console labels and requirements may change after the research date.

No authentication, live AI generation, database, token exchange, credential collection, or deployment was added. Credentials belong in developers’ own secure backend configurations, never in this repository or navigator.

## Step 4: public documentation retrieval

A bounded server-side research module now accepts an official website or a name in a reviewed domain registry. It retrieves public documentation without calling Gemini or using paid search/scraping APIs. No generator or research UI is enabled. See the [research layer documentation and HubSpot results](docs/documentation-research.md) for usage, source facts, failed URLs, request counts, safeguards, and known gaps.

Run `npm run research:hubspot -- --seeded` to reproduce the targeted live check. Existing Google Calendar, Slack, and Notion guide data is unchanged.

## Step 4B: generation from retrieved evidence

A server-only Gemini transformer now prepares bounded research excerpts, requests structured guide JSON without grounding, and checks the existing guide schema plus exact source provenance and support excerpts. Generation is not connected to the frontend. Mocked tests pass. The initial real HubSpot request returned HTTP 400; a separately authorized revised-schema request then returned valid JSON but failed local validation because its approval array was empty. A subsequent minimal unknown-approval prompt correction passed that nonempty check, but its one live test failed exact supporting-excerpt validation. No generated guide has been accepted. See the [Step 4B implementation and test report](docs/step-4b-generation.md) for the failure, evidence gaps, source mapping, limits, and opt-in live-test command.

## Backend-owned evidence quotations

Research results now retain exact excerpts with stable IDs, source URLs, offsets, and surrounding context. Gemini selects evidence IDs; the backend inserts the original text separately from the AI explanation. The [exact-evidence report](docs/exact-evidence.md) describes the format, limits and tests. All 39 tests, TypeScript and production build pass. The one live test returned valid JSON but invented a source ID, so no generated guide was accepted and no retry was made. Static guides and frontend integration remain unchanged.

## Source-ID consistency correction

Research now owns both source and evidence identifiers. Gemini selects evidence IDs only; backend code derives the final source registry and exact quotations and rejects invalid mappings. All 41 tests, TypeScript checks and the production build pass. One live HubSpot generation passed full structural and evidence validation, while interpretation gaps remain for human review. See the [source-ID diagnosis, changed files, live results and remaining uncertainties](docs/source-id-consistency.md). This supersedes the earlier live-test failure status; no guide was published or frontend integration added.

## HubSpot editorial audit

The saved successful Step 4B result has been audited against its original official source text without new Gemini calls. A corrected, unpublished guide and reproducible source snapshot live under `docs/audits/`, outside the app library. See the [content audit](docs/audits/hubspot-content-audit.md) for corrected setup steps, exact evidence, remaining unknowns and display blockers. This is an editorial audit artifact, not an automatic correction layer for future generation.

## Step 4C: server-side generation endpoint

`POST /api/guides/generate` accepts `{ "provider": "HubSpot", "website": "https://developers.hubspot.com" }` (either field is sufficient). It reuses the research, Gemini, exact-evidence resolution and validation pipeline and returns a not-tested, not-human-reviewed draft only on complete success. No frontend integration or audited-guide fallback is enabled.

Live use is **disabled by default**. The server-side `GUIDE_GENERATION_ENABLED=true` flag explicitly enables it with the existing `GEMINI_API_KEY`; leave billing disabled. No flag or billing configuration was changed for Step 4C. For a no-Gemini success/failure test, run `node --import tsx --test tests/generate-api.test.ts`. For an HTTP disabled-path test, use `GUIDE_GENERATION_ENABLED=false npm run start -- --port 3107` after building, then POST JSON to `http://127.0.0.1:3107/api/guides/generate` and expect HTTP 503 `generation-disabled`.

See [request/response formats, error codes, limits, validation results and limitations](docs/step-4c-api.md). All 55 tests, TypeScript and production build pass; zero live Gemini requests were made. In-memory limits and origin checks are for local development; public deployment would require authorization and shared quota controls.

## Step 4D: temporary generated guides on the homepage

The homepage now has a **Generate an OAuth setup guide** form for a provider name and/or official developer documentation URL. Existing provider names link to the static library. Other requests use the existing API and display an AI-generated, not-tested, not-human-reviewed guide only after validation. Exact official excerpts and expandable context are separate from AI explanations; results live only in page state.

Live generation remains off by default. Test UI/API success and failure paths without calls using `node --import tsx --test tests/generated-frontend.test.ts tests/generate-api.test.ts`. For disabled browser testing, run `GUIDE_GENERATION_ENABLED=false npm run dev -- --port 3108` and open `http://127.0.0.1:3108` (stop any existing project dev server first).

For a deliberate **single** real free-tier test, first confirm billing is still disabled, restart locally with `GUIDE_GENERATION_ENABLED=true npm run dev -- --port 3108`, and submit the form once. Stop afterward and restart with the flag false. No flag was enabled and no Gemini calls were made during implementation. See the [Step 4D guide](docs/step-4d-frontend.md) for exact steps, mocked tests, changed files, browser checklist and limitations.

## Validation diagnostics

Generation API responses now include a server-generated `requestId` and `X-Request-ID` header. On a validation failure, find that UUID in the Next.js server terminal's stderr event prefixed `[oauth-guide-validation]`. It contains the rejecting stage/rule, safe path/evidence ID, counts and uncertainty/not-tested flags; raw output, excerpts, credentials, stack traces and unrestricted exception text are excluded. The frontend error message is unchanged. See [diagnostic fields, next-test instructions and verification](docs/generation-diagnostics.md). All 72 tests, TypeScript and production build pass; no Gemini request or generation activation was performed.

## Difficulty evidence selection correction

The structured output schema now restricts every evidence selection—including editorial difficulty—to the exact prepared excerpt IDs sent in that request. Previously those fields allowed arbitrary strings and the schema's source-ID argument was unused. The resolver still rejects invalid or unsent IDs without repairing or dropping them. All 77 tests, TypeScript and production build pass. No live Gemini request was made; model acceptance of the updated enum schema remains to be checked in a future deliberate test. See the [diagnosis, regression coverage and limitations](docs/difficulty-evidence-resolution.md).

## Generation-provider diagnostics

Provider and pre-validation generation failures now produce a separate server stderr event prefixed `[oauth-guide-generation]`, correlated with the API's existing request ID. It reports an allowlisted stage/category, upstream HTTP status/canonical code where available, finish reason and bounded schema/source counts. It never logs raw responses, prompts, excerpts or free-text errors. The public response stays unchanged. See [the latest failure investigation, schema compatibility findings and diagnostic instructions](docs/generation-provider-diagnostics.md). All 84 tests, TypeScript and production build pass; no Gemini request, server restart, schema relaxation or billing change was performed.

## Smaller structured-output schema and compact references

The repeated evidence-ID enums have been removed: with 39 excerpts, schema size drops from **23,387 to 6,431 bytes** and evidence enum entries from **468 to 0**. Gemini copies compact request-local IDs from a frozen backend registry; strict resolution derives the original canonical IDs and exact quotations. Invalid IDs and invalid mappings still fail closed. This replaces decoder-time ID constraints with backend membership checks; it does not guarantee successful or semantically correct generation. All **88 tests**, TypeScript and production build pass. No live Gemini call or server restart was made. See the [measurements, trade-off, regression coverage and next-test guidance](docs/structured-output-simplification.md).

## Canonical provider names

Generated guides now receive their canonical display name from the backend after identity/source checks. Narrow formatting and OAuth-guide suffix variations are accepted; different/ambiguous identities, mismatched reviewed source domains and explicit foreign-provider setup instructions are rejected rather than relabeled. Slug/date, exact evidence, uncertainty and not-tested rules remain strict. All **95 tests**, TypeScript and production build pass. No Gemini request, server restart or frontend/static-guide change was performed. See the [identity investigation, accepted variations, regression tests and limitations](docs/provider-identity.md).

## Generated guide trust and complete evidence blocks

New research prefers whole paragraphs and complete commands/configuration blocks within the existing research and generation budgets. Generated instructions must select direct support: strict ID/source checks now also reject clipped evidence, detectable unfinished commands, missing exact literals and clear topic mismatches. Generated UI claims say “Cites retrieved documentation · relevance needs review,” provide direct source links, visible exact quotations, dates/context and lifecycle-gap notices, while retaining not-human-reviewed/not-tested warnings. Static guide content and labels are unchanged.

The [saved HubSpot audit, deterministic checks, limits and regression results](docs/generated-guide-trust.md) distinguish direct, context-only and unsupported evidence. All **105 tests**, TypeScript and production build pass. No Gemini or paid API call was made. These checks do not constitute semantic verification; a future deliberate live test and human content review are still needed.

## Persistent generated-guide links (local / persistent-disk Node target)

Successfully validated production generations are now saved atomically under `.local/generated-guides/` (Git-ignored), assigned a UUID and available at `/guides/<UUID>`. The homepage and saved page offer **Copy Share Link**. Refreshing/reopening reads saved data without research or Gemini, and records survive server restarts when the same disk/directory is retained. Sources, exact quotations/context, research date, uncertainties, warnings and not-human-reviewed/not-tested status are preserved.

For a hosted Node app, set `GUIDE_STORAGE_DIR` to an absolute persistent-volume path. Localhost links are not public sharing, and ephemeral/serverless disk is not durable storage; known Vercel/Lambda runtimes fail closed. No cloud database, billing or deployment was added. Read [the storage decision, API details, limits and exact offline/local test instructions](docs/persistent-guides.md).

All **114 tests**, TypeScript and production build pass. No Gemini calls or server restarts were performed. Test persistence with `node --import tsx --test tests/saved-guides.test.ts tests/generated-frontend.test.ts`; mocks use isolated temporary directories and never seed production guides. Existing static guides remain unchanged.

## Research pipeline v2

[Discovery, exact-URL documentation delegation, evidence selection and limits](docs/research-v2.md) describe the bounded research layer. It preserves provider-site link chains, prefers OAuth/developer documentation over repetitive marketing, and selects complete evidence across the bounded document instead of restricting evidence to the first 12,000 characters. Coverage remains heuristic and requires human review. `npm test` includes offline discovery, security and late-section regressions; it does not call Gemini.

The homepage has one **Generate Guide** action backed by the persistent section queue.
Completed sections and the next-step loader appear inline; completed results stay on
the homepage. Refresh reconnects through a remembered job UUID or `?job=<UUID>`, without
starting another request. Permanent `/jobs/<UUID>` pages remain available. A separate `npm run worker:guides` process
runs steps sequentially and automatically advances after each successful checkpoint. Research and accepted sections are reused
across refresh/restarts; failures stop progress and require an explicit retry. The job page updates automatically. Live use remains opt-in.
See [stepwise generation](docs/stepwise-generation.md) for startup, API contracts, limits,
restart behavior, offline tests and limitations. Smaller requests do not guarantee
lower total token usage. The existing single-request flow remains available.

### Model configuration and adapter boundary

Generation uses the shared `ModelTransport` contract (JSON request/schema in,
text and normalized completion metadata out). Both the queued worker and legacy
single-request entry point select their adapter through
`lib/generation/model-runtime.ts`. Research, evidence resolution, validators,
queue checkpoints and the UI do not depend on a provider SDK.

Optional server-only `.env.local` settings (defaults shown):

```dotenv
GUIDE_MODEL_PROVIDER=gemini
GUIDE_MODEL=gemini-3.5-flash-lite
```

Only the Gemini adapter is registered today. Changing to another confirmed
project-accessible, free-tier Gemini model requires editing `GUIDE_MODEL` and
restarting both Next.js and the separate worker. No model is selected or tested
automatically; configuration does not certify free-tier eligibility. Keep billing
disabled and confirm model access/pricing before a deliberate test.

A different provider requires one explicit adapter registered in
`model-runtime.ts`, server-side credential configuration and offline compatibility
tests. It must normalize completion/error metadata, preserve timeout/no-retry
behavior and accept the evidence-ID-only schema. Unknown providers fail closed;
there is no automatic fallback. ChatGPT subscriptions/free access do not establish
free OpenAI API access. No OpenAI API adapter or paid service is enabled here.
Saved section checkpoints record the configured model; existing checkpoints and
all evidence validation remain intact when selecting another model.
