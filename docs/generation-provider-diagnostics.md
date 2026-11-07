# Provider failure investigation and diagnostics — 2026-11-04

## Investigated request

Request ID: `3bda861c-966e-4199-8684-2126a0c3f2ce`; reported application HTTP status: 502; public code: `generation-failed`.

No matching retained log or saved result was found for that request. The application code maps the generator's `provider-error` to this public error. That generator outcome can mean a thrown SDK/provider exception, an unexpected returned model, or a non-STOP blocked/incomplete reply. These occur before JSON/evidence validation. The application HTTP 502 does **not** establish the upstream provider HTTP status.

Before this change, the API logged only `invalid-guide`; it discarded provider-failure metadata. That is the confirmed observability defect. The exact historical upstream cause cannot be reconstructed. No Gemini request was made to investigate or retry it.

## Schema compatibility findings

- Installed `@google/genai` types explicitly support `responseJsonSchema`, paired with `responseMimeType: application/json`, including string enums and array items. The application uses that configuration and does not simultaneously set `responseSchema`.
- The [official model capability page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) lists structured outputs for the configured model. The [official structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output) supports string enums, but warns that large/deep schemas and branching can exceed the grammar compiler's limits, returning HTTP 400.
- Therefore the enum feature is supported in principle; that does not prove that this complete nested, repeated-enum schema fits the model's current service limits. Schema complexity is a plausible explanation, not a demonstrated root cause. No numerical rejection threshold is assumed.
- There is no retained HTTP status or provider category for the failed request. Authentication, availability, a local SDK error, a response finish reason or another request error cannot be ruled out. Strict model-version equality is also one existing rejection branch; no returned model value was retained for this request.

The evidence-ID enum schema, local evidence resolver and strict validators are unchanged. No speculative schema relaxation, fallback model or API migration was performed.

## New server-only events

Existing validation events remain `[oauth-guide-validation]`. Provider/generation failures now emit `[oauth-guide-generation]` followed by one JSON event to server stderr.

Fields are allowlisted:

- Server-generated `requestId`, UTC `timestamp`, fixed event `oauth-guide-generation-failed`.
- `httpStatus`: the application's HTTP response status, kept separate from `providerHttpStatus`, which is included only when the error exposes a valid numeric HTTP status.
- `stage`: `request-preparation`, `generation-admission`, `provider-request`, `provider-response`, or `response-json`.
- `category`: a fixed classification such as `invalid-request`, `authentication`, `permission`, `not-found`, `rate-limit`, `timeout`, `upstream-error`, `transport-or-sdk`, `unexpected-model`, `incomplete-response`, or `invalid-json`.
- Optional `providerCode`: a canonical allowlisted status such as `INVALID_ARGUMENT`. The installed SDK exposes HTTP status directly; its message may be a JSON error envelope. Only that envelope's canonical status is selected; no free-text message is copied. Non-JSON text is not searched for guessed causes.
- Optional allowlisted `finishReason`, e.g. `MAX_TOKENS` or `SAFETY`.
- When available, bounded `sourceCount`, `excerptCount`, `schemaBytes`, and `evidenceEnumEntries`. The last counts enum alternatives across all evidence-selector schema occurrences; it is not the number of unique research excerpts or an estimated grammar-state count.

Raw errors/messages/stacks, sanitized-but-free-text SDK diagnostics, prompts, raw model output, schema contents, excerpts, headers, cookies and credentials are excluded. The API re-sanitizes metadata before logging. Detailed metadata is not returned to the browser. The existing safe response and request-ID contract remain unchanged. A failed logger cannot trigger a retry or change the returned error.

Request construction now has its own classified failure boundary before the attempted-call counter advances. Construction errors are not reported as a completed transport attempt. No automatic retries or additional requests were introduced.

## Inspect a future deliberate test

No test is automatically initiated by these changes. For the next test you explicitly choose to run, copy the response `requestId` from browser Network tools and find the same UUID in the terminal running Next.js, under `[oauth-guide-generation]` or `[oauth-guide-validation]`. Existing server stderr capture can also be searched; Next.js's development log file is not guaranteed to retain direct stderr events.

A future `provider-request` / `invalid-request` / provider HTTP 400 event establishes request rejection, but does not by itself prove enum complexity. A `provider-response` / `incomplete-response` event instead identifies response completion/safety handling; it is not a schema/evidence validation failure. An `unexpected-model` event identifies the existing strict returned-model check. If the schema is rejected, keep the constraints and no-retry behavior while deciding on a separately reviewed minimal change based on the new evidence.

Verification of service acceptance still requires a future explicitly authorized live request; offline tests cannot prove the provider will accept this exact schema. No further service test was run here, and no server was restarted.

## Files and verification

Added: `lib/generation/provider-diagnostics.ts`, `tests/provider-diagnostics.test.ts`, this report. Modified: Gemini SDK error adapter, generation runner/result types, API handler and README. No frontend, static-guide, schema, evidence validation, credentials or billing changes.

- `npm test`: **84/84 passed**, including seven new provider diagnostic tests and all previous evidence/schema/uncertainty regressions.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Tests mock transport exceptions and replies. They cover HTTP categories, canonical API codes, metadata allowlisting, incomplete/unexpected responses, JSON failures, gateway versus upstream status, request-ID correlation, safe unchanged public errors, stderr output, and logger failure without retries.
- Gemini calls: **0**. No grounding, paid API, live-generation activation or billing changes.
