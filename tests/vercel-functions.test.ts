import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as healthGET, HEAD as healthHEAD } from "../api/health.ts";
import { POST, createGeocodeFunction } from "../api/geocode.ts";
import { MemoryRateLimiter } from "../src/request-policy.ts";

const result = {
  status: "needs_review" as const,
  originalAddress: "Springfield",
  countryCode: "us",
  candidates: [
    { place_id: "one", formatted: "Springfield, IL" },
    { place_id: "two", formatted: "Springfield, MA" },
  ],
  policy: {
    version: "1.0.0",
    status: "review_required",
    readyForDispatch: false as const,
    reasons: ["multiple_candidates", "human_confirmation_required"],
  },
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://yaki.example/api/geocode", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("Vercel geocode function preserves the address-review contract", async () => {
  assert.equal(typeof POST, "function");
  let calls = 0;
  const fetch = createGeocodeFunction({
    limiter: new MemoryRateLimiter(10, 60_000),
    check: async (input, signal) => {
      calls += 1;
      assert.deepEqual(input, { address: "Springfield", countryCode: "us" });
      assert.equal(signal instanceof AbortSignal, true);
      return result;
    },
  });
  const response = await fetch(request({ address: "Springfield", countryCode: "us" }));
  const raw = await response.text();
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(raw.includes("GEOAPIFY_API_KEY"), false);
  assert.equal(JSON.parse(raw).policy.readyForDispatch, false);
  assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/u);
});

test("Vercel geocode function rejects cross-site, malformed, oversized, and wrong-method requests", async () => {
  let calls = 0;
  const fetch = createGeocodeFunction({
    limiter: new MemoryRateLimiter(20, 60_000),
    check: async () => { calls += 1; return result; },
  });
  const crossSite = await fetch(request({ address: "Springfield", countryCode: "us" }, {
    origin: "https://attacker.example",
    "sec-fetch-site": "cross-site",
  }));
  assert.equal(crossSite.status, 403);

  const malformed = await fetch(request("{"));
  assert.equal(malformed.status, 400);

  const oversized = await fetch(request("{}", { "content-length": "20000" }));
  assert.equal(oversized.status, 413);

  const wrongMethod = await fetch(new Request("https://yaki.example/api/geocode"));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal(calls, 0);
});

test("Vercel geocode function applies a bounded per-instance rate limit", async () => {
  const fetch = createGeocodeFunction({
    limiter: new MemoryRateLimiter(1, 60_000),
    check: async () => result,
  });
  assert.equal((await fetch(request({ address: "Springfield", countryCode: "us" }))).status, 200);
  const limited = await fetch(request({ address: "Springfield", countryCode: "us" }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("Vercel health function exposes no secret through GET and HEAD", async () => {
  const response = healthGET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    persistence: "none",
    runtime: "vercel-function",
  });
  const head = healthHEAD();
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});
