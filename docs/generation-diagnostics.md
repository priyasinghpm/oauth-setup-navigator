# Server-side generation diagnostics — 2026-11-04

## What changed

Every API request receives a server-generated UUID in the JSON `requestId` field and `X-Request-ID` response header. Incoming request IDs are ignored. The existing error code, message, next action, status and no-store behavior are preserved; detailed diagnostics are never added to the public response.

The schema parser, evidence resolver and generated-guide rule validator now throw `GuideValidationError` with a stable code and stage at the actual failure site. No arbitrary exception-message parsing is used. Existing error text remains available internally for CLI compatibility, but the API never logs it. Existing schema, exact-evidence, collection, uncertainty and not-tested requirements are retained.

When generation returns `invalid-guide`, the generator supplies sanitized metadata and the API emits one JSON event with prefix `[oauth-guide-validation]` to **server stderr**. Using stderr directly avoids client-facing development console replay. Logging failures do not alter the safe API response or trigger a retry.

## Available fields

| Field | Meaning |
| --- | --- |
| `event` | Fixed `oauth-guide-validation-failed` |
| `requestId`, `timestamp` | Server-generated UUID and UTC timestamp |
| `stage` | `evidence-resolution`, `guide-schema`, `guide-rules`, `final-guide-schema`; unexpected untyped errors use `guide-validation` |
| `code` | Stable allowlisted rule ID; untyped/unrecognized failures use `validation-unclassified` |
| `fieldPath` | Optional path containing only known schema property names and bounded numeric indexes; arbitrary model field names/slug values are omitted |
| `evidenceId` | Optional strictly formatted `evidence-` plus 24 lowercase hex characters; arbitrary identifiers are omitted |
| `sourceCount`, `excerptCount` | Counts in the prepared research input sent to generation |
| `selectedEvidenceCount` | Number of entries in known claim evidence-ID arrays, including duplicate or invalid selections. This is not a validated-support count |
| `reviewEvidenceMissing`, `approvalTimingMissing`, `troubleshootingEvidenceMissing` | Boolean preparation flags, when available |
| `requiredOAuthTestStatus` | Always `not-tested` |
| `declaredOAuthTestStatus` | `not-tested` only if that exact value was returned; otherwise `invalid-or-missing`, without logging the supplied value |

Only these fields can enter the log event. No source URLs, provider names, source excerpts, raw model JSON, HTTP headers, cookies, secrets, unrestricted error messages or stack traces are copied. Paths, stages, codes, IDs and counts are checked again at the API logging boundary. The diagnostics implementation is used by server generation/API code only; frontend behavior is unchanged. The shared typed error definitions contain no request data or logging behavior.

Examples of rule codes:

- `schema-nonempty-array-required`: a required nonempty array was empty or had the wrong type; inspect `fieldPath`.
- `evidence-id-unknown`: a selected ID was unknown or not sent to the model.
- `evidence-exact-text-mismatch`: stored quote/context did not match retained source text.
- `guide-duration-invented`: an unknown approval duration contained a numeric waiting time.
- `guide-collection-limit`: a generated collection exceeded its existing upper bound.

## Inspect the next deliberate test

No Gemini request was made while implementing this change. Historical failures cannot be recovered retroactively, and no live-generation flag was changed.

1. In the next test you deliberately initiate, open browser developer tools → Network → the POST `/api/guides/generate` response.
2. If it fails validation, copy the response `requestId` or `X-Request-ID` header. The public code remains `guide-validation-failed`.
3. In the terminal running Next.js, find the stderr line beginning `[oauth-guide-validation]` with that same UUID. If server stderr is already captured in a file, search that file for the UUID. The event is not guaranteed to be mirrored to `.next/dev/logs/next-development.log`.
4. Read `stage`, `code`, and optional `fieldPath`/`evidenceId` to identify the rejecting rule. Find the code in `lib/validate-guides.ts`, `lib/generation/resolve.ts`, or `lib/generation/validate.ts` if implementation detail is needed.
5. Use the counts and missing-evidence flags to assess coverage. They do not establish correctness or a successful OAuth connection.

For example, the automated empty-approval mock produces `stage: guide-schema`, `code: schema-nonempty-array-required`, and `fieldPath: guide.approval`. This is a test example, **not a diagnosis of the previous live HubSpot failure**.

No log storage, raw-response artifact retention, new endpoint, frontend diagnostic display, automatic retry, billing change, or architecture redesign was added. These events identify the rejected rule; they deliberately cannot reconstruct a discarded model response. Unexpected untyped failures remain classified rather than exposing exception content.

## Verification and files

- `npm test`: **72/72 passed**, including eight new diagnostics tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; the homepage, API and all three static guide routes build.
- Mock tests cover schema/evidence/uncertainty classification, source-text tampering, counts, unknown exceptions, malicious metadata, matching unique request IDs, server-only stderr output, unchanged public errors, and logger failure. All previous strict validation tests still pass.
- No Gemini calls, live request retries, server restarts, live-generation activation, static-guide changes or billing changes were performed.

Added: `lib/validation-errors.ts`, `lib/generation/diagnostics.ts`, `tests/generation-diagnostics.test.ts`, this report. Modified: schema parser, generation resolver/validator/result types/runner, API handler, API regression test, and README. The frontend was not modified.
