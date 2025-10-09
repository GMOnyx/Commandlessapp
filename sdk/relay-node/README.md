# @commandless/relay-node (MVP)

A lightweight Node SDK to send your bot events to Commandless and execute the returned actions. Your bot token never leaves your app.

## Install (local testing)

From your bot project, add the SDK from this repo:

```bash
npm i discord.js
npm i @commandless/relay-node@file:../sdk/relay-node
```

If using another folder layout, adjust the `file:` path accordingly. Once published, you'll simply:

```bash
npm i @commandless/relay-node
```

## Quickstart (Discord.js v14)

```ts
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@commandless/relay-node';

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY!,
  baseUrl: process.env.COMMANDLESS_BASE_URL || 'https://<your-app>.railway.app',
  hmacSecret: process.env.COMMANDLESS_HMAC_SECRET, // optional but recommended
});

useDiscordAdapter({ client: discord, relay });

discord.login(process.env.BOT_TOKEN);
```

## API

- `RelayClient(opts)`
  - `sendEvent(event)` → `Decision | null` (retries + idempotency)
  - `enqueue(event)` → fire-and-forget queue
- `useDiscordAdapter({ client, relay, execute? })`
  - Wires `messageCreate` and `interactionCreate`
  - Optional `execute(decision, ctx)` to override default reply behavior

## Security

- Every request includes `x-commandless-key`.
- Optional `x-signature` HMAC (SHA-256 of raw body) if you set `hmacSecret`.
- Idempotency with `x-idempotency-key` to dedupe retries.

## Requirements

- Node 18+
- Discord.js 14+

## Notes

This is an MVP; API may change slightly before 1.0. Please file issues with feedback.


