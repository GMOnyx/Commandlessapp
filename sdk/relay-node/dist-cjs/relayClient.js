"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayClient = void 0;
const http_js_1 = require("./http.js");
const DEFAULT_BASE = "https://commandless-app-production.up.railway.app";
class RelayClient {
    constructor(opts) {
        this.maxRetries = 3;
        this.queue = [];
        this.sending = false;
        this.apiKey = opts.apiKey;
        let base = opts.baseUrl ?? DEFAULT_BASE;
        // Auto-add https:// if no protocol provided
        if (base && !base.match(/^https?:\/\//)) {
            base = `https://${base}`;
        }
        this.baseUrl = base.replace(/\/$/, "");
        this.hmacSecret = opts.hmacSecret;
        this.timeoutMs = opts.timeoutMs ?? 15000;
    }
    // Optional: register this SDK bot and obtain/confirm botId
    async registerBot(info) {
        try {
            const url = `${this.baseUrl}/v1/relay/register`;
            console.log(`[commandless] registerBot URL: ${url}`);
            console.log(`[commandless] registerBot payload:`, { ...info, botId: info.botId });
            const res = await (0, http_js_1.postJson)(url, this.apiKey, info, {
                hmacSecret: this.hmacSecret,
                timeoutMs: this.timeoutMs,
            });
            if (res.ok && res.data?.botId) {
                this.botId = res.data.botId;
                return this.botId;
            }
            // Log error for debugging
            if (!res.ok) {
                console.error(`[commandless] registerBot failed: ${res.status} ${res.error || 'Unknown error'}`);
            }
            else if (!res.data?.botId) {
                console.error(`[commandless] registerBot: response missing botId`, res.data);
            }
            return null;
        }
        catch (err) {
            console.error(`[commandless] registerBot exception:`, err?.message || err);
            console.error(`[commandless] Full error:`, err);
            return null;
        }
    }
    // Optional heartbeat to show online status
    async heartbeat() {
        try {
            const url = `${this.baseUrl}/v1/relay/heartbeat`;
            const res = await (0, http_js_1.postJson)(url, this.apiKey, { botId: this.botId }, {
                hmacSecret: this.hmacSecret,
                timeoutMs: this.timeoutMs,
            });
            // Return server response to caller (index.js checks syncRequested)
            return res.data;
        }
        catch { }
    }
    async sendEvent(event) {
        // Immediate send with retries and idempotency
        if (this.botId)
            event.botId = this.botId;
        return await this.sendWithRetry(event);
    }
    enqueue(event) {
        this.queue.push(event);
        if (!this.sending)
            void this.drain();
    }
    async drain() {
        this.sending = true;
        while (this.queue.length) {
            const evt = this.queue.shift();
            try {
                await this.sendWithRetry(evt);
            }
            catch { /* swallow to keep draining */ }
        }
        this.sending = false;
    }
    async sendWithRetry(event) {
        const url = `${this.baseUrl}/v1/relay/events`;
        const idem = makeIdempotencyKey(event);
        let lastErr;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const res = await (0, http_js_1.postJson)(url, this.apiKey, event, {
                hmacSecret: this.hmacSecret,
                timeoutMs: this.timeoutMs,
                idempotencyKey: idem,
            });
            if (res.ok)
                return res.data?.decision ?? null;
            lastErr = new Error(`Commandless error (${res.status}): ${res.error ?? "unknown"}`);
            // basic backoff
            await sleep(200 * (attempt + 1));
        }
        throw lastErr;
    }
}
exports.RelayClient = RelayClient;
function makeIdempotencyKey(event) {
    // Simple stable key: type-id-timestamp buckets (can be improved)
    const base = `${event.type}:${event.id}:${Math.floor(event.timestamp / 1000)}`;
    return Buffer.from(base).toString("base64url");
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
