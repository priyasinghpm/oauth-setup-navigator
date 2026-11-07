# Persistent stepwise guide generation

The default stepwise flow is a disk-backed queue that automatically advances between successful
steps. It is not background work attached to a Next.js HTTP response. A separate Node
worker claims jobs and runs one stage at a time, automatically queuing the next after success; a process lock prevents two workers
from running the same queue. The existing single-request endpoint is preserved.

1. Research official documentation and save the research checkpoint.
2. Generate registration/prerequisites/permissions.
3. Generate authorization/token exchange.
4. Generate renewal guidance.
5. Generate distribution/approval/troubleshooting.
6. Assemble, revalidate with the complete existing OAuthGuide validator, and save.

There are at most four model calls in a successful job. Each section has its own
schema and up to two sources/eight whole excerpts (distribution uses six), a 20,000-byte
serialized-request guard, 4,096 output-token ceiling and the existing 60-second timeout.
The model remains gemini-3.5-flash-lite, without grounding, retries or fallback. Smaller
requests reduce per-call workload; they do **not guarantee lower total tokens or cost**.
Repeated prompt overhead and explicit retries can increase total usage.

## Use locally

Live generation stays disabled by default. No flag, billing setting or key was changed
by this implementation. Before a real run, confirm the project is still free tier with
billing disabled; the SDK cannot enforce billing status.

Start Next.js with the flag explicitly enabled in its environment, using your normal
port (the current local instance is http://127.0.0.1:3001). In another terminal, start
only one worker against the same directory/configuration:

```sh
GUIDE_GENERATION_ENABLED=true npm run worker:guides
```

The worker reads only the required configuration names from `.env.local` when they
are not already set in the process. Keys remain server-side. The worker supports
`--once` to process at most one queued step and exit. It does not bypass the quota.
To check disabled startup without requests:

```sh
GUIDE_GENERATION_ENABLED=false npm run worker:guides -- --once
```

On the homepage supply a provider and/or its public official website, then click
**Generate Guide** once. The background job is created through the queue API and its
progress renders directly below the same form. No navigation to a separate page is
required. The `/jobs/<UUID>` page remains available as a permanent progress URL.
Research runs once when the worker claims the queued job. After each success the worker
saves its checkpoint and automatically queues the next stage, including final assembly.
The page polls read-only status every two seconds and displays saved-step counts, the
active stage and completed sections. There are no fabricated percentages or unconfirmed
completed phases. Keep the job URL: refreshing, polling, or reopening only reads saved
state; the worker proceeds independently of the browser. Partial sections show uncertainty,
exact source excerpts, context, research dates and review warnings.

On failure, completed sections remain saved. **Retry failed step** is a deliberate new
attempt and may call the provider again. Successful stages continue automatically; failed stages never retry automatically.
Changing the input or website requires a new job; existing checkpoints are not silently
re-researched or relabeled. A section with insufficient evidence can fail before a call;
retrying unchanged input may not help. The original single-request API remains for compatibility, but its form is no longer
shown on the homepage; the single visible Generate Guide action uses the queue.

## Persistence and restart behavior

Jobs use atomic JSON checkpoints under `.local/generation-jobs/` (override with
`GUIDE_JOB_DIR`). Saved complete guides use the existing `.local/generated-guides/`
(or `GUIDE_STORAGE_DIR`). Both are Git-ignored. No keys, credentials, OAuth connection
tokens, headers, prompts or raw provider envelopes are written to the job store.
Public documentation may contain its own illustrative sample values. Invalid section
output is rejected and is not saved as accepted guidance. Safe failure codes, request
IDs and typed validation diagnostics are retained server-side; API views omit internals.

Restarting the worker restores checkpoints. Any step left running is marked failed
with `worker-interrupted`; its remote outcome is unknown, so only explicit user action
can try it again. Dead-owner locks can be reclaimed; live locks are never stolen.
Malformed locks, an abandoned recovery lock or unreadable quota fail closed: inspect
the owner process and storage before manual intervention; do not blindly delete them.
Only one Node host with the same persistent disk is supported. This is not a distributed
queue and does not make ephemeral serverless files durable.

Finalization uses the job UUID as its saved-guide UUID and performs an idempotent,
exclusive commit. A restart between saving and updating job status cannot overwrite a
genuine guide or create a second saved copy. All four raw section drafts and their exact
selected registries are revalidated before assembly; no model call is used to aggregate.
The original full-guide schema, 4–8 steps, evidence and uncertainty checks remain in force.
Unknown requirements stay unknown rather than becoming guessed instructions.

The worker has its own persistent quota: at least 60 seconds between Gemini attempts,
up to ten per hour. Explicitly queued work waits for that window without calling or
incrementing attempts repeatedly. Provider quota errors fail the stage; they are not
retried. The legacy endpoint's process-local limiter is separate: do not mix both flows
while testing quota. No cancellation or section editing is included. Stop the worker
to prevent new work; a currently running step is allowed to finish before graceful exit.

## API and safeguards

- `POST /api/guides/jobs` accepts `{provider?, website?}` and creates a queued job.
- `GET /api/guides/jobs/<UUID>` returns safe progress and validated partial sections.
- `POST /api/guides/jobs/<UUID>/resume` accepts `{}` and queues the next/failed stage.
- `/jobs/<UUID>` renders the durable job. Invalid/missing IDs return 404.

Mutations use the existing same-origin validation, body limits, public-URL input guards
and generation opt-in. Research retains its existing ownership, SSRF, robots, redirect
and request protections. The store accepts at most 100 job records; this is a local-demo
bound, not a public abuse-prevention system. There is no authentication: job URLs are
unguessable, not access-controlled. Do not expose the live worker/API publicly without
access controls and a shared durable quota. The partial guide is not proof of semantic
correctness or a completed OAuth connection.

## Offline validation

`npm test` uses mocked model/research responses for job execution and API/UI integration.
It does not read a real key or call Gemini. Tests cover persisted partial steps, explicit
resume, failure/no retries, restart recovery, invalid evidence, idempotent final save,
worker locking, quota persistence/expiry, disabled and cross-origin requests, and static
route regression. TypeScript and production build are required checks.

A headless Chromium check used one temporary synthetic partial job: direct URL, refresh,
exact evidence display and warnings passed; resume was intercepted with a mocked response,
and no generation, research or external requests were made. Static search/navigation and
invalid/missing job 404s passed. The synthetic record was removed afterward; genuine saved
guides were preserved. Mobile layout was not part of this milestone.

The cached Pipedrive snapshot prepares four section requests at roughly 17–20 KB versus
34 KB for the full request. That is offline sizing, not live model-quality validation.
No live queue run has been performed. A separately authorized live job is still needed
before claiming the new multi-section generation path works with Gemini end to end.

Final offline verification: **205 tests passed**, TypeScript and production build passed.
The section checkpoint validator also caps documented quotation references at 10 per
section, keeping the four-section aggregate within the existing 40-reference full-guide
limit. Four citation IDs per claim is enforced locally. Renewal uses at most seven
excerpts so its schema and prompt stay below the 20 KB guard. Disabled worker startup
was checked explicitly; it made no requests. The temporary browser fixture was deleted;
the genuine saved Pipedrive guide remains intact.


## Automatic progression update

New jobs now progress through all six stages automatically, while retaining sequential
execution, persistent checkpoints and the unchanged quota. Rate-limited queued stages
wait without additional provider attempts. Failures and interrupted requests stop the
job until **Retry failed step** is explicitly chosen. Read-only polling retries after
network errors do not retry generation, and polling stops on failure or completion.

An already running worker must be restarted to load this code change: stop it with
Ctrl+C, then use the documented worker command. Do not start a second worker alongside
it. Existing `paused` checkpoints remain untouched; on an upgraded worker, choose
**Resume automatic generation** once to resume from that saved point. No existing job
is silently restarted or re-researched by a page load. The implementation did not
restart the live worker, mutate the user's job or make a live API call.

Automatic progression verification: **209 tests passed**, TypeScript and production
build passed. Mocked tests cover full automatic advancement without intermediate resume
requests, failure stopping with the saved prefix intact, read-only polling through
running/saved/completed states, polling recovery after network errors and no generation
POSTs from status updates. No live API calls, worker restart or user-job mutation were
performed during this update.

## Foundation request-size fix

The real HubSpot job `4aa04f83-c22d-4780-91e0-674e273014e5` failed before
transport because `buildSectionRequest` exceeded the local 20,000-byte serialized
request guard. It was previously mislabeled `insufficient-documentation`.
No Gemini request was made for that failed section.

The section prompt now contains only the section-relevant security, citation,
uncertainty and output rules instead of appending them to the complete guide prompt.
The source excerpts, IDs, schemas, 20 KB guard, timeout and validator are unchanged.
A request that still exceeds the guard now fails as `section-request-too-large`,
with safe UI wording distinguishing local payload size from missing documentation.
No guard is raised, no quotations are truncated or silently replaced, and no old
job is retried or rewritten automatically.

Offline reconstruction of the same saved research now produces: foundation 17,571
bytes (same eight excerpts), authorization 15,858 bytes, renewal 15,502 bytes and
distribution 13,762 bytes. These are serialized ModelRequest measurements, not billed
token counts or live generation results. Existing raw checkpoints remain unchanged.
Restart the worker to load the fix, then explicitly retry the failed step; successful
steps will advance automatically and reuse the research checkpoint. No new research
or API calls were made by this investigation. Tests cover compact prompt constraints,
the unchanged size guard, specific error classification and zero transport calls for
an oversized synthetic request.

## Renewal provider-failure diagnostics

The renewal failure on job `4aa04f83-c22d-4780-91e0-674e273014e5`, request
`68054419-91d1-4770-a71c-e1fb345d0033`, was recorded only as `generation-failed`.
It occurred in provider request/response handling, before section content validation.
The exact original HTTP status/finish reason was not retained, and no matching local
log was recovered. It must not be inferred from earlier 503s. The same cached renewal
request currently measures 15,502 bytes and shares its schema with authorization.

The worker now preserves sanitized provider category, HTTP status/code and finish
reason when available in the job's server-only `error.provider`. It distinguishes
quota (`gemini-quota`), upstream 503 (`provider-unavailable`), timeout, incomplete
output, invalid JSON/size and other provider failures. API/UI views expose only the
safe action code and request ID; provider envelopes, prompts, raw error messages,
stack traces and credentials are never persisted in these diagnostics. Invalid
section evidence still uses the existing strict validation path.

This observability fix cannot retrospectively identify the old provider error.
Completed sections and the failed job are left untouched. No retry, research call,
worker restart, model change or limit increase was performed. Restart the worker
before any next deliberate attempt so it loads the new diagnostic handling; an
existing worker terminal event for that request ID may identify the old cause
without another provider request. Do not repeatedly retry an undiagnosed failure.

All 213 tests, TypeScript and production build passed, including mocked 429/503/400,
incomplete/MAX_TOKENS, empty and invalid JSON responses, server-side diagnostic
redaction, completed-prefix preservation and absence of automatic provider retries.

## Duplicate worker-PID lock fix

The job snapshot at stageIndex 3/status queued was waiting for a worker, not reporting
another provider failure. Inspection found `.worker.lock` containing `8695086950`,
which was the old PID `86950` written twice. A read-only process check found no such
worker. This explains the later queued stall, not the preceding renewal provider error.

The stale-lock recovery branch previously wrote its PID immediately after acquiring a
new file and again at the file's current position before starting work. The second
write now explicitly targets position zero, preventing concatenation. Recovery also
recognizes the duplicated legacy format. Every plausible bounded PID must be proven
dead before reclamation, so an ambiguous or live owner cannot be bypassed. Recovery
remains serialized and malformed/permission-restricted locks fail closed.

The real job, lock and quota files were left unchanged, and no worker or API call was
started. Starting the updated worker will safely reclaim a proven-dead legacy lock
and pick up already queued work. No additional Retry click is needed for queued work.
Quota restrictions remain unchanged and may defer a later section. All 215 tests,
TypeScript and production build passed, including recovered-file contents, duplicated
dead owner recovery and duplicated live-owner rejection.

## Required-array contract correction

Renewal attempt `a92fcc61-e5af-4303-85de-f162e7985273` failed with
`schema-nonempty-array-required`. Its exact array path was not retained: the diagnostic
allowlist omitted the `section` prefix, and no raw failed response was saved. It cannot
be proven retrospectively whether steps or nextActions was empty.

A confirmed contract mismatch was nevertheless found: “at most one nextActions item”
permitted zero in the prompt, while the unchanged fragment parser requires a nonempty
array. The section prompt now requires exactly one next action when that field is in
the section schema, and 1–2 steps. It gives a correctly shaped unknown next-action entry
with no citations when no provider-specific action is established. Required arrays must
not be filled by invented facts. Empty arrays still fail; output is never repaired or
padded by backend code. Array constraints in the response schema remain unchanged.

Diagnostics now allow the bounded `section` path prefix while continuing to reject
arbitrary field names. Future empty-array errors can retain `section.steps` or
`section.nextActions` privately. Existing job history was not rewritten.

All 217 tests, TypeScript and production build passed. Regressions cover unknown next
actions, invalid citations, strict empty-array rejection and safe field paths. The saved
HubSpot foundation request remains below 20 KB (18,460 bytes). No model/research calls,
worker restart, quota reset or mutation of the user's saved sections occurred. Restart
the worker before a separately deliberate Retry so it loads the corrected prompt.


## Unified homepage generation UI

The homepage now has one **Generate Guide** form. Its POST creates a queued background
job; it mounts the shared progress/section renderer inline rather than only showing a
link to a separate job page. Each validated section appears immediately on the next
read-only poll. A loader below the saved sections names the current/next step and
honestly distinguishes queued work from running work. It disappears on failure or
completion. Completed results, all saved sections and Copy Share Link remain visible.

The browser remembers only the active job UUID, never guide content or credentials.
It also puts `?job=<UUID>#generate` in the homepage URL. Refreshing or returning reads
the saved job via GET, including completed jobs, and never resubmits generation. The
job page's homepage link carries its UUID, and visiting that job page remembers it
for return navigation. Browser storage is a pointer only; durable content remains in
server-side JSON. If storage is unavailable, the explicit homepage URL still works.
Static providers retain their permanent links and avoid generating duplicate jobs.

This UI change does not start/restart the worker or change generation, validation,
quota or billing. Background execution still requires the separately running worker.
Existing jobs can be displayed with `/?job=<UUID>#generate` without rerunning them.
Failures remain stopped until explicit retry; a loader never implies a failed section
is still generating. There is no fabricated percentage or unconfirmed completion.

Offline validation: 220 automated tests, TypeScript and production build passed.
Headless Chromium used mocked queue responses against the actual homepage: one POST,
progressive inline sections/loaders, completion/share-link clipboard, and reload
restoration using GET only. No real job, guide, research or Gemini request was created
by that browser test. No browser runtime errors or unexpected API requests occurred.
Screenshots are `/tmp/homepage-inline-job-progress.png` and
`/tmp/homepage-inline-job-completed.png` (synthetic UI fixtures, not live guide proof).

### Local quota for staged generation

The shared worker cap is 10 Gemini attempts per rolling hour, with at least
60 seconds between attempts. Four successful section calls can complete one
guide; research and final assembly do not consume model quota. Existing attempt
history is retained. This is a local guard, not a guarantee of provider quota.
Restart the separately running worker to load a changed cap; no restart or
quota reset is performed automatically. Queued UI shows worker availability,
attempt count and the next eligible shared quota slot through read-only polling.
