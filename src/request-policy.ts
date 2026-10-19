export const MAX_JSON_BODY_BYTES = 16_384;

export type CheckInput = { address: string; countryCode: string };

export class MemoryRateLimiter {
  readonly requests: number;
  readonly windowMs: number;
  readonly maxEntries: number;
  readonly entries = new Map<string, number[]>();

  constructor(requests: number, windowMs: number, maxEntries = 10_000) {
    this.requests = requests;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.entries.get(key) || []).filter((value) => value > cutoff);
    if (recent.length >= this.requests) {
      this.entries.set(key, recent);
      return false;
    }
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      for (const [entryKey, values] of this.entries) {
        if (values.every((value) => value <= cutoff)) this.entries.delete(entryKey);
        if (this.entries.size < this.maxEntries) break;
      }
      const oldest = this.entries.keys().next().value;
      if (this.entries.size >= this.maxEntries && oldest !== undefined) this.entries.delete(oldest);
    }
    recent.push(now);
    this.entries.set(key, recent);
    return true;
  }
}

export function isCheckInput(value: unknown): value is CheckInput {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.address === "string" &&
    record.address.trim().length >= 1 &&
    record.address.trim().length <= 1024 &&
    typeof record.countryCode === "string" &&
    /^[A-Za-z]{2}$/u.test(record.countryCode.trim())
  );
}

export function securityHeaders(contentType?: string): Record<string, string> {
  return {
    ...(contentType ? { "content-type": contentType } : {}),
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

export function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(`${JSON.stringify(body)}\n`, {
    status,
    headers: { ...securityHeaders("application/json; charset=utf-8"), ...extraHeaders },
  });
}

export function requestClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isCrossSiteRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}
