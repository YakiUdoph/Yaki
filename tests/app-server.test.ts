import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createYakiServer } from "../src/app-server.ts";

async function withServer(
  callback: (baseUrl: string) => Promise<void>,
  options: Parameters<typeof createYakiServer>[0] = {},
) {
  const server = createYakiServer(options);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("server delivers the real homepage with privacy security headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /The last check before dispatch/u);
    assert.match(html, /Clear session/u);
    assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/u);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    const externalAssets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/giu)]
      .map((match) => match[1])
      .filter((value) => /^https?:/u.test(value));
    assert.deepEqual(externalAssets, []);
  });
});

test("HTTP API requires country and returns candidate evidence without credentials", async () => {
  let calls = 0;
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/geocode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "Springfield" }),
    });
    assert.equal(missing.status, 400);
    assert.equal(calls, 0);

    const wrongType = await fetch(`${baseUrl}/api/geocode`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "Springfield",
    });
    assert.equal(wrongType.status, 415);
    assert.equal(calls, 0);

    const response = await fetch(`${baseUrl}/api/geocode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "Springfield", countryCode: "us" }),
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.equal(text.includes("server-secret"), false);
    const body = JSON.parse(text);
    assert.equal(body.status, "needs_review");
    assert.equal(body.candidates.length, 2);
  }, {
    check: async () => {
      calls += 1;
      return {
        status: "needs_review",
        originalAddress: "Springfield",
        countryCode: "us",
        candidates: [
          { place_id: "one", formatted: "Springfield, IL" },
          { place_id: "two", formatted: "Springfield, MA" },
        ],
        policy: { version: "1.0.0", status: "review_required", readyForDispatch: false, reasons: ["multiple_candidates"] },
      };
    },
  });
});

test("HTTP API isolates failures and enforces a request rate limit", async () => {
  await withServer(async (baseUrl) => {
    const request = () => fetch(`${baseUrl}/api/geocode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "10 Downing Street", countryCode: "gb" }),
    });
    const first = await request();
    assert.equal(first.status, 502);
    const firstBody = await first.text();
    assert.equal(firstBody.includes("private-provider-detail"), false);
    const second = await request();
    assert.equal(second.status, 429);
  }, {
    rateLimit: { requests: 1, windowMs: 60_000 },
    check: async () => { throw new Error("private-provider-detail"); },
  });
});

test("static application exposes responsive and keyboard-accessible controls", async () => {
  const html = await readFile(fileURLToPath(new URL("../public/index.html", import.meta.url)), "utf8");
  const css = await readFile(fileURLToPath(new URL("../public/styles.css", import.meta.url)), "utf8");
  const app = await readFile(fileURLToPath(new URL("../public/app.js", import.meta.url)), "utf8");
  assert.match(html, /<meta name="viewport"/u);
  assert.match(html, /<a class="skip-link"/u);
  assert.match(html, /<dialog id="clear-dialog"/u);
  assert.match(html, /aria-live="polite"/u);
  assert.match(css, /@media \(max-width: 600px\)/u);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/u);
  assert.equal(/localStorage|sessionStorage/u.test(app), false);
  assert.equal(/innerHTML\s*=/u.test(app), false);
});
