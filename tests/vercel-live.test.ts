import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../api/geocode.ts";

const configuredKey = process.env.GEOAPIFY_API_KEY?.trim();

test("Vercel POST handler completes a real country-restricted Geoapify request", {
  skip: configuredKey ? false : "GEOAPIFY_API_KEY is not loaded; use npm run test:vercel-live.",
}, async () => {
  assert.ok(configuredKey);

  const response = await POST(new Request("https://yaki.example/api/geocode", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.25",
    },
    body: JSON.stringify({ address: "Springfield", countryCode: "us" }),
  }));
  const raw = await response.text();
  const body = JSON.parse(raw);

  assert.equal(response.status, 200);
  assert.equal(body.status, "needs_review");
  assert.equal(body.countryCode, "us");
  assert.ok(Array.isArray(body.candidates) && body.candidates.length > 1);
  assert.equal(body.policy.readyForDispatch, false);
  assert.equal(raw.includes(configuredKey), false);
});
