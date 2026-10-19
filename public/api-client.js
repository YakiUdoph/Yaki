export const GEOCODE_API_PATH = "/api/geocode";

export class AddressApiRequestError extends Error {
  constructor(message, publicError, diagnostics) {
    super(message);
    this.name = "AddressApiRequestError";
    this.publicError = publicError;
    this.diagnostics = diagnostics;
  }
}

function header(response, name) {
  return response.headers?.get?.(name) || undefined;
}

export async function requestAddressCheck(input, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl(GEOCODE_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (cause) {
    throw new AddressApiRequestError(
      "The address API request did not reach the server.",
      {
        category: "network",
        message: "Yaki could not reach the address-checking service. Check your connection, then retry.",
        retryable: true,
      },
      {
        endpoint: GEOCODE_API_PATH,
        failure: "network",
        cause: cause instanceof Error ? cause.message : "Unknown network failure",
      },
    );
  }

  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    const platformCode = header(response, "x-vercel-error");
    const detail = platformCode ? `, ${platformCode}` : "";
    throw new AddressApiRequestError(
      `The address API returned a non-JSON HTTP ${response.status} response.`,
      {
        category: "server",
        message: `The address-checking service failed (HTTP ${response.status}${detail}). Retry shortly; if it continues, report this error.`,
        retryable: response.status >= 500,
      },
      {
        endpoint: GEOCODE_API_PATH,
        failure: "non_json_response",
        status: response.status,
        platformCode,
        requestId: header(response, "x-vercel-id"),
        contentType: header(response, "content-type"),
      },
    );
  }

  if (!body || typeof body !== "object") {
    throw new AddressApiRequestError(
      "The address API returned an invalid JSON payload.",
      {
        category: "server",
        message: `The address-checking service returned an invalid response (HTTP ${response.status}). Retry shortly.`,
        retryable: response.status >= 500,
      },
      {
        endpoint: GEOCODE_API_PATH,
        failure: "invalid_json_payload",
        status: response.status,
        requestId: header(response, "x-vercel-id"),
      },
    );
  }

  return { response, body };
}
