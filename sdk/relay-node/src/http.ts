import { HttpResponse } from "./types";
import { hmacSign, nowUnixMs } from "./signing";

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
    "x-commandless-key": apiKey,
    "x-timestamp": String(nowUnixMs())
  };
  if (opts?.hmacSecret) headers["x-signature"] = hmacSign(json, opts.hmacSecret);
  if (opts?.idempotencyKey) headers["x-idempotency-key"] = opts.idempotencyKey;

  try {
    const res = await fetch(url, { method: "POST", body: json, headers, signal: controller.signal });
    const requestId = res.headers.get("x-request-id") ?? undefined;
    if (!res.ok) {
      const text = await safeText(res);
      return { ok: false, status: res.status, error: text, requestId };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data, requestId };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ""; }
}

