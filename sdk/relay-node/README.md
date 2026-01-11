# @commandless/relay-node

Lightweight Node SDK to integrate your Discord bot with the Commandless backend. It forwards events (messages/interactions) and executes returned actions (AI replies or commands). Your bot token never leaves your app.

## Install

```bash
npm i @abdarrahmanabdelnasir/relay-node
```

If you don't have discord.js yet (Discord.js v14):

```bash
npm i discord.js
```

## Quickstart (Discord.js v14)

```ts
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@abdarrahmanabdelnasir/relay-node';

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY!,
  baseUrl: process.env.COMMANDLESS_SERVICE_URL,
  hmacSecret: process.env.COMMANDLESS_HMAC_SECRET, // optional but recommended
});

useDiscordAdapter({ client: discord, relay });

discord.login(process.env.BOT_TOKEN);
```

### Templates

- AI-only (conversational replies, no local commands): see `examples/index.ai-only.js` in the main repo.
- With registry (route command actions to your handlers): see `examples/index.with-registry.js`.

### Environment variables

- `BOT_TOKEN` — Discord bot token
- `COMMANDLESS_API_KEY` — API key created in the dashboard
- `COMMANDLESS_SERVICE_URL` — your Commandless service base URL
- `COMMANDLESS_HMAC_SECRET` — optional HMAC signing secret
- `BOT_ID` — optional fixed bot id to lock persona to a specific bot row

## API

- `RelayClient(opts)`
  - `sendEvent(event)` → `Decision | null` (retries + idempotency)
  - `enqueue(event)` → fire-and-forget queue
- `useDiscordAdapter({ client, relay, execute? })`
  - Wires `messageCreate` and `interactionCreate`
  - Optional `execute(decision, ctx)` to override default reply behavior
  - `mentionRequired` (default true) to only process when mentioned or replying to the bot

## Configuration System (NEW)

The SDK automatically fetches and caches bot configuration from your dashboard:

- **Channel filtering** - Only process messages from specific channels
- **Role permissions** - Restrict AI to certain roles (e.g., @Moderator, @Premium)
- **Rate limiting** - Local rate limits (per-user and per-server)
- **Command control** - Enable/disable specific command categories
- **Auto-updates** - Polls for config changes every 30 seconds (no bot restart needed)

Configuration is managed in the Commandless dashboard. The SDK enforces it locally (fast, no API calls for filtered messages).

To disable config filtering:
```ts
useDiscordAdapter({ 
  client, 
  relay,
  disableConfigCache: true // Bypass all config checks
});
```

## Security

- Every request includes `x-commandless-key`.
- Optional `x-signature` HMAC (SHA-256 of raw body) if you set `hmacSecret`.
- Idempotency with `x-idempotency-key` to dedupe retries.

## Troubleshooting

- No persona loaded: ensure events carry `botId` (set `BOT_ID` or let `registerBot` link) and the bot row has a saved personality; ensure your API key maps to the same `user_id`.
- 401/405 errors from dashboard: set `COMMANDLESS_SERVICE_URL` correctly; SDK calls should go to the service (Railway), not the dashboard host.
- Empty AI responses: verify OpenRouter/OpenAI envs on the backend and timeouts; the SDK will log decisions and retries.

## Requirements

- Node 18+
- Discord.js 14+

## Notes

MVP; surface may evolve pre‑1.0. Please file issues and suggestions.


