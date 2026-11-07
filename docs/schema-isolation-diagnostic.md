# Production schema isolation — 2026-11-06

## Sanitized provider timing

`observeProviderCall` records one `[oauth-guide-generation]` event with event type `oauth-guide-provider-call` for a resolved or failed SDK call. The normal API propagates its existing request ID. Standalone callers receive a generated UUID. Fields are request ID, wall-clock start/end timestamps, monotonic durationMs, configuredTimeoutMs, applicationSignalAborted, outcome/stage/category and available provider HTTP status/code. HTTP status is observed through the SDK-supported fetch hook without reading headers or bodies. A response-received/success event means the SDK returned, not that the guide passed validation.

The original response/error is preserved. A broken log sink cannot change the outcome or cause retry. API error responses stay unchanged. Existing API-level failure events remain and can be correlated by request ID. Logging is server stderr; it is not automatically a durable file. No secrets, prompts, response text, source excerpts, error messages or stacks are logged.

Timeout remains 60,000 ms in the SDK and application abort signal. SDK attempts remain one and automatic continuation remains disabled. The model, API version, generation schema, research, storage and UI are unchanged.

## Exactly one authorized request

Request ID: `321a7a13-8859-45f4-8543-7cd02ae54142`.

- Model `gemini-3.5-flash-lite`; SDK 2.32.0; default API v1beta.
- Production schema: 6,431 bytes, SHA-256 `01ab391bb5451c35c8ab201e39a3bf720730c9ef223599ae97826741e1935cd9`.
- Exactly one guarded generateContent request; no retries, grounding, fallback, research or guide storage.
- A minimal synthetic prompt requested a schema-conforming draft with unknown requirements; it supplied no provider research or official facts.
- Actual HTTP 200; no provider error code; duration 3,575 ms; configured timeout 60,000 ms; applicationSignalAborted false.
- Valid JSON, conforming to the unchanged production response schema; finish reason STOP; not truncated.
- SDK usage: 106 prompt tokens, 1,086 candidate tokens, 1,192 total. No thoughts-token count was reported.
- The response body/guide was not saved. Only sanitized metadata was retained at `/tmp/gemini-production-schema-isolation-result.json`.

The diagnostic checker implements every keyword present in the production schema and rejects unsupported keywords. It is script-only; it does not replace OAuthGuide/evidence/uncertainty validation. No evidence validity or real OAuth completeness is claimed for the synthetic response.

142 offline tests, TypeScript and production build pass. Tests cover actual schema hash/conformance, missing fields, types, enums, additional fields, safe logs/redaction, monotonic timing, upstream 503 versus application abort, request ID propagation, logging failure and no retry.

Schema compatibility is established for this invocation, not guaranteed for every workload. The optimized full guide request still adds system instructions, selected research evidence, context windows, evidence selection and backend semantic checks. Earlier 503s remain unexplained. The next separately authorized diagnostic can be one full optimized request with these timing events captured; repeating the same schema-only test or changing timeout/model is not justified by this result.

The explicit test command is `node --import tsx scripts/diagnose-production-schema.ts --live --free-tier-confirmed --output <metadata-file>`. Without both opt-in flags it makes no request. Do not rerun automatically.
