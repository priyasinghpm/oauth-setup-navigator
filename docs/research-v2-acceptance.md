# Research v2 acceptance — 2026-11-06

No Gemini/model API calls, billing changes, UI changes, static-guide edits or saved-guide writes occurred. Public documentation was retrieved during iterative research-only development and acceptance. Counts below describe the final acceptance runs, not all development network activity.

| Final homepage input | Requests | Pages | Extracted excerpts | Prepared sources | Selected excerpts |
|---|---:|---:|---:|---:|---:|
| https://www.pipedrive.com | 15 | 8 | 158 | 4 | 28 |
| https://developers.hubspot.com | 21 | 8 | 220 | 5 | 33 |

Pipedrive's prior homepage run selected no usable OAuth sources (9 requests, 8 marketing/marketplace pages, 530 excerpts). V2 discovers the developer landing page, HTML sitemap/API feature page, API reference and its exact link to `https://pipedrive.readme.io/docs/marketplace-oauth-authorization`, without provider-specific seeds. Prepared sources include that setup guide, `https://developers.pipedrive.com/docs/api/v1/Oauth`, the API index and CRM API overview. A renewal paragraph at source offset 12142 is retained. Link-only sitemap text is excluded from evidence.

HubSpot selects authentication overview, working-with-OAuth, OAuth quickstarts (including current and legacy variants) and scopes documentation. Renewal evidence at offsets 12037 and 12294 survives. Current/legacy applicability must remain qualified; no version-equivalence is asserted.

Topic candidates cover OAuth configuration, client credential usage, redirects, scopes, authorization, exchange, renewal and distribution for both. Pipedrive registration is partial and credential retrieval/scope configuration are not a complete tutorial. HubSpot app registration is missing from selected evidence. Review requirements, approval timing and troubleshooting recovery remain unknown under existing preparation flags for both providers. Topic matches are not semantic verification.

Nonfatal retrieval failures: Pipedrive `/docs` reports a soft 404; developer sitemap times out. HubSpot root `/llms.txt` and an old beta token URL return 404. No restrictions were bypassed and no retries were introduced.

Validation: 124 offline tests pass, TypeScript passes, production build passes. New regressions exercise Pipedrive-shaped discovery, metadata preservation, nested/localized sitemap and marketing budgets, exact URL delegation/replay, malicious lookalikes, out-of-scope redirects, robots/DNS/publisher/nofollow restrictions, old evidence registry compatibility, full-document renewal evidence, link-only HTML evidence exclusion and HubSpot preparation.

Research is suitable as input to one separately authorized controlled generation experiment, with unknowns preserved and a human audit afterwards. It is not a claim that a complete guide or OAuth connection will succeed. No generation was attempted here.
