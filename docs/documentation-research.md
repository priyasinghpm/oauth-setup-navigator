# Public documentation research layer

This Step 4 module retrieves public documentation without Gemini, search APIs, scraping services, or credentials. It leaves the existing guide JSON and guide UI unchanged. It is a research-data boundary, not a guide generator or a factual verification engine.

## Use

Import `researchProvider` from `lib/research` in server-side Node.js code. This entry point uses `server-only` to prevent accidental Client Component imports. The pure/internal modules are separately imported by tests.

```ts
const result = await researchProvider({
  website: 'https://developers.hubspot.com',
  seedUrls: [
    'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview',
    'https://developers.hubspot.com/docs/api-reference/legacy/authentication/manage-oauth-tokens',
  ],
});
```

`website` accepts an HTTPS URL or a bare hostname and is the primary reliable entry. It is the caller’s assertion of official ownership, not an independent organizational verification. Only the same registrable domain (including private suffix boundaries) is eligible. A vendor’s docs on a different hosting domain need their own explicitly supplied website. IP literals, credentials, query parameters, HTTP, and custom ports are rejected.

Name-only input consults a reviewed registry for Google Calendar, Slack, Notion, and HubSpot. Unknown names return `status: "website-required"` with a message asking for the official website, and make zero requests. It never guesses `<provider>.com` or equates DNS existence with official ownership. Arbitrary new providers work through website input; they do not require a registry entry.

Output includes titles, requested/final URLs, bounded text, parent discovery URL, timestamps, topic candidates, truncation/indexing flags, failures, missing topics, and every request attempt. `partial` is an expected outcome. `complete` only means the topic-matching heuristic found all seven topic categories; it never establishes that every requirement has been verified.

## Reproduce the HubSpot check

```sh
npm run research:hubspot
npm run research:hubspot -- --seeded
npm run research:hubspot -- --seeded --output /tmp/hubspot-research.json
```

The default console output omits source bodies. `--output` explicitly writes a local JSON result with the retrieved text; do not publish it as a search index or feed it to a model without a separate evidence review and publisher-policy check. The command loads no `.env` file and imports no model SDK. No web endpoint has been added.

## Bounds and safeguards

- Per run: 24 attempted requests, 8 extracted pages, 2 sitemap candidates, 3 redirects per page, 6 seconds per request (DNS included), 60 seconds total, 3 MB per encoded/decoded body, 24,000 text characters per page. Caller options may lower these limits, not raise them. Links/queues are also bounded.
- All DNS answers must be public unicast destinations. Private, loopback, link-local, metadata, multicast, reserved, and IPv4-mapped IPv6 addresses are rejected. HTTPS connections pin one validated address while retaining the original hostname for TLS and Host. Fixed address family and fresh sockets prevent a second unchecked DNS lookup. Redirects receive the same URL, domain, robots, and DNS checks.
- No cookies, bearer tokens, environment secrets, JavaScript execution, automatic HTTP retries, proxy forwarding, login, or CAPTCHA/paywall bypass. TLS certificate checking stays enabled.
- robots.txt applies before fetching documents. A missing robots file (404/410) permits retrieval; other inaccessible policy responses fail closed. Robots redirects fail closed. Crawl-delay is honored where it fits the short window, otherwise that host is skipped.
- `noindex` is recorded, not mistaken for an access prohibition; no search index is built. `nofollow`/`none` stop link expansion, and `nosnippet`/`noai` stop content extraction. HTML meta robots and X-Robots-Tag are considered conservatively.
- HTML scripts/forms/navigation are excluded from content; ordinary links, public sitemaps, Markdown navigation, and publicly linked documentation indexes can supply candidates. No page commands are executed. All retrieved text is marked `untrusted-source-text` and must remain evidence, never higher-priority instructions. Prompt injection cannot trigger tool execution here because there is no LLM or instruction interpreter.

These are application-level safeguards, not a substitute for network egress isolation if a public research endpoint is added later. This phase exposes only an internal server module and a CLI.

## HubSpot results — 2026-11-03

The [machine-readable report](hubspot-research-results.json) contains every successful source, request status, failed URL, title, and discovery parent; source bodies are excluded.

### Seeded verification

**9 requests, 8 extracted pages, no failures.** Both supplied URLs returned HTTP 200. Automatically followed links supplied four additional documentation pages:

- [HubSpot Developers | Create tomorrow's solutions today on HubSpot's Developer Platform.](https://developers.hubspot.com/)
- [Manage OAuth access tokens using the v3 APIs](https://developers.hubspot.com/docs/api-reference/legacy/authentication/manage-oauth-tokens)
- [Authentication overview](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview)
- [HubSpot Developer Documentation](https://developers.hubspot.com/docs)
- [Manage OAuth access tokens using the v1 APIs](https://developers.hubspot.com/docs/api-reference/legacy/authentication/oauth-tokens/v1/guide.md)
- [Create a new app using the CLI](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/create-an-app.md)
- [OAuth Quickstart Guide](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide.md)
- [App configuration](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/app-configuration.md)

The homepage and docs landing page count toward the eight-page cap. No page in this run hit the text truncation limit. Review requirements were not found, so the result remains partial.

### Observations from actual retrieved content

- [Authentication overview](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview): multi-account apps use OAuth; app configuration sets `auth.type` and selects a distribution mode.
- [App configuration](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/app-configuration.md): `redirectUrls` registers callbacks, `requiredScopes` defines mandatory permissions, and HTTPS is required with a localhost testing exception. Marketplace and private distribution are different settings.
- [Token management](https://developers.hubspot.com/docs/api-reference/legacy/authentication/manage-oauth-tokens): authorization returns a single-use code; the documented v3 token exchange uses a form-encoded POST with the code, client credentials, and redirect URI. Tokens and refresh operations are separate from app registration.
- [OAuth quickstart](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide.md): the authorization URL includes the client identifier, redirect URI, and requested scopes, and the callback receives the authorization code.

These are content observations, not a tested HubSpot OAuth connection. Legacy and new-platform documentation coexist; a future guide must deliberately select and cross-check the appropriate platform/version. No review timeline is inferred.

### Website-only verification

**17 requests, 8 extracted pages, 4 HTTP 404 failures.** Automatic discovery followed the homepage to `/docs`, its publicly linked `/docs/llms.txt`, and linked app-creation/troubleshooting material. It did not independently reach both supplied OAuth reference pages before the eight-page cap. Known URLs were therefore needed for reliable targeted coverage in the seeded run.

The four failed URLs came from actual discovered links:

- `https://developers.hubspot.com/docs/specs/2026-09/auth-oauth-v2026-09.json` — HTTP 404
- `https://developers.hubspot.com/docs/specs/2026-03/auth-oauth-v2026-03.json` — HTTP 404
- `https://developers.hubspot.com/docs/specs/legacy/v3/auth-oauth-v3.json` — HTTP 404
- `https://developers.hubspot.com/docs/specs/legacy/v1/auth-oauth-v1.json` — HTTP 404

Two sitemap requests also succeeded; these discovery aids do not count as extracted documentation pages. Topic matching is shallow: a general CLI troubleshooting page does not establish OAuth-specific recovery coverage. Approval/review criteria, review waiting times, and complete OAuth-specific troubleshooting remain unverified or incomplete. This layer reports missing categories instead of inventing them.

Final verification used **26 requests total** (9 seeded + 17 website-only). Earlier diagnostic/tuning runs used 60 additional external attempts while identifying stale sitemaps, the original 1 MB size cap, and noindex handling; one sandbox DNS failure was separate. The total external test attempts in this task were 86, each run capped independently.

## Validation

`npm test`: 22 tests passed (8 existing guide/search tests plus 14 retrieval/security/failure cases). `npm run typecheck` and `npm run build` passed. Live HTTP retrieval is separate from these deterministic tests. No existing provider guide was edited, no model was called, and no paid service was used.
