import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AddressApiRequestError,
  GEOCODE_API_PATH,
  requestAddressCheck,
} from "../public/api-client.js";

test("browser API client posts only to the deployed same-origin geocode route", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const result = await requestAddressCheck(
    { address: "Springfield", countryCode: "us" },
    async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = String(url);
      requestedInit = init;
      return Response.json({ status: "needs_review", candidates: [] });
    },
  );

  assert.equal(GEOCODE_API_PATH, "/api/geocode");
  assert.equal(requestedUrl, "/api/geocode");
  assert.equal(requestedInit?.method, "POST");
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    address: "Springfield",
    countryCode: "us",
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.status, "needs_review");
});

test("browser API client preserves Vercel HTTP diagnostics for non-JSON failures", async () => {
  await assert.rejects(
    requestAddressCheck(
      { address: "Springfield", countryCode: "us" },
      async () => new Response("A server error has occurred", {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-vercel-error": "FUNCTION_INVOCATION_FAILED",
          "x-vercel-id": "fra1::request-id",
        },
      }),
    ),
    (error: unknown) => {
      assert.equal(error instanceof AddressApiRequestError, true);
      const failure = error as AddressApiRequestError;
      assert.match(failure.publicError.message, /HTTP 500, FUNCTION_INVOCATION_FAILED/u);
      assert.deepEqual(failure.diagnostics, {
        endpoint: "/api/geocode",
        failure: "non_json_response",
        status: 500,
        platformCode: "FUNCTION_INVOCATION_FAILED",
        requestId: "fra1::request-id",
        contentType: "text/plain; charset=utf-8",
      });
      assert.equal(failure.publicError.message.includes("A server error has occurred"), false);
      return true;
    },
  );
});

test("browser API client distinguishes network failure from an HTTP response", async () => {
  await assert.rejects(
    requestAddressCheck(
      { address: "Springfield", countryCode: "us" },
      async () => { throw new Error("socket detail"); },
    ),
    (error: unknown) => {
      assert.equal(error instanceof AddressApiRequestError, true);
      const failure = error as AddressApiRequestError;
      assert.equal(failure.publicError.category, "network");
      assert.equal(failure.diagnostics.failure, "network");
      assert.equal(failure.publicError.message.includes("local"), false);
      return true;
    },
  );
});
