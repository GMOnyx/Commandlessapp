export type Snowflake = string;

export type RelayEvent =
  | { type: "messageCreate"; id: string; guildId?: Snowflake; channelId: Snowflake; authorId: Snowflake; content: string; timestamp: number }
  | { type: "interactionCreate"; id: string; guildId?: Snowflake; channelId?: Snowflake; userId: Snowflake; name: string; options?: Record<string, unknown>; timestamp: number };

export interface Decision {
  id: string;
  intent: string;
  confidence: number;
  params: Record<string, unknown>;
  safety?: { blocked?: boolean; reasons?: string[] };
  next_step?: string;
  actions?: Array<
    | { kind: "reply"; content: string; ephemeral?: boolean }
    | { kind: "command"; slash: string; simulate?: boolean }
  >;
}

export interface RelayClientOptions {
  apiKey: string;
  baseUrl?: string; // default https://api.commandless.app
  hmacSecret?: string; // optional per-key signing
  timeoutMs?: number;
}

export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  requestId?: string;
}

