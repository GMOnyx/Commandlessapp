# @abdarrahmanabdelnasir/commandless-discord

Zero‑code AI runtime for Discord. Boots Commandless SDK without an index.js.

## Install

```bash
npm i @abdarrahmanabdelnasir/commandless-discord
```

## Run (env‑only)

```bash
BOT_TOKEN=... \
COMMANDLESS_API_KEY=... \
COMMANDLESS_SERVICE_URL=... \
npx commandless-discord
```

Optional:
- `BOT_ID` – lock persona to a specific bot
- `COMMANDLESS_HMAC_SECRET` – enable request signing

Node 18+, Discord.js v14 (installed automatically as a dependency).
