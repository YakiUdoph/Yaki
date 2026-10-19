# Location-context and human-confirmation policy

Policy version: `1.0.0`
Effective date: 2026-10-18

This is a Yaki application policy, not a Geoapify guarantee. It exists because the same ambiguous text can rank differently under different country bias, while agreement between two lookups still does not prove the intended delivery destination. The policy governs how address investigations are prepared, interpreted, and marked ready.

## Required rules

1. Yaki never silently infers the destination country from caller IP, provider ranking, coordinates, language, or the first returned candidate.
2. Batch address processing requires an operator-selected ISO 3166-1 alpha-2 country before any provider request is issued.
3. The selected country is sent as a hard country restriction wherever the provider contract supports it:
   - direct Forward Geocoding: `countrycodes=<code>`;
   - MCP `geocode_address`: `country_codes: [<code>]`.
4. A missing country context, a provider-returned country outside the selected country, or no candidates requires clarification.
5. Multiple candidates and meaningful direct/MCP disagreements are preserved as evidence; Yaki does not silently collapse them to the first result.
6. Geoapify confidence and match fields are geocoding evidence, not postal validation, entrance verification, or delivery certainty.
7. Coordinates and confidence scores can never auto-approve dispatch.
8. An uncertain address can be marked ready only after a human explicitly selects a returned candidate and confirms it.

## Executable behavior

The policy is implemented in `src/location-policy.ts` and produces one of three states:

| State | Meaning |
|---|---|
| `clarification_required` | Country context is missing, no candidate exists, or a candidate conflicts with the selected country. |
| `review_required` | Evidence exists, but a human has not both selected a preserved candidate and explicitly confirmed it. Multiple candidates or provider disagreement remain visible. |
| `ready` | A country is selected, the selected candidate exists in preserved provider evidence, and a human explicitly confirmed it. |

Batch preparation calls `requireSelectedCountry("batch", value)` and fails before a network request when the country is absent or invalid. Country codes are normalized to lowercase and must contain exactly two ASCII letters. No mapping from a country name, IP address, or provider result is performed automatically.

The decision record retains separate direct and MCP candidate arrays and emits named reasons including `country_context_missing`, `no_candidates`, `multiple_candidates`, `provider_disagreement`, `candidate_country_mismatch`, `candidate_country_missing`, `selected_candidate_not_found`, and `human_confirmation_required`.

## Provider disagreement

A disagreement is meaningful when the direct and MCP top candidates do not share the same `place_id`; coordinates and formatted text are used only as fallbacks when a place ID is absent. A disagreement is a review signal, not proof that either provider path is wrong. Human confirmation may resolve it, but the original evidence remains retained.

## Phase 2 verification

Automated tests cover:

- country restriction construction for both direct and MCP calls;
- batch rejection when no operator-selected country is supplied;
- preservation and review status for multiple candidates;
- clarification status for empty results;
- clarification status when a candidate omits country information;
- preservation and flags for conflicting direct/MCP candidates;
- rejection of automatic approval from coordinates and confidence `1`;
- transition to `ready` only after explicit candidate selection and human confirmation.

The focused live run used public query `Springfield` with operator-selected country `US`. Direct and MCP each returned the same five US city candidates, the same top `place_id`, zero top-coordinate distance, and five-place-ID overlap. Despite agreement and confidence `1`, the policy returned `review_required` because several candidates remained and no human confirmation was supplied. Sanitized evidence is in `artifacts/country-policy-live-results.json`.

## Scope boundary

This policy does not prove deliverability, legal access, building entrance, occupancy, or driver safety. It does not replace privacy, retention, CSV-security, or operator-training requirements for a later application.
