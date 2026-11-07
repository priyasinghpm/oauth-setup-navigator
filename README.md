# OAuth Setup Navigator

Understand the prerequisites, permissions, setup steps and approval conditions for registering a provider OAuth app.

**[Try the app](https://next-multi-step-form-dbfk.vercel.app/)** · [Evidence audit](docs/submission-evidence.md) · [Detailed setup](docs/setup.md)

## Why this exists

An OAuth app identifies a developer’s integration; each user separately authorizes their own connection. [Composio-managed OAuth](https://docs.composio.dev/toolkits/managed-auth) can remove the registration work. This navigator focuses on developers who need their **own OAuth app**, helping them understand the work before implementing it.

Google Calendar, Slack and Notion provide researched examples of different setup challenges. For other providers, the app retrieves official documentation and asks Gemini to organize it into a guide. The backend resolves exact quotations and validates evidence references. Developers retain account ownership, credentials, consent and actual OAuth testing.

## Run locally

Requires Node.js 22 LTS or newer compatible, and npm.

```sh
npm ci
npm run dev
```

Open the URL printed in the terminal, normally **http://127.0.0.1:3000**. Search and the three existing guides work without an API key.

To enable generation, copy `.env.example` to `.env.local` **only if you do not already have one**, then set:

```dotenv
GEMINI_API_KEY=your_key
GUIDE_GENERATION_ENABLED=true
```

Restart the server. Enter a provider and preferably its official OAuth documentation URL, then click **Generate Guide**. Confirm free-tier eligibility and available quota in your Google project first. Never put credentials into the webpage or commit `.env.local`.

## Generation and sharing

| Mode | Where | Behavior |
| --- | --- | --- |
| Standard | Homepage, local or Vercel | Generates a complete guide; if validation fails, shows accepted sections with an explicit continuation action. No worker needed. |
| Queue/resume | `/generate/stepwise`, **local only** | Run `npm run worker:guides` in a second terminal. Saves validated sections; failed sections require an explicit retry. |

**Hosted queue support is outside the take-home scope.** Jobs require persistent local disk and a running worker; Supabase stores completed guides, not job checkpoints. Queueing does not prevent Gemini outages.

Partial progress stays in the same browser tab across refreshes, with a signed two-hour checkpoint. **Continue remaining sections** makes one request for the next missing section, reusing evidence; no research or retry runs automatically. Only a completely validated guide is saved for sharing. Closing the tab loses partial progress; expired checkpoints and previously discarded responses cannot be resumed.

Saved guides open at `/guides/<UUID>` and can be reopened without Gemini. Local storage defaults to `.local/generated-guides/`; the deployed app uses Supabase. Copy Link uses the current origin, so localhost links are not public links.

## Deployment and access

The hosted standard flow uses **Vercel + Supabase**. Run [supabase/schema.sql](supabase/schema.sql), then configure these server-side environment variables:

```dotenv
GUIDE_STORAGE_BACKEND=supabase
SUPABASE_URL=your_project_url
SUPABASE_SECRET_KEY=your_server_secret_key
GUIDE_ACCESS_PIN=your_random_shared_passphrase
GEMINI_API_KEY=your_key
GUIDE_GENERATION_ENABLED=false
```

Use a random **12–128 character** access passphrase; share it privately, never the API keys. Redeploy after configuration changes. Verify storage and unlocking before deliberately enabling generation. Access lasts eight hours; existing guides and saved links remain public. See [setup details](docs/setup.md) for model configuration, limits and deployment checks.

## Checks and limitations

```sh
npm test
npm run typecheck
npm run build
```

- Generated guides are **not human reviewed or end-to-end OAuth tested**. Exact quotations establish provenance, not semantic correctness. Review sources and explicit unknowns before use.
- Repeated upstream Gemini **503 UNAVAILABLE** responses remain a live-demo risk. Traffic/free-tier capacity are possible causes, not confirmed diagnoses. No automatic retries, grounding or paid fallbacks are used.
- Offline tests and synthetic storage checks do not prove live unfamiliar-provider success. That demonstration remains outstanding; [the audit](docs/submission-evidence.md) distinguishes retained evidence from unverified claims.
- The shared-code gate and rate limits are demo safeguards; counters are per server instance, not distributed abuse protection. Local files are unsuitable for durable serverless storage.
