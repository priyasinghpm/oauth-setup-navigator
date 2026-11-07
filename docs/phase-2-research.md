# Phase 2 research and validation report

Researched on **2026-11-01** using official developer documentation only. No provider account was registered and no OAuth connection was executed. “Documented” means supported by the cited page, not tested end to end.

## Sources successfully inspected

All stored source URLs below were opened successfully. Notion’s requested `https://developers.notion.com/docs/authorization` redirected to its current authorization guide. Earlier guessed Slack quickstart/distribution paths were unavailable; the official navigation supplied the current paths below. Unavailable guessed paths are not stored as sources.

### Google Calendar

- [Calendar JavaScript quickstart](https://developers.google.com/workspace/calendar/api/quickstart/js) — `google-quickstart`
- [Calendar authorization and scopes](https://developers.google.com/workspace/calendar/api/auth) — `google-scopes`
- [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent) — `google-consent`
- [OAuth for web-server applications](https://developers.google.com/identity/protocols/oauth2/web-server) — `google-web`
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — `google-verification`
- [Calendar events.list reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) — `google-events`

### Slack

- [Create an app from app settings](https://docs.slack.dev/app-management/quickstart-app-settings/) — `slack-create`
- [OAuth installation flow](https://docs.slack.dev/authentication/installing-with-oauth/) — `slack-oauth`
- [Credentials and optional Postman test](https://docs.slack.dev/authentication/authorizing-with-postman/) — `slack-postman`
- [oauth.v2.access and errors](https://docs.slack.dev/reference/methods/oauth.v2.access/) — `slack-token`
- [chat:write scope](https://docs.slack.dev/reference/scopes/chat.write/) — `slack-write`
- [App lifecycle and distribution](https://docs.slack.dev/app-management/distribution/) — `slack-distribution`

### Notion

- [Public connections and installation scope](https://developers.notion.com/guides/get-started/public-connections) — `notion-public`
- [Authorization](https://developers.notion.com/guides/get-started/authorization) — `notion-auth`
- [Connection capabilities](https://developers.notion.com/reference/capabilities) — `notion-capabilities`
- [Create a token and redirect URI rules](https://developers.notion.com/reference/create-a-token) — `notion-token`
- [API status codes](https://developers.notion.com/reference/status-codes) — `notion-errors`
- [Optional Marketplace listing and review](https://developers.notion.com/guides/get-started/marketplace-listing) — `notion-marketplace`

## Claims that remain uncertain

- All difficulty ratings and registration-effort ranges are editorial, unmeasured estimates. Existing accounts and permissions are assumed; implementation, OAuth testing, policy preparation, and external review are excluded.
- Google’s actual verification applicability depends on scope classification, audience, and exceptions. Its sensitive-scope review guidance is not a total launch-time guarantee.
- Slack’s workspace-specific installation policy and approval/review duration remain unknown. Development installation is separate from Marketplace distribution review.
- Notion’s Marketplace response expectation is not an approval guarantee. Its authorization guide mentions an authorization URL appearing after review submission, while its Marketplace guide says public OAuth works without a listing. Account-specific portal gates remain unresolved and explicitly labeled.
- Recommended agent/human responsibilities and testing procedures are editorial recommendations, not statements that those actions have been performed.

## Validation results

- `npm run typecheck`: passed.
- `npm test`: 8 tests passed. Includes existing search/filter regressions, complete research data, review-duration evidence, and rejection of missing/broken citations, malformed dates, duplicate identity, unsupported verification status, incomplete outcomes, and invalid estimates.
- `npm run build`: passed; homepage and all three provider guides generated successfully.
- Local HTTP checks: homepage and three guide routes returned 200; `/guides/unknown` returned 404 with the helpful unavailable-guide content.
- Rendered-HTML checks: homepage provider navigation, all nine guide sections, unique IDs, internal/source anchors, source URLs, expected outcomes, research date, evidence labels, labeled checkbox counts, and return links passed.
- Source URL inspection: all 18 stored official URLs opened successfully. Page content was researched, not merely checked for an HTTP status.
- No browser automation tool is available. Actual click behavior, checklist toggling/reset, keyboard focus, and mobile/desktop appearance were **not browser-tested**. The README contains the manual checks. No actual provider authorization was attempted.

## Files created or modified

Created: `lib/validate-guides.ts`, `components/claim-evidence.tsx`, `components/prerequisite-checklist.tsx`, and this report.

Modified: `lib/types.ts`, `lib/guides.ts`, `data/guides.json`, `components/provider-card.tsx`, `app/guides/[slug]/page.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `tests/guides.test.ts`, and `README.md`.

The existing slug-validation layout, loading boundary, search implementation, provider slugs, and URL structure were retained. No new npm dependencies were added.

## Manual browser validation

Open **http://127.0.0.1:3001**. Check the three cards, mixed-case search and combined filters, empty-state reset, each guide and return link, prerequisite checkboxes and temporary progress, claim-to-source anchors and external docs, the unknown-guide page, and a 375px viewport. Use Tab and Space to verify checkbox interaction and visible focus. Compare the approval waiting-time text with its specific official source before using it in a launch plan.

## Setup clarity review — 2026-11-03

Slack and Notion now separate a neutral **Before you begin** prerequisite checklist from a highlighted **Start here · step 1** action. Setup instructions specify the provider settings or application backend, the configuration action, and its expected outcome. Source IDs and evidence remain attached.

The current [Notion authorization guide](https://developers.notion.com/guides/authorization/overview) explicitly says OAuth can start once credentials and the redirect URI are configured, without Marketplace submission or review. This resolves the earlier ambiguity recorded above. Its [public-integration guide](https://developers.notion.com/guides/connections-and-tokens/public-integrations/overview) also supplies the current Build → Connections registration path. Both canonical URLs are now stored under the existing source IDs. Six relevant Slack/Notion sources were re-inspected; other source dates retain the original research date.

Validation after these edits: all 8 existing tests passed, TypeScript passed, and the production build passed. No end-to-end provider authorization or visual browser test was performed.
