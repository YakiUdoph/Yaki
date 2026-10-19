import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAddress, publicCheckError } from "../src/app-service.ts";
import { HttpResponseError, type FetchLike } from "../src/geoapify.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("application check sends the selected country and never marks a candidate ready", async () => {
  let countryRestriction: string | null = null;
  const fetchImpl: FetchLike = async (input) => {
    const url = new URL(String(input));
    countryRestriction = url.searchParams.get("countrycodes");
    return jsonResponse({
      results: [{
        formatted: "Springfield, IL, United States",
        place_id: "springfield-il",
        country_code: "us",
        lat: 39.799,
        lon: -89.644,
        rank: { confidence: 1, match_type: "full_match" },
      }],
      query: { parsed: { city: "springfield" } },
    });
  };
  const result = await checkAddress(
    { address: "Springfield", countryCode: "US" },
    "fake-test-key",
    { fetchImpl },
  );
  assert.equal(countryRestriction, "us");
  assert.equal(result.status, "needs_review");
  assert.equal(result.policy.readyForDispatch, false);
  assert.ok(result.policy.reasons.includes("human_confirmation_required"));
});

test("application check preserves a successful zero-candidate response as no match", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ results: [], query: { parsed: {} } });
  const result = await checkAddress(
    { address: "nonsense", countryCode: "gb" },
    "fake-test-key",
    { fetchImpl },
  );
  assert.equal(result.status, "no_match");
  assert.equal(result.candidates.length, 0);
});

test("public errors do not expose provider or credential details", () => {
  const result = publicCheckError(
    new HttpResponseError(401, "Authorization: ApiKey real-secret apiKey=real-secret"),
  );
  assert.equal(result.status, "check_failed");
  assert.equal(JSON.stringify(result).includes("real-secret"), false);
  assert.equal(result.error.retryable, false);
});
