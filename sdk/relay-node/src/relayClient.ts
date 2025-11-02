import { Decision, RelayClientOptions, RelayEvent } from "./types.js";
import { postJson } from "./http.js";

const DEFAULT_BASE = "https://commandless-app-production.up.railway.app";

export class RelayClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly hmacSecret?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries = 3;
  private readonly queue: Array<RelayEvent> = [];
  private sending = false;
  private botId?: string;

  constructor(opts: RelayClientOptions) {
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
  async registerBot(info: { platform: 'discord'; name?: string; clientId?: string; botId?: number }): Promise<string | null> {
    try {
      const url = `${this.baseUrl}/v1/relay/register`;
      console.log(`[commandless] registerBot URL: ${url}`);
      console.log(`[commandless] registerBot payload:`, { ...info, botId: info.botId });
      const res = await postJson<{ botId: string }>(url, this.apiKey, info, {
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
      } else if (!res.data?.botId) {
        console.error(`[commandless] registerBot: response missing botId`, res.data);
      }
      return null;
    } catch (err: any) {
      console.error(`[commandless] registerBot exception:`, err?.message || err);
      console.error(`[commandless] Full error:`, err);
      return null;
    }
  }

  // Optional heartbeat to show online status
  async heartbeat(): Promise<void> {
    try {
      const url = `${this.baseUrl}/v1/relay/heartbeat`;
      const res = await postJson<{ ok: boolean; syncRequested?: boolean }>(url, this.apiKey, { botId: this.botId }, {
        hmacSecret: this.hmacSecret,
        timeoutMs: this.timeoutMs,
      });
      // Return server response to caller (index.js checks syncRequested)
      return (res as any).data;
    } catch {}
  }

  async sendEvent(event: RelayEvent): Promise<Decision | null> {
    // Immediate send with retries and idempotency
    if (this.botId) (event as any).botId = this.botId;
    return await this.sendWithRetry(event);
  }

  enqueue(event: RelayEvent) {
    this.queue.push(event);
    if (!this.sending) void this.drain();
  }

  private async drain() {
    this.sending = true;
    while (this.queue.length) {
      const evt = this.queue.shift()!;
      try { await this.sendWithRetry(evt); } catch { /* swallow to keep draining */ }
    }
    this.sending = false;
  }

  private async sendWithRetry(event: RelayEvent): Promise<Decision | null> {
    const url = `${this.baseUrl}/v1/relay/events`;
    const idem = makeIdempotencyKey(event);
    let lastErr: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await postJson<{ decision: Decision | null }>(url, this.apiKey, event, {
        hmacSecret: this.hmacSecret,
        timeoutMs: this.timeoutMs,
        idempotencyKey: idem,
      });
      if (res.ok) return res.data?.decision ?? null;
      lastErr = new Error(`Commandless error (${res.status}): ${res.error ?? "unknown"}`);
      // basic backoff
      await sleep(200 * (attempt + 1));
    }
    throw lastErr;
  }
}

function makeIdempotencyKey(event: RelayEvent): string {
  // Simple stable key: type-id-timestamp buckets (can be improved)
  const base = `${event.type}:${(event as any).id}:${Math.floor((event as any).timestamp / 1000)}`;
  return Buffer.from(base).toString("base64url");
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

