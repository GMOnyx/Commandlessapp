# commandless-relay (Python)

Official Python SDK for the Commandless relay API.

This package gives Python bots a simple client and a ready-to-use `discord.py` adapter.

## Install

Core client:

```bash
pip install commandless-relay
```

With `discord.py` adapter support:

```bash
pip install "commandless-relay[discord]"
```

## AI-only setup (no code)

Install and run from terminal, similar to the Node SDK flow:

```bash
pip install "commandless-relay[discord]"
commandless-discord
```

Set these environment variables first:

- `BOT_TOKEN` - your Discord bot token
- `COMMANDLESS_API_KEY` - API key created in Commandless dashboard
- `COMMANDLESS_SERVICE_URL` (or `SERVICE_URL`) - optional, defaults to Commandless backend
- `BOT_ID` - optional bot ID from dashboard (recommended)
- `COMMANDLESS_HMAC_SECRET` - optional HMAC secret
- `COMMANDLESS_MENTION_REQUIRED` - optional (`true` by default)

## Quickstart (`discord.py` in code)

```python
import os
import discord
from commandless_relay import RelayClient, use_discord_adapter

TOKEN = os.getenv("BOT_TOKEN")
API_KEY = os.getenv("COMMANDLESS_API_KEY")
BASE_URL = os.getenv("COMMANDLESS_SERVICE_URL") or os.getenv("SERVICE_URL")  # optional

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True

client = discord.Client(intents=intents)
relay = RelayClient(api_key=API_KEY, base_url=BASE_URL)  # base_url optional

use_discord_adapter(client, relay, mention_required=True)

@client.event
async def on_ready():
    print(f"Logged in as {client.user}")

client.run(TOKEN)
```

## Environment variables

- `BOT_TOKEN` - your Discord bot token
- `COMMANDLESS_API_KEY` - API key created in Commandless dashboard
- `COMMANDLESS_SERVICE_URL` (or `SERVICE_URL`) - optional, defaults to Commandless backend
- `BOT_ID` - optional fixed bot id to lock config/persona
- `COMMANDLESS_HMAC_SECRET` - optional HMAC secret
- `COMMANDLESS_MENTION_REQUIRED` - optional (`true` by default)
- `COMMANDLESS_DISABLE_CONFIG_CACHE` - optional (`false` by default)
- `COMMANDLESS_DEBUG` - optional verbose logs (`false` by default)

## Included components

- `RelayClient`
  - `send_event(event)` -> Decision dict or `None`
  - `register_bot(...)` -> botId (optional flow)
  - `heartbeat()` (optional flow)
- `ConfigCache`
  - fetches `/v1/relay/config`
  - local filtering for channel/user/role/premium/rate limits
  - polls every 30 seconds
- `use_discord_adapter(client, relay, mention_required=True, execute=None)`
  - binds an `on_message` listener
  - binds an `on_interaction` listener for slash commands
  - sends events to relay
  - executes reply actions by default
  - applies local config filtering by default (disable via `COMMANDLESS_DISABLE_CONFIG_CACHE=true`)
  - sends a clear message on billing rejection (402 / no subscription or credits)

## Testing

Run unit tests:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

## Release

Use the bundled release helper:

```bash
bash scripts/release.sh
```

This script runs tests, builds distributions, and uploads with Twine.
