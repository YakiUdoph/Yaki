# Geoapify MCP feasibility

Assessment date: 2026-10-18.

The practical question was not whether MCP could call a geocoder—it could—but whether it added trustworthy evidence that the direct API did not already provide. The answer from the published contracts and the small authenticated trial was narrower: MCP is useful for runtime tool discovery and traceable multi-step experiments, but its address result is a compact view of the same underlying kind of evidence, with fewer controls and no separate deliverability verdict.

The findings below combine official [MCP guidance](https://apidocs.geoapify.com/docs/mcp/), the [tool catalog](https://apidocs.geoapify.com/mcp), the machine-readable [MCP tool specification index](https://apidocs.geoapify.com/assets/openapi/specs/mcp/tools/index.json), focused tool specifications, and authenticated Phase 2 contract tests. Published behavior and live observations are identified separately where that distinction matters.

## Transport and protocol

- Endpoint: `POST https://api.geoapify.com/v1/mcp`
- Content type: `application/json`
- Protocol: JSON-RPC 2.0 over remote Streamable HTTP
- Documented methods: `initialize`, `tools/list`, `tools/call`, and notifications
- Optional `MCP-Protocol-Version` header; omitted requests default to `2025-06-18`; explicitly unsupported versions are rejected
- `initialize`, `tools/list`, and notifications cost zero credits; `tools/call` uses the underlying Geoapify action's pricing with no separate MCP surcharge

Clients should run `initialize` and `tools/list` at test time and archive the discovered schemas. The documentation explicitly says runtime `tools/list` is the current source for names and schemas.

## Authentication methods and Phase 2 update

The current human MCP guide rechecked on 2026-10-18 explicitly documents three methods: query parameter `apiKey`, header `x-api-key`, and `Authorization: ApiKey ...`. It also states that OAuth is not supported and that its OpenAPI/Swagger uses query authentication. This supersedes the earlier observation in this discovery pass that downloaded 1.1.0 files declared only `x-api-key`; either the published material changed during the assessment or the previously downloaded files represented a different revision.

Recommended behavior:

1. Prefer `x-api-key` because it avoids URL leakage.
2. In the experiment, separately verify all three documented methods using `tools/list`, without logging request targets or secrets.
3. Treat failure of one documented method as a documentation/contract result, not as geographic uncertainty.
4. Never fall back by placing a key in a client-visible URL in production.

The TypeScript harness encodes and mock-tests all three request shapes. On 2026-10-18, live `tools/list` calls authenticated successfully with all three documented forms and each discovered 11 tools. The normal Yaki path still prefers `x-api-key`; query authentication was verified only for contract coverage.

## Address-investigation tools

### `geocode_address`

Focused specification and reference: [Geocode Address](https://apidocs.geoapify.com/docs/mcp/geocode-address/)

Input (`additionalProperties: false`):

- Required `query`: string, length 1–1024
- Optional `limit`: integer 1–10
- Optional `lang`: supported two-letter language code, default documented as `en`
- Optional `country_codes`: up to 10 ISO 3166-1 alpha-2 codes according to the common-arguments documentation

Output `structuredContent`: required `query`, `count`, and `results`. Each result may contain formatted/address-line fields, coordinates, `place_id`, `result_type`, `rank` (confidence fields, match type, importance, popularity), a duplicate top-level `confidence`, common address components, timezone, and bounding box. Results are ordered by relevance.

### `geocode_structured_address`

Focused specification and reference: [Geocode Structured Address](https://apidocs.geoapify.com/docs/mcp/geocode-structured-address/)

Input (`additionalProperties: false`): optional `name`, `housenumber`, `street`, `postcode`, `city`, `state`, `country` (each length 1–1024), `country_codes`, `limit` (1–10), and `lang`. The published schema lists **no required address property**, although guidance says to include `street` when `housenumber` is supplied. Empty input behavior is unresolved and must be contract-tested; Yaki should reject an empty address before calling.

Output `structuredContent`: required normalized `address`, `count`, and `results`, using the same compact result shape as `geocode_address`.

### `reverse_geocode_coordinates`

Focused specification and reference: [Reverse Geocode Coordinates](https://apidocs.geoapify.com/docs/mcp/reverse-geocode/)

Input (`additionalProperties: false`): required `lat` (-90–90) and `lon` (-180–180); optional `limit` (1–10), `lang`, `country_codes`, and `type` (`country`, `state`, `city`, `postcode`, `street`, `amenity`, `locality`, or `building`).

Output `structuredContent`: required `coordinates`, `count`, and `results`, plus optional requested `type`. Result fields match the compact geocoding result shape.

### Adjacent investigation tools

- `search_places`: requires one exact supported `category`, `lat`, and `lon`; optional `radius_meters` (minimum 1), `limit` (1–100), and `lang`. It returns category, center coordinates, optional radius, count, and place results ordered by proximity/relevance. It can add nearby landmark context after geocoding, but does not validate the destination.
- `list_place_categories`: accepts no arguments and returns valid names for `search_places`.
- `calculate_route`: can test route connectivity from a depot to a chosen coordinate; it does not establish entrance access or delivery suitability.
- `calculate_route_matrix`: can compare travel times/distances for known coordinates; it returns no route geometry or turn instructions.

The geometry utilities are real MCP tools but are not needed for the address MVP unless a later, well-defined spatial check requires them.

## Response and error model

A successful `tools/call` JSON-RPC response contains:

- `result.content[]`: text blocks whose text is a JSON-encoded copy of the structured output;
- `result.structuredContent`: the tool-specific object;
- `result.isError: false`.

Tool execution or argument-validation failures can still use HTTP `200`, with `result.isError: true`; the text content contains a JSON-encoded gateway error (`statusCode`, `error`, `message`). JSON-RPC protocol errors instead use top-level `error` with numeric `code`, human-readable `message`, and optional `data`; documented examples include `-32600`, `-32601`, and `-32602`.

Transport-level failures use HTTP status:

- `400`: malformed HTTP request or unsupported protocol version
- `401`: missing/invalid key
- `429`: rate or quota exceeded
- `500`: internal gateway failure

Code must evaluate HTTP status, JSON-RPC `error`, and `result.isError`; checking only HTTP `200` would create false successes.

## Direct API versus MCP

| Aspect | Direct API | MCP |
|---|---|---|
| Address capability | Free-form, structured, reverse | Corresponding three tools |
| Candidate limit | Up to 100 | Up to 10 |
| Filters/bias | Rich `filter` and `bias` contract | Geocoding tools expose country filters only |
| Result detail | Full JSON/GeoJSON/XML contract, including parsed query and datasource | Curated compact structured output |
| Batch | Dedicated and generic async endpoints, up to 1000 inputs; dedicated geocoding normalizes to one result per input | No documented batch-address MCP tool |
| Discovery | Static OpenAPI operations | Runtime `tools/list` plus OpenAPI |
| Orchestration | Application code must chain calls | An agent can choose and chain geocoding, places, routing, and geometry tools |
| Error envelope | HTTP + gateway JSON | HTTP + JSON-RPC + tool error layer |

### Can MCP provide more than direct address lookup?

**For the address lookup itself: no verified enrichment.** The MCP geocoding output is a curated subset/reshaping of information available from direct geocoding and imposes a lower candidate maximum. No MCP-specific deliverability or independent validation field is documented.

**For an investigation workflow: potentially, but only through orchestration.** An agent can follow a geocode with category-based nearby-place search or routing. Those observations may give human context (for example, nearby landmarks or whether a road route is returned), but they must be displayed as separate evidence. They cannot be converted into a claim that the address is correct or deliverable.

MCP's meaningful value to Yaki is therefore experimental and operational: runtime tool discovery, transparent agent tool traces, and controlled multi-step investigation. Direct API remains the stronger production path for deterministic bulk processing and complete response evidence.

## Limitations and unresolved items

- All three documented authentication shapes are covered by controlled tests and succeeded in live `tools/list` calls.
- No MCP bulk geocoding tool is documented.
- No MCP address-verification/deliverability tool is documented.
- The structured tool permits an empty object at schema level; runtime behavior is unverified.
- Exact default values are described in prose but are not consistently encoded on every focused schema property.
- Tool availability may change; archive `tools/list` output with each experiment.
- The Phase 2 live trial found exact direct/MCP agreement for the complete and incomplete examples, zero results on both paths for the nonsense input, and materially different behavior for the ambiguous `Springfield` input. This single run does not establish comparative accuracy, latency, or determinism.
- A focused remediation run applied the same operator-selected US restriction to both paths. They returned the same five Springfield city candidates in the same order. This verifies the restriction contract for one public case, not general accuracy.
