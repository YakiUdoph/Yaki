import { jsonResponse } from "../src/request-policy.ts";

export function GET(): Response {
  return jsonResponse(200, { status: "ok", persistence: "none", runtime: "vercel-function" });
}

export function HEAD(): Response {
  return new Response(null, GET());
}
