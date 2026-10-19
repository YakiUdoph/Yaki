import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HttpResponseError,
  InputValidationError,
  JsonRpcResponseError,
  McpToolResponseError,
  NetworkRequestError,
  callMcp,
  geocodeDirect,
  geocodeMcp,
  requestJson,
  redactSensitiveText,
  type FetchLike,
} from "../src/geoapify.ts";
import {
  evaluateLocationPolicy,
  requireSelectedCountry,
} from "../src/location-policy.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("direct geocoding keeps the key in a header and preserves evidence", async () => {
  const secret = "test-secret-never-log";
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.has("apiKey"), false);
    assert.equal(new Headers(init?.headers).get("x-api-key"), secret);
    return jsonResponse({
      results: [
        {
          formatted: "Example address",
          lon: 13.4,
          lat: 52.5,
          place_id: "example-place",
          result_type: "building",
          rank: {
            confidence: 0.8,
            confidence_city_level: 1,
            confidence_street_level: 0.9,
            confidence_building_level: 0.6,
            match_type: "match_by_building",
          },
        },
      ],
      query: { parsed: { street: "example", expected_type: "building" } },
    });
  };

  const evidence = await geocodeDirect("Example", secret, { fetchImpl, maxRetries: 0 });
  assert.equal(evidence.candidates[0].match_type, "match_by_building");
  assert.equal(evidence.candidates[0].confidence, 0.8);
  assert.deepEqual(evidence.parsedQuery, { street: "example", expected_type: "building" });
});

test("invalid direct input is rejected without a network call", async () => {
  let called = false;
  const fetchImpl: FetchLike = async () => {
    called = true;
    return jsonResponse({});
  };
  await assert.rejects(
    geocodeDirect("   ", "secret", { fetchImpl }),
    InputValidationError,
  );
  assert.equal(called, false);
});

test("direct country bias is explicit and selectable", async () => {
  const biases: Array<string | null> = [];
  const fetchImpl: FetchLike = async (input) => {
    biases.push(new URL(String(input)).searchParams.get("bias"));
    return jsonResponse({ results: [], query: { parsed: {} } });
  };

  await geocodeDirect("Springfield", "fake-test-key", { fetchImpl, maxRetries: 0 });
  await geocodeDirect("Springfield", "fake-test-key", {
    countryBias: "auto",
    fetchImpl,
    maxRetries: 0,
  });

  assert.deepEqual(biases, ["countrycode:none", "countrycode:auto"]);
});

test("network failures are retried in a bounded way then classified", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    throw new TypeError("controlled network failure");
  };
  await assert.rejects(
    requestJson("https://invalid.test", {}, {
      fetchImpl,
      maxRetries: 2,
      baseDelayMs: 10,
      sleepImpl: async (delay) => void delays.push(delay),
    }),
    NetworkRequestError,
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("HTTP 429 honors Retry-After without exhausting a live quota", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ message: "controlled quota response" }, 429, { "retry-after": "2" });
    return jsonResponse({ ok: true });
  };
  const body = await requestJson("https://example.test", {}, {
    fetchImpl,
    maxRetries: 1,
    sleepImpl: async (delay) => void delays.push(delay),
  });
  assert.deepEqual(body, { ok: true });
  assert.deepEqual(delays, [2000]);
});

test("HTTP failures remain distinct from JSON-RPC and MCP tool failures", async (context) => {
  await context.test("HTTP error", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ message: "unauthorized" }, 401);
    await assert.rejects(
      callMcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "bad", {
        fetchImpl,
        maxRetries: 0,
      }),
      HttpResponseError,
    );
  });

  await context.test("JSON-RPC error", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Invalid params" } });
    await assert.rejects(
      callMcp({ jsonrpc: "2.0", id: 1, method: "tools/call" }, "secret", { fetchImpl }),
      JsonRpcResponseError,
    );
  });

  await context.test("MCP tool error", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { content: [], isError: true } });
    await assert.rejects(
      callMcp({ jsonrpc: "2.0", id: 1, method: "tools/call" }, "secret", { fetchImpl }),
      McpToolResponseError,
    );
  });
});

test("MCP authentication modes follow the current official documentation", async () => {
  const seen: Array<{ url: URL; headers: Headers }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    seen.push({ url: new URL(String(input)), headers: new Headers(init?.headers) });
    return jsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } });
  };

  for (const authMode of ["x-api-key", "authorization", "query"] as const) {
    await callMcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "fake-test-key", {
      authMode,
      fetchImpl,
    });
  }

  assert.equal(seen[0].headers.get("x-api-key"), "fake-test-key");
  assert.equal(seen[0].url.searchParams.has("apiKey"), false);
  assert.equal(seen[1].headers.get("authorization"), "ApiKey fake-test-key");
  assert.equal(seen[2].url.searchParams.get("apiKey"), "fake-test-key");
});

test("a terminal mocked 500 is classified as an HTTP failure", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ message: "controlled server error" }, 500);
  await assert.rejects(
    requestJson("https://example.test", {}, { fetchImpl, maxRetries: 0 }),
    (error: unknown) => error instanceof HttpResponseError && error.status === 500,
  );
});

test("credential-like values are redacted from diagnostic text", () => {
  const text = redactSensitiveText(
    "url=?apiKey=real-looking-value x-api-key: another-value Authorization: ApiKey third-value",
  );
  assert.equal(text.includes("real-looking-value"), false);
  assert.equal(text.includes("another-value"), false);
  assert.equal(text.includes("third-value"), false);
  assert.equal((text.match(/\[REDACTED\]/gu) || []).length, 3);
});

test("selected country restriction is applied to direct and MCP requests", async () => {
  let directCountry: string | null = null;
  let mcpCountryCodes: unknown;
  const directFetch: FetchLike = async (input) => {
    directCountry = new URL(String(input)).searchParams.get("countrycodes");
    return jsonResponse({ results: [], query: { parsed: {} } });
  };
  const mcpFetch: FetchLike = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      params: { arguments: { country_codes?: unknown } };
    };
    mcpCountryCodes = request.params.arguments.country_codes;
    return jsonResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [],
        structuredContent: { query: "Springfield", count: 0, results: [] },
        isError: false,
      },
    });
  };

  await geocodeDirect("Springfield", "fake-test-key", {
    countryCode: "US",
    fetchImpl: directFetch,
  });
  await geocodeMcp("Springfield", "fake-test-key", {
    countryCode: "US",
    fetchImpl: mcpFetch,
  });

  assert.equal(directCountry, "us");
  assert.deepEqual(mcpCountryCodes, ["us"]);
});

test("batch processing requires an operator-selected country", () => {
  assert.throws(
    () => requireSelectedCountry("batch", undefined),
    InputValidationError,
  );
  assert.equal(requireSelectedCountry("batch", "GB"), "gb");
});

test("multiple candidates remain preserved and require human review", () => {
  const decision = evaluateLocationPolicy({
    processingMode: "batch",
    selectedCountryCode: "us",
    direct: {
      source: "direct",
      candidates: [
        { place_id: "springfield-il", country_code: "us", confidence: 1 },
        { place_id: "springfield-ma", country_code: "us", confidence: 1 },
      ],
    },
  });

  assert.equal(decision.status, "review_required");
  assert.equal(decision.readyForDispatch, false);
  assert.equal(decision.evidence.directCandidates.length, 2);
  assert.ok(decision.reasons.includes("multiple_candidates"));
  assert.ok(decision.reasons.includes("human_confirmation_required"));
});

test("empty provider results require clarification", () => {
  const decision = evaluateLocationPolicy({
    processingMode: "single",
    selectedCountryCode: "us",
    direct: { source: "direct", candidates: [] },
    mcp: { source: "mcp", candidates: [] },
  });

  assert.equal(decision.status, "clarification_required");
  assert.equal(decision.readyForDispatch, false);
  assert.ok(decision.reasons.includes("no_candidates"));
});

test("missing candidate country information requires clarification", () => {
  const decision = evaluateLocationPolicy({
    processingMode: "single",
    selectedCountryCode: "us",
    direct: {
      source: "direct",
      candidates: [{ place_id: "country-unknown", confidence: 1 }],
    },
  });

  assert.equal(decision.status, "clarification_required");
  assert.equal(decision.readyForDispatch, false);
  assert.ok(decision.reasons.includes("candidate_country_missing"));
});

test("conflicting provider outputs are preserved and flagged", () => {
  const decision = evaluateLocationPolicy({
    processingMode: "single",
    selectedCountryCode: "us",
    direct: {
      source: "direct",
      candidates: [{ place_id: "springfield-il", country_code: "us", confidence: 1 }],
    },
    mcp: {
      source: "mcp",
      candidates: [{ place_id: "springfield-vt", country_code: "us", confidence: 1 }],
    },
  });

  assert.equal(decision.providerDisagreement, true);
  assert.equal(decision.readyForDispatch, false);
  assert.equal(decision.evidence.directCandidates[0].place_id, "springfield-il");
  assert.equal(decision.evidence.mcpCandidates[0].place_id, "springfield-vt");
  assert.ok(decision.reasons.includes("provider_disagreement"));
});

test("coordinates and maximum confidence never auto-approve dispatch", () => {
  const candidate = {
    place_id: "candidate-1",
    country_code: "gb",
    lon: -0.1276965,
    lat: 51.5034878,
    confidence: 1,
  };
  const unconfirmed = evaluateLocationPolicy({
    processingMode: "single",
    selectedCountryCode: "gb",
    direct: { source: "direct", candidates: [candidate] },
    selectedCandidatePlaceId: candidate.place_id,
  });
  const confirmed = evaluateLocationPolicy({
    processingMode: "single",
    selectedCountryCode: "gb",
    direct: { source: "direct", candidates: [candidate] },
    selectedCandidatePlaceId: candidate.place_id,
    humanConfirmed: true,
  });

  assert.equal(unconfirmed.readyForDispatch, false);
  assert.equal(unconfirmed.status, "review_required");
  assert.equal(confirmed.readyForDispatch, true);
  assert.equal(confirmed.status, "ready");
});
