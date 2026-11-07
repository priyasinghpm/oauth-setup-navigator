# Evidence review and demonstration status

This is a summary of retained development evidence, not a claim that every generated guide has been reviewed. No actual provider OAuth registration, consent, token exchange, renewal or approval is claimed as tested.

## What was checked

| Sample | Evidence and purpose | Limits |
| --- | --- | --- |
| Google Calendar, Slack, Notion | Researched static guides show different requirements: Google scope verification, Slack workspace installation and scope types, and Notion public connections and selected-content access. Claim references, research dates and uncertainty labels are displayed. | Documentation review is not an OAuth setup attempt. Requirements can change or depend on the account. |
| Historical HubSpot generation | Retained generated output and official-source snapshot were compared during a content audit. | Historical output is not guaranteed to pass the current stricter validator; it is not the deployed generator's fallback. |
| Corrected HubSpot audit artifact | A manually corrected documentation-reviewed draft and targeted regressions demonstrate specific corrections. | It is an audit artifact, not an unmodified model response, live browser response or end-to-end-tested integration. |
| Supabase saved-guide acceptance | An existing synthetic validated fixture was saved, opened and reopened through the deployed UUID route; the deployment returned 200 and a missing UUID returned 404 after the rendering fix. The temporary record was removed. | This proves storage/rendering behavior, not genuine provider guidance quality or live generation. No Gemini or research calls were made in this test. |

Sources for the static library are recorded in each guide and in [the research report](phase-2-research.md). The detailed [HubSpot audit](audits/hubspot-content-audit.md) links the corrected draft and retained source snapshot.

## What we learned and corrected

- A genuine citation can still be irrelevant. The HubSpot audit replaced unrelated support for prerequisites, scope permissions and credentials with directly relevant retained evidence.
- Registration needs a concrete first action. The audited draft added app creation and upload before opening the app and retrieving credentials, rather than assuming an existing project.
- Distribution configuration, installation, user consent and Marketplace approval are different stages. We removed implications that configuration means approval.
- Commands, endpoints, scope identifiers and token-lifetime claims need precise support. Current validation checks evidence mappings and selected literal/quality rules; historical responses with unsupported literals are not silently repaired or accepted.
- Source excerpts and model explanations are separate. Quotations are resolved from backend-owned evidence records, with source links and surrounding context. This does not establish semantic correctness automatically.
- Unknown scope information must use the explicit gap label, not a plausible identifier. Shared validation enforces this in both generation paths; queued generation also received an exact JSON prompt example.

## What remains uncertain

- Unretrieved approval requirements, review durations and provider-specific recovery instructions must stay unknown, with no unrelated citations.
- The HubSpot snapshot has account-role and CLI-command/version ambiguities documented in the detailed audit. Do not treat the historical corpus as current universal instructions.
- Difficulty and hands-on time are editorial estimates, not measured completion times. They exclude actual OAuth implementation/testing and external review.
- Deterministic checks catch invalid IDs, mapping errors and some unsupported literals; they cannot prove every explanation or expected outcome is semantically supported.
- Repeated HTTP 503 `UNAVAILABLE` responses were returned by Gemini. Available diagnostics confirm upstream failure, not that free-tier limits or traffic specifically caused it. Queueing preserves progress but does not guarantee availability.

## Remaining live demonstration

Before claiming unfamiliar-provider acceptance, deliberately submit one provider outside the static library through the deployed standard flow using confirmed free-tier access. A successful demonstration must include research, a real model response, backend validation, saving, reopening and human review of claim relevance across the OAuth lifecycle. Keep unsupported stages visible as unknown. Do not substitute the manually corrected HubSpot artifact or a synthetic fixture if generation fails.

No additional live request was made to write this report. Hosted queue infrastructure is outside the chosen submission scope.
