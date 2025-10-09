"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postJson = postJson;
const signing_js_1 = require("./signing.js");
async function postJson(url, apiKey, body, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000);
    const json = JSON.stringify(body);
    const headers = {
        "content-type": "application/json",
        // Use canonical header expected by the server; keep legacy for compatibility
        "x-api-key": apiKey,
        "x-commandless-key": apiKey,
        "x-timestamp": String((0, signing_js_1.nowUnixMs)())
    };
    if (opts?.hmacSecret)
        headers["x-signature"] = (0, signing_js_1.hmacSign)(json, opts.hmacSecret);
    if (opts?.idempotencyKey)
        headers["x-idempotency-key"] = opts.idempotencyKey;
    try {
        const res = await fetch(url, { method: "POST", body: json, headers, signal: controller.signal });
        const requestId = res.headers.get("x-request-id") ?? undefined;
        if (!res.ok) {
            const text = await safeText(res);
            return { ok: false, status: res.status, error: text, requestId };
        }
        const data = (await res.json());
        return { ok: true, status: res.status, data, requestId };
    }
    catch (err) {
        return { ok: false, status: 0, error: err?.message ?? String(err) };
    }
    finally {
        clearTimeout(timeout);
    }
}
async function safeText(res) {
    try {
        return await res.text();
    }
    catch {
        return "";
    }
}
