import { HttpResponse } from "./types.js";
import { hmacSign, nowUnixMs } from "./signing.js";

export async function postJson<T>(
  url: string,
  apiKey: string,
  body: unknown,
  opts?: { hmacSecret?: string; timeoutMs?: number; idempotencyKey?: string }
): Promise<HttpResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000);
  const json = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Use canonical header expected by the server; keep legacy for compatibility
    "x-api-key": apiKey,
    "x-commandless-key": apiKey,
    "x-timestamp": String(nowUnixMs())
  };
  if (opts?.hmacSecret) headers["x-signature"] = hmacSign(json, opts.hmacSecret);
  if (opts?.idempotencyKey) headers["x-idempotency-key"] = opts.idempotencyKey;

  try {
    console.log(`[commandless] postJson: ${url.substring(0, 50)}...`);
    const res = await fetch(url, { method: "POST", body: json, headers, signal: controller.signal });
    const requestId = res.headers.get("x-request-id") ?? undefined;
    if (!res.ok) {
      const text = await safeText(res);
      console.error(`[commandless] postJson failed: ${res.status} ${text.substring(0, 200)}`);
      return { ok: false, status: res.status, error: text, requestId };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data, requestId };
  } catch (err: any) {
    console.error(`[commandless] postJson fetch error:`, err?.message || err);
    console.error(`[commandless] postJson URL was:`, url);
    return { ok: false, status: 0, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ""; }
}

