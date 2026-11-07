# Step 4C — server-side guide generation API

## Endpoint

`POST /api/guides/generate`, Node.js App Router route. No frontend integration or persistence.

Send `Content-Type: application/json` and one or both fields:

```json
{"provider":"HubSpot","website":"https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview"}
```

`provider`: nonblank string, maximum 100 characters. `website`: maximum 1024 characters; HTTPS is required (a hostname without a scheme is normalized to HTTPS). URLs must pass the existing research URL safety checks. Extra fields, client model overrides, seeds, keys, and mock flags are rejected. Maximum body: 2048 bytes; body-read timeout: five seconds.

Name-only discovery uses the existing reviewed-domain registry. If a domain cannot be established, the API asks for an official website instead of guessing. Website-only requests use the registrable domain as the guide name, without inventing a brand identity. A user-supplied URL asserts the provider's official domain; the crawler cannot independently certify that assertion. The existing private-network/DNS/redirect, publisher restrictions and retrieval budgets remain authoritative.

## Responses

Success: HTTP 200, `Cache-Control: no-store`:

```json
{
  "ok": true,
  "status": "generated-draft",
  "reviewStatus": "not-human-reviewed",
  "oauthTestStatus": "not-tested",
  "oauthTestLabel": "Not end-to-end tested",
  "guide": "OAuthGuide object, including claim uncertainty and exact quotations",
  "sources": "source records from the actual research sent to generation",
  "evidence": "resolved claim support excerpts with paths, source IDs, URLs and context",
  "lastResearchedAt": "YYYY-MM-DD",
  "warnings": [],
  "research": {"status":"partial", "requestCount":0, "missingTopics":[]},
  "model": "gemini-3.5-flash-lite"
}
```

The strings describing `guide`, `sources` and `evidence` above are placeholders for their actual object/array values, not literal response values. The unchanged generator prepares bounded research, requests evidence-ID-only structured JSON, resolves backend-owned quotations, and runs the complete existing schema/provenance/uncertainty validators. Only success from that pipeline returns a guide. No fallback to static guides or the audited HubSpot artifact exists.

Every failure returns only:

```json
{"ok":false,"status":"failed","error":{"code":"guide-validation-failed","message":"Generated guidance failed schema or evidence validation and was not returned.","nextAction":"No retry or paid fallback was attempted. Review documentation coverage or server configuration before another deliberate request."}}
```

No partial guide, provider diagnostics, raw exceptions, credentials or internal validation paths are returned.

| HTTP | Codes |
| --- | --- |
| 400 / 408 / 413 / 415 | `invalid-input`, `request-timeout`, `body-too-large`, `unsupported-media-type` |
| 403 | `cross-origin` |
| 422 | `official-website-required` |
| 424 | `documentation-unavailable`, `insufficient-documentation` |
| 429 | `busy`, `request-limit`, `gemini-quota` |
| 503 | `generation-disabled`, `generation-unavailable` |
| 504 | `research-timeout`, `generation-timeout` |
| 502 | `generation-failed`, `invalid-output`, `guide-validation-failed`, `pipeline-failed` |

Next.js handles unsupported methods with HTTP 405.

## Configuration and limits

The server reads `GEMINI_API_KEY` only via the existing server-only generator. Live requests also require `GUIDE_GENERATION_ENABLED=true`. The flag defaults to off and was not enabled in `.env.local`. It is deliberate local-use activation, not an authentication mechanism. It does not verify billing state: keep the already-confirmed free-tier project with billing disabled. The fixed model, no grounding, one attempt, no automatic continuation, no paid fallback and generation limits are unchanged.

The API allows one pipeline at a time, at least 60 seconds between admitted requests, and five admitted attempts per rolling hour per handler/server process. Research failures count toward these bounds. Invalid, disabled or unconfigured requests do not initiate research. Inadequate OAuth research is rejected before Gemini. Requests include no automatic retries. Research has its existing 60-second budget and generation its existing 60-second timeout; the route advertises a 150-second host duration, but hosting platforms may impose smaller limits.

Cross-origin browser requests are rejected; no permissive CORS headers are added. All responses are uncached. There is no new dependency or persistence layer.

## Test without Gemini

Run mocked success and failure cases (no key or network needed):

```sh
node --import tsx --test tests/generate-api.test.ts
```

For an actual HTTP request that cannot call Gemini, start the production build with generation disabled:

```sh
npm run build
GUIDE_GENERATION_ENABLED=false npm run start -- --port 3107
```

Then:

```sh
curl -i -X POST http://127.0.0.1:3107/api/guides/generate \
  -H 'Content-Type: application/json' \
  -d '{"provider":"HubSpot"}'
```

Expected HTTP 503 and `error.code: generation-disabled`; no research or Gemini call. An invalid body returns 400 before the configuration check. There is deliberately no remotely selectable mock or audited-content mode. The successful mocked request exercises the actual preparation, evidence resolver and validator through the same handler factory; only research and model transport are mocked.

## Results and limitations

- 55 tests pass: nine new endpoint tests plus all existing regression tests.
- TypeScript and production build pass. Build includes the dynamic API route and all three original static guides.
- Actual production-server HTTP check at `http://127.0.0.1:3107`: disabled POST returns structured HTTP 503, `no-store`, and no research/generation. Port 3000 belongs to another application; the existing project development server also occupied port 3001.
- Real Gemini requests for Step 4C: **0**. No new official-document retrieval was necessary.
- The pipeline validates provenance and exact excerpts, not semantic correctness. New model output has not undergone editorial/human review, even though the separate HubSpot audit artifact exists. Approval, effort and troubleshooting uncertainty remain visible in individual guide evidence.
- Limits are in memory, shared across local callers, reset on restart and do not coordinate multiple workers/instances. This is a local developer endpoint, not an authenticated public API; cross-origin checks are not authentication. Public hosting would need authorization and shared abuse/quota controls. No deployment was added.
- No new semantic guardrail is claimed: prior audited content-quality issues can recur in new generations. A human content review and developer-run OAuth tests are still needed before relying on a guide.

Files added: `app/api/guides/generate/route.ts`, `lib/api/generate-guide.ts`, `tests/generate-api.test.ts`, `tests/helpers/generation.ts`, this report. Files modified: `tests/generation.test.ts` (reused synthetic fixtures), README. No frontend component, static guide, billing, existing generator or research implementation was changed.

## Local origin correction — 2026-11-04

Next.js can canonicalize `request.url` to localhost even when the browser uses 127.0.0.1. The origin guard now uses the incoming Host for that local alias difference, requiring the same scheme and port. Origin must match that intended host exactly: localhost and 127.0.0.1 are not treated as interchangeable browser origins within one request. Arbitrary Host overrides, forwarded-host/protocol spoofing, foreign/null/malformed origins and cross-site Fetch Metadata remain rejected. Non-browser requests without Origin retain their existing behavior.

The frontend now provides a specific safe `cross-origin` message. All 64 tests, TypeScript and production build pass. Empty-body checks against the existing server confirmed both actual URLs (`http://127.0.0.1:3001` and `http://localhost:3001`) reach input validation (400 `invalid-input`), while a foreign origin receives 403 `cross-origin`. No valid generation input was submitted, no research or Gemini calls were made, and no server was restarted or generation flag changed.
