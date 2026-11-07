# Persistent generated guides — 2026-11-05

## Storage decision

The confirmed target is a **local demo or long-running Node server with persistent disk**. One JSON file per generated guide is the smallest zero-cost solution for this workload: no database, account, service, dependency or billing setup is needed.

Default directory: `.local/generated-guides/` under the project working directory. It is Git-ignored. On a hosted Node server, set the private server variable `GUIDE_STORAGE_DIR` to an absolute directory on a persistent disk/volume, writable by the app user. The directory must survive deployments as well as process restarts; a directory recreated from a fresh checkout does not provide that guarantee. Back up the records if they matter.

This is not portable persistence for ephemeral/serverless hosts. Known Vercel/Lambda environments fail closed rather than claiming temporary local files are durable. Other hosts must be evaluated for persistent disk; the code cannot detect every hosting environment. A serverless deployment would need a separately configured durable store/adapter. No paid or free cloud account was provisioned.

URLs use the current server origin. A `localhost` or `127.0.0.1` link is reusable on that computer, not publicly accessible from another person's computer. Public sharing requires a reachable deployment that serves the same persistent record directory. Multiple instances need shared storage; separate instance disks do not suffice. UUID links are not authentication.

## Save and response flow

The production generation API is wired to the server-only store. It checks storage availability before research/Gemini, then uses the unchanged research/generation/validation pipeline. Only a successful, JSON/schema-valid backend result reaches saving. Invalid model output and failed validation never create a guide record.

The store parses the guide again at its boundary and writes only the guide plus allowlisted metadata:

- schema version, random UUIDv4 and save timestamp;
- complete `OAuthGuide`, including source registry, exact quotations/context/offsets, source URLs, research date and claim evidence/uncertainty;
- `generated-draft`, `not-human-reviewed`, `not-tested`, warnings and model label.

It does not store API keys, environment configuration, request bodies/headers, credentials, real OAuth tokens, raw SDK responses or diagnostic errors. Public documentation's example strings inside exact quotations remain unchanged. The application never executes OAuth connections or collects account credentials.

Writes use a private temporary file, flush/close it, then atomically link the completed file to the unique final UUID filename on the same filesystem. The commit cannot overwrite an existing record. Temporary files are removed after normal completion/failure. Files use mode 0600 and newly created directories 0700. No automatic retention/deletion is added; records occupy disk until managed by the server owner. The record limit is 512 KB.

On success, the existing API response also includes:

```json
{
  "saved": {
    "id": "<UUIDv4>",
    "path": "/guides/<UUIDv4>",
    "createdAt": "<ISO UTC timestamp>"
  }
}
```

The existing guide/sources/evidence/status fields remain. On preflight failure, HTTP 503 `storage-unavailable` skips research/Gemini. If saving fails after generation, HTTP 503 `guide-save-failed` reports that no share link was created. Nothing is automatically retried. Existing generation opt-in, rate limiting, evidence validation and billing behavior are unchanged.

## Read and frontend flow

The existing `app/guides/[slug]` route now accepts both original static slugs and saved UUIDs; a second conflicting `[id]` route is unnecessary. Static slugs retain precedence and their prebuilt routes/content. Unknown/invalid IDs are checked before file access, and missing records return HTTP 404 before the page loading boundary streams. Corrupt/unreadable records show a generic unavailable page without filesystem/error details.

Saved UUIDs are read at request time using Next.js `connection()`; there is no process-level record cache. The layout/page/metadata resolver is memoized only within a render request. Reading a saved record imports no research or Gemini entry point, requires no Gemini key or generation enable flag, and never regenerates on refresh.

After a saved generation, the homepage offers **Copy Share Link** and **Open saved guide**. Clipboard errors provide an accessible fallback to opening/copying the URL. The client accepts only a UUID-bound relative path, not an arbitrary API-supplied external share URL. Saved pages use the shared generated-guide presentation, source evidence, lifecycle notices and not-tested/not-human-reviewed warnings. They also offer copying the same saved URL. Saving does not upgrade review/verification status.

Existing in-memory results from before this implementation are not retroactively imported. The old audited HubSpot JSON is not used as a fallback. No existing response was rewritten or saved as if it had passed the current generation pipeline.

## Exact local testing without Gemini

Install dependencies if needed, then run:

```sh
npm test
npm run typecheck
npm run build
```

For just persistence and frontend tests:

```sh
node --import tsx --test tests/saved-guides.test.ts tests/generated-frontend.test.ts
```

These use synthetic, explicitly mocked fixtures in temporary test directories. They verify a save after actual mocked-pipeline validation, exact round trips, unique IDs, reading from a separate Node process (restart equivalent), no model/research calls on reads, write failures, invalid records/IDs, static precedence, safe share paths and clipboard success/failure. Test directories are removed; no mock guide is seeded into the production library/store.

For browser checks, stop any current project development server yourself before starting another one if Next.js's dev lock is held. Keep generation disabled:

```sh
GUIDE_GENERATION_ENABLED=false npm run dev -- --port 3001
```

Open `http://127.0.0.1:3001`. Check `/guides/google-calendar`, `/guides/slack`, `/guides/notion`. Check `/guides/not-a-valid-id` and `/guides/00000000-0000-4000-8000-000000000000`; the latter is the documented missing-ID check and returns 404 unless a record with that ID was deliberately installed.

No real guide was generated or imported during implementation, so there is no newly created real saved-guide URL to hand over. Once you separately authorize and complete a successful real generation, use its **Open saved guide** link, copy `/guides/<actual saved UUID>`, refresh it, and later reopen it after an ordinary server restart using the same directory. You can keep generation disabled while reopening. Do not submit the generation form just to test reads. Offline tests provide the no-Gemini save/reopen test now.

## Results and limitations

- **114/114 automated tests pass.**
- **TypeScript and production build pass.** Static guide paths and the dynamic API route remain in the build.
- Read-only HTTP checks against the existing server on port 3001: all three static guides return 200; invalid slug and missing UUID return 404.
- Independent-process filesystem persistence, source quotations, research date, uncertainty, review status and unique IDs are covered offline. Browser clipboard/DOM behavior is tested with mocks; actual mobile/browser visual checks were not performed.
- No Gemini calls, retries, server restarts, billing changes, paid infrastructure, imported fake production guides or static-guide data changes.
- Durability depends on the host retaining that disk and directory; backups, disk-space management and public deployment remain the owner's responsibility. There is no cross-device sharing from a loopback address and no new authentication or deployment.

## Files

Added: `lib/storage/file-guide-store.ts`, `lib/storage/resolve-guide.ts`, server-only `lib/saved-guides.ts`, `lib/guide-route.ts`, `components/copy-share-link.tsx`, `app/guides/error.tsx`, `tests/saved-guides.test.ts`, and this report.

Modified: production/API handler wiring, shared static/saved guide page/layout, client generation response handling and success UI, not-found text, share-action styling, Git ignore rules, frontend tests and README. No research, Gemini generation or evidence validator implementation was changed.
