# HubSpot content audit — 2026-11-03

**Result:** corrected, unpublished documentation-reviewed draft. No OAuth registration, consent, exchange, refresh or approval was executed. No Gemini calls or new web requests were made. Original generation output is preserved at `/tmp/hubspot-generation-canonical-ids-result.json`.

The corrected [guide](hubspot-guide.json) is an offline audit artifact, not application data or a generator fallback. Its [source snapshot](hubspot-source-snapshot.json) preserves the original retained official text and provenance for reproducible evidence checks. Neither is imported by the application. Excerpts were selected from the existing research registry; their IDs, wording, offsets and context were not rewritten. The original source inspection date remains November 3, 2026.

## Confirmed instructions and corrections

“Documented” below means supported by the saved official text, not independently executed or guaranteed current beyond its inspection date.

| Area | Audit and smallest content correction |
| --- | --- |
| Registration | Added the missing first action: `hs project create`, select **App**, choose OAuth and distribution/features. The initial guide incorrectly began with a project already present. Creation produces local files, not an installed app. |
| CLI prerequisite | Replaced an unrelated client-secret quotation with the create-app prerequisite. That snapshot specifies v7.6.0 and `hs account auth`; the overview uses `hs accounts auth`. The draft discloses this discrepancy rather than guessing which installed CLI supports which command. |
| Accounts and installation roles | Replaced the vague “administrative or developer access” claim. An existing or test installation account is documented. Exact installer-role applicability remains unknown: quickstart says Super Admin; create-app instead links to required user permissions without resolving them. |
| Redirect and distribution | Added production HTTPS, identified localhost examples as development examples, and separated private allowlisted distribution (saved overview: maximum 10 accounts at a time) from Marketplace eligibility. `marketplace` configuration is not evidence of a reviewed or approved listing. |
| Scopes | Kept scopes as feature examples, not universal requirements. Replaced redirect-line quotations with direct evidence: quickstart describes account-wide contact visibility for `crm.objects.contacts.read`; overview documents `crm.objects.contacts.write` for creating contacts. Avoided broader unsupported claims about all write operations. |
| Upload and credentials | Added `hs project upload` before `hs project open`, then **Project Components → app → Auth → Client credentials** and backend configuration. The retrieved create-app text supports that sequence. Replaced the implication that both credentials are confidential with explicit client-secret handling. |
| Authorization | Confirmed the documented authorization URL, singular `scope` parameter and URL-encoded space-separated scopes. The token-reference prose says `scopes`, but its example and quickstart table use `scope`; the correction follows the actual request format. User consent is conditional, not guaranteed. |
| Callback | Confirmed backend callback/code handling and temporary single-use code semantics. The code is not an API access token. No code or successful redirect is promised when authorization fails. |
| Token exchange | Confirmed form-encoded backend POST, `grant_type=authorization_code`, credentials/code and the redirect URI used at authorization. Quickstart supports `https://api.hubapi.com/oauth/v3/token`; the other saved reference's example uses `api.hubspot.com`. The draft uses the quickstart URL and makes no claim of runtime endpoint verification. |
| Expiry | Earlier review called the 30-minute value unsupported by the selected exchange quotation. Full saved text and a directly selected warning do support **currently 30 minutes**. Corrected to use response `expires_in` (seconds), not a fixed promise. Removed “long-lived” refresh-token wording; no refresh-token duration is established. |
| Refresh and use | Added the documented renewal request with `grant_type=refresh_token`, credentials and refresh token, plus Bearer access-token use. Described implementation work, never successful execution. |
| Effort and roles | Retained 30–60 minutes only as an unmeasured editorial registration/configuration estimate with existing account, CLI and callback assumptions. Excluded backend implementation, testing and external review. Agent/developer tasks and security recommendations remain editorial, not provider requirements. |

## Unknowns and blockers to user-facing use

- Provider review/submission requirements, approval timing and concrete failure recovery remain unknown and uncited. User consent, app installation and Marketplace review are separate concepts.
- Required installer permissions and the CLI version/authentication-command discrepancy need confirmation for the intended account and platform version.
- Private-distribution allowlisting details, Marketplace submission, and broader scope/product entitlements were not established by this saved corpus. Follow the official references before choosing a production distribution path.
- State/CSRF handling, credential/token storage design, refresh concurrency and denial/error behavior need implementation/security review. The guide recommends review editorially; it is not a complete production security specification.
- A developer must execute registration, consent, token exchange, scoped API access, renewal and negative-path tests. Endpoint examples and retained source text do not demonstrate a working connection.

**Display recommendation:** suitable only as a clearly labeled documentation-reviewed, not-tested draft with the unknowns above visible. Do not present it as a production-ready or end-to-end-tested guide. It remains deliberately disconnected from the frontend.

## Validation and files

- `npm test`: 46/46 pass, including five new offline audit regression tests.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- New tests validate the complete corrected guide against the existing schema, re-extract every quotation from the independent retained text, confirm source mappings, and check registration/upload order, direct scope evidence, conditional distribution, expiry/refresh language, effort exclusions and uncited unknowns.
- These are targeted editorial/provenance regressions, not an automatic semantic verifier for future generations.

Files added: this report, `hubspot-guide.json`, `hubspot-source-snapshot.json`, and `tests/hubspot-audit.test.ts`. README links the audit. No generation architecture, frontend, static guides, dependencies, secrets or billing configuration changed. Real Gemini requests: **0**.
