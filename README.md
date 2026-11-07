# OAuth Setup Navigator

Explore OAuth setup requirements before building an integration. Includes source-backed Google Calendar, Slack and Notion guides, plus optional AI generation from retrieved official documentation.

## Quick start — no API key needed

Requires Node.js 22 LTS or a newer compatible release, and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Next.js, normally **http://127.0.0.1:3000**. If the port is occupied, use the actual printed URL. Static search, guides and Copy Link work without AI configuration.

## Enable AI generation locally

1. Create a Google AI Studio API key for a project with billing disabled. Confirm your chosen model has free-tier input/output access and available quota. Model availability varies by project; this application cannot verify billing or guarantee free access.
2. On a fresh clone, copy the template (if `.env.local` already exists, edit it instead of overwriting it):

   ```sh
   cp .env.example .env.local
   ```

3. Edit `.env.local` locally: set `GEMINI_API_KEY` and explicitly set `GUIDE_GENERATION_ENABLED=true`. Never paste your key into the webpage or commit it. Keep the default model unless you have confirmed a different model's eligibility.
4. Restart the web server after editing configuration.
5. On the homepage, enter a provider name and preferably its official OAuth developer documentation URL. Click **Generate Guide** once.

The normal flow retrieves documentation, makes one model request, validates evidence and saves the complete guide. It needs **only the web server**, not a background worker. Loading does not imply OAuth setup or approval was performed. Failed attempts are not retried automatically; no guide is returned if validation fails. Leaving the page does not provide resumable partial progress in this mode.

The local single-request guard allows five requests per rolling hour per server process, with at least 60 seconds between requests; failed attempts can count. Gemini's quotas are separate. HTTP 503 means provider unavailability, and changing the UI or key does not guarantee recovery. No grounding, paid fallback or automatic model switching is configured.

## Saved guides and sharing

Validated generated guides are stored atomically in `.local/generated-guides/` and open at `/guides/<UUID>`. Refreshing or reopening them makes no model or research request. Copy Share Link uses the current browser origin. A localhost link is accessible only on your own machine; public sharing needs a reachable server and persistent disk.

Static URLs remain `/guides/google-calendar`, `/guides/slack` and `/guides/notion`. Each has a Copy Link button. Generated content is not human reviewed or end-to-end OAuth tested. Inspect exact official quotations, source links, research dates and unknown claims before acting; exact quotation matching does not establish semantic correctness.

## Optional resumable mode

Use **Usage limits and resumable generation** below the normal form, or open `/generate/stepwise`. Run a second terminal from the project directory:

```sh
npm run worker:guides
```

The worker reads `.env.local` and runs only with explicit generation opt-in and a configured key. It saves research and each validated section in `.local/generation-jobs/`. Successful stages advance automatically. Failed sections require an explicit retry; completed sections are reused. Job URLs are `/jobs/<UUID>`.

This mode is for recoverable progress, **not a fix for Gemini 503 errors**. Its persistent local guard allows 10 model attempts per rolling hour, at least 60 seconds apart, shared across queued jobs. Each failed model attempt or explicit retry consumes a slot when started. Research, viewing and assembly consume no model slots. Stop workers with Ctrl+C; restart both processes after changing model configuration. Neither mode silently falls back to the other.

## Configuration and extension

See `.env.example`. Keys stay server-side. `GUIDE_MODEL_PROVIDER` and `GUIDE_MODEL` select the model through `lib/generation/model-runtime.ts`; only the Gemini adapter is registered. Other providers require an explicit `ModelTransport` adapter and compatibility tests. Unknown providers fail closed. Free ChatGPT access is not free OpenAI API access.

- `data/guides.json`: static guide content; validated at the data boundary.
- `lib/types.ts`, `lib/validate-guides.ts`: shared guide schema and parser.
- `lib/research/`: bounded official-document discovery, retrieval and evidence extraction.
- `lib/generation/`: request preparation, transport and evidence/quality validation.
- `lib/jobs/`: optional checkpoint and worker flow.
- `lib/storage/`: persistent generated-guide storage.
- `components/guide-presentation.tsx`: shared static/generated guide rendering.
- `docs/`: research reports, audits and historical diagnostics. Development-only scripts are optional; normal setup does not run them. Scripts named `research:*` or `generate:*` can make real requests—do not use them as offline tests.

Existing local records and audit artifacts are not sample credentials or guaranteed current model output. Do not upload `.local/`, `.env.local`, or private logs. Historical development notes are archived in [docs/development-history-readme.md](docs/development-history-readme.md).

## Checks and browser acceptance

```sh
npm test
npm run typecheck
npm run build
npm start
```

Automated tests use offline fixtures and mocked model/research responses. They do not prove live provider availability or OAuth integration success.

In the browser: search “Slack”, reset, open each static guide and copy its URL. With your own confirmed free-tier configuration, deliberately submit one provider; review citations and unknowns, then open and refresh its saved URL. Invalid guide IDs should return 404. Never enter OAuth secrets or tokens into provider inputs.

## Limitations

This is a local take-home/demo, without authentication, database or deployment setup. File storage survives restarts only on persistent disk; ephemeral serverless storage does not provide durable public sharing. Generation is disabled by default. Do not expose generation publicly without authentication, abuse controls and a durable hosting/storage plan. No billing is enabled by the application.
