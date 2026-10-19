import { jsonResponse } from "../src/request-policy.ts";

export default {
  fetch(request: Request): Response {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse(405, { error: "Method not allowed" }, { allow: "GET, HEAD" });
    }
    const response = jsonResponse(200, { status: "ok", persistence: "none", runtime: "vercel-function" });
    return request.method === "HEAD" ? new Response(null, response) : response;
  },
};
