# Step 4D — frontend generation (2026-11-03)

## Use

The homepage retains its three-provider directory and search. Below the directory is **Generate an OAuth setup guide**. Enter a provider name and/or an official HTTPS developer documentation URL. A specific OAuth documentation URL is the most reliable discovery input. Do not submit credentials or token-bearing URLs.

For a matching static provider name, the form offers its existing guide link instead of a generation request. An empty directory search also links to the form. Static search, provider filtering, reset, static slugs and unknown-provider 404 handling remain unchanged.

**Generate Guide** sends one POST to `/api/guides/generate`. Inputs and the submit button are disabled while waiting. The waiting message describes research/generation as running without invented progress percentages or claims of completed stages. There is no automatic retry. Leaving the page aborts the client request; it does not guarantee cancellation of work already started on the server.

A successful response renders the validated guide in the shared guide presentation component. The result says **AI-generated — Not end-to-end tested**, includes its research date, labels unknown approval requirements, and explicitly says it has not undergone human review. Instructions/summaries are AI explanations. Separate official-quotation panels preserve exact strings and link directly to their sources. Expand **Surrounding source context** for the stored heading, preceding/following text, offsets and clipping disclosure. Source-registry links and the temporary prerequisites checklist work as in the static guides. Exact quotations establish provenance, not interpretation correctness.

Generated content lives only in component state. Dismiss, reload or leaving the page removes it; it is not added to search, a static route, localStorage or a database. No audited HubSpot artifact is imported as a fallback.

Errors retain inputs and display a locally selected safe message for known API codes, including disabled configuration, missing official website, unavailable/insufficient documentation, quota/rate limits, timeouts and invalid guide/evidence. Raw error messages, stack traces and provider diagnostics are not displayed. Malformed success responses are also rejected using the existing guide parser before rendering. This client schema check is additional shape checking; the backend remains responsible for research provenance and exact-evidence validation.

## Mocked tests — no Gemini or research network calls

```sh
node --import tsx --test tests/generated-frontend.test.ts tests/generate-api.test.ts
npm test
npm run typecheck
npm run build
```

Frontend tests use JSDOM, Testing Library and synthetic research/model fixtures. The success/loading tests forward the component's fetch to the actual API handler with mocked research and model transport, exercising actual preparation, evidence resolution and validation. Other tests return structured error/malformed responses or simulate transport failures. Tests cover static provider links, shared static guide rendering, case-insensitive combined directory filtering/reset, keyboard website-only submission, focus, exact quotations/context, and removal of temporary state. No remotely selectable mock mode or production fallback was added.

## Default disabled browser check

Start or restart the app with generation explicitly off (stop an existing dev server first if it holds the Next.js dev lock):

```sh
GUIDE_GENERATION_ENABLED=false npm run dev -- --port 3108
```

Open `http://127.0.0.1:3108`. Search for Slack, reset, open each static guide and return home. Submit HubSpot in the generation form: expect the clear disabled-generation error, with no Gemini or research request. Confirm the form remains usable after the error. Inspect a narrow mobile viewport and keyboard navigation. The exact listening URL may differ if the port is occupied; use Next.js's startup output.

## Explicit opt-in for one real free-tier test

This was **not executed** during Step 4D. Confirm in AI Studio that the existing key's project still has billing disabled and free-tier quota. The SDK cannot enforce billing status. Stop the current dev server, then deliberately enable the existing server flag for that process only:

```sh
GUIDE_GENERATION_ENABLED=true npm run dev -- --port 3108
```

Open `http://127.0.0.1:3108`, enter HubSpot and a specific official OAuth documentation URL, and press **Generate Guide once**. For example:

```text
https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview
```

The server uses the fixed `gemini-3.5-flash-lite` model, without grounding, automatic retries, continuation or paid fallback. Discovery can fail or find incomplete evidence, in which case Gemini is skipped. If generation does occur, validation may still reject it. Do not submit again automatically after failure. After the test, stop the server and restart with `GUIDE_GENERATION_ENABLED=false`. Do not put any key into frontend fields or NEXT_PUBLIC environment variables. `.env.local` and billing configuration were not modified.

## Validation, changed files and limitations

- 61 automated tests pass, including six new frontend integration cases.
- TypeScript and production build pass. The homepage, dynamic API endpoint, and all three existing static guide routes build successfully.
- Real Gemini calls: **0**. Live generation remains disabled by default; no flag was enabled.
- Browser automation tooling was unavailable. JSDOM interaction tests ran, but actual browser/mobile layout, overflow, rendered focus styling and end-to-end navigation were not visually checked. Use the browser checklist above; test source details and anchor navigation with a mocked success response via the automated test suite.

Files added: `components/generated-guide-request.tsx`, `components/guide-presentation.tsx`, `lib/generated-guide-client.ts`, `tests/generated-frontend.test.ts`, `tests/helpers/dom.ts`, and this report. Files modified: homepage, provider directory, static route wrapper (layout extracted without changing static guide data), claim evidence renderer, global styles, package/lockfile for DOM test dependencies, and README.

The API's in-memory quotas and lack of public authentication remain local-development limitations. Research can miss pages or retrieve only truncated text. The generator can produce unsupported interpretations even with exact source quotations; human content review and developer-run OAuth tests remain necessary. No persistence, deployment, new backend generation architecture, paid API, or additional feature phase was added.
