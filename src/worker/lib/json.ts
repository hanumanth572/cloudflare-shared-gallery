/** JSON response helpers shared by all API routes. */

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...toRecord(headers) },
  });
}

export function error(message: string, status: number, headers?: HeadersInit): Response {
  return json({ error: message }, status, headers);
}

export function noContent(headers?: HeadersInit): Response {
  return new Response(null, { status: 204, headers });
}

function toRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}

/** Reads a JSON body, returning null when the body is missing or malformed. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
