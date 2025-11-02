import { Decision, RelayClientOptions, RelayEvent } from "./types.js";
export declare class RelayClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly hmacSecret?;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly queue;
    private sending;
    private botId?;
    constructor(opts: RelayClientOptions);
    registerBot(info: {
        platform: 'discord';
        name?: string;
        clientId?: string;
        botId?: number;
    }): Promise<string | null>;
    heartbeat(): Promise<void>;
    sendEvent(event: RelayEvent): Promise<Decision | null>;
    enqueue(event: RelayEvent): void;
    private drain;
    private sendWithRetry;
}
