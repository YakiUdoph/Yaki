import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkAddress, publicCheckError, type AddressCheckResult } from "./app-service.ts";
import { getRuntimeConfig } from "./config.ts";
import { isCheckInput, MemoryRateLimiter, securityHeaders } from "./request-policy.ts";

type CheckOperation = (input: { address: string; countryCode: string }) => Promise<AddressCheckResult>;

export type AppServerOptions = {
  check?: CheckOperation;
  staticRoot?: string;
  rateLimit?: { requests: number; windowMs: number };
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, securityHeaders("application/json; charset=utf-8"));
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request: IncomingMessage, maxBytes = 16_384): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function serveStatic(
  requestPath: string,
  response: ServerResponse,
  staticRoot: string,
  headOnly = false,
): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    sendJson(response, 400, { error: "Invalid URL encoding" });
    return;
  }
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const root = resolve(staticRoot);
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("NOT_FILE");
    response.writeHead(200, securityHeaders(MIME_TYPES[extname(target)] || "application/octet-stream"));
    if (headOnly) response.end();
    else createReadStream(target).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

export function createYakiServer(options: AppServerOptions = {}) {
  const staticRoot = options.staticRoot || fileURLToPath(new URL("../public", import.meta.url));
  const limiter = new MemoryRateLimiter(
    options.rateLimit?.requests ?? 120,
    options.rateLimit?.windowMs ?? 60_000,
  );

  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, { status: "ok", persistence: "none" });
      return;
    }

    if (url.pathname === "/api/geocode" && request.method === "POST") {
      const client = request.socket.remoteAddress || "local";
      if (!limiter.allow(client)) {
        sendJson(response, 429, {
          status: "check_failed",
          error: { category: "rate_limit", message: "Too many checks. Wait a moment and retry.", retryable: true },
        });
        return;
      }
      try {
        if (!(request.headers["content-type"] || "").toLowerCase().includes("application/json")) {
          sendJson(response, 415, {
            status: "check_failed",
            error: { category: "input", message: "Request content type must be application/json.", retryable: false },
          });
          return;
        }
        const body = await readJson(request);
        if (!isCheckInput(body)) {
          sendJson(response, 400, {
            status: "check_failed",
            error: {
              category: "input",
              message: "Enter an address and select a destination country.",
              retryable: false,
            },
          });
          return;
        }
        if (!options.check) {
          sendJson(response, 503, {
            status: "check_failed",
            error: { category: "configuration", message: "Address checking is not configured.", retryable: false },
          });
          return;
        }
        sendJson(response, 200, await options.check(body));
      } catch (error) {
        if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
          sendJson(response, 413, { status: "check_failed", error: { category: "input", message: "Request is too large.", retryable: false } });
          return;
        }
        if (error instanceof Error && error.message === "INVALID_JSON") {
          sendJson(response, 400, { status: "check_failed", error: { category: "input", message: "Request body must be valid JSON.", retryable: false } });
          return;
        }
        sendJson(response, 502, publicCheckError(error));
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    await serveStatic(url.pathname, response, staticRoot, request.method === "HEAD");
  });
}

async function main(): Promise<void> {
  const config = await getRuntimeConfig();
  const port = Number(process.env.YAKI_PORT || 4173);
  const server = createYakiServer({
    check: (input) => checkAddress(input, config.apiKey, { baseUrl: config.apiBaseUrl }),
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Yaki is available at http://127.0.0.1:${port}`);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Yaki failed to start.");
    process.exitCode = 1;
  });
}
