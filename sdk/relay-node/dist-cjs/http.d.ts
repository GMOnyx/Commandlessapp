import { HttpResponse } from "./types.js";
export declare function postJson<T>(url: string, apiKey: string, body: unknown, opts?: {
    hmacSecret?: string;
    timeoutMs?: number;
    idempotencyKey?: string;
}): Promise<HttpResponse<T>>;
