import asyncio
import os
import sys
from typing import Optional

try:
    import discord  # type: ignore
except Exception:
    discord = None

from dotenv import find_dotenv, load_dotenv

from .client import RelayClient
from .discord_adapter import use_discord_adapter


def _env(name: str, required: bool = True) -> Optional[str]:
    value = os.getenv(name)
    if required and not value:
        print(f"[commandless] Missing required env: {name}", file=sys.stderr)
        sys.exit(1)
    return value


async def _heartbeat_loop(relay: RelayClient) -> None:
    while True:
        try:
            await asyncio.to_thread(relay.heartbeat)
        except Exception as exc:
            print(f"[commandless] heartbeat failed: {exc}")
        await asyncio.sleep(30)


async def _rate_limit_cleanup_loop(adapter) -> None:
    while True:
        try:
            if getattr(adapter, "config_cache", None):
                adapter.config_cache.cleanup_rate_limits()
        except Exception:
            pass
        await asyncio.sleep(300)


def main() -> None:
    # Match Node CLI behavior: automatically read local .env from the current working directory.
    load_dotenv(find_dotenv(usecwd=True))

    if discord is None:
        print(
            "[commandless] discord.py is not installed. Install with: pip install \"commandless-relay[discord]\"",
            file=sys.stderr,
        )
        sys.exit(1)

    token = os.getenv("BOT_TOKEN") or os.getenv("DISCORD_TOKEN")
    if not token:
        print("[commandless] Missing required env: BOT_TOKEN (or DISCORD_TOKEN)", file=sys.stderr)
        sys.exit(1)
    api_key = _env("COMMANDLESS_API_KEY", required=True)
    # Service URL is optional, same as Node SDK flow.
    # Supports both COMMANDLESS_SERVICE_URL and SERVICE_URL aliases.
    base_url = os.getenv("COMMANDLESS_SERVICE_URL") or os.getenv("SERVICE_URL")
    hmac_secret = os.getenv("COMMANDLESS_HMAC_SECRET")
    bot_id = (os.getenv("BOT_ID") or "").strip() or None
    mention_required = os.getenv("COMMANDLESS_MENTION_REQUIRED", "true").lower() not in ("false", "0", "no")
    debug = os.getenv("COMMANDLESS_DEBUG", "false").lower() in ("true", "1", "yes", "on")
    disable_config_cache = os.getenv("COMMANDLESS_DISABLE_CONFIG_CACHE", "false").lower() in ("true", "1", "yes", "on")

    intents = discord.Intents.default()
    intents.message_content = True
    intents.messages = True
    intents.guilds = True

    client = discord.Client(intents=intents)
    relay = RelayClient(api_key=api_key or "", base_url=base_url, hmac_secret=hmac_secret, debug=debug)
    print(f"[commandless] Base URL: {relay.base_url}")
    print(f"[commandless] mention_required={mention_required}")
    if debug:
        print("[commandless] Debug logging enabled (COMMANDLESS_DEBUG=true)")
    if bot_id:
        relay.set_bot_id(bot_id)
        print(f"[commandless] Using BOT_ID: {relay.bot_id}")

    adapter = use_discord_adapter(
        client,
        relay,
        mention_required=mention_required,
        debug=debug,
        disable_config_cache=disable_config_cache,
    )

    @client.event
    async def on_ready() -> None:
        print(f"[commandless] Logged in as {client.user}")
        try:
            if client.user:
                registered = await asyncio.to_thread(
                    relay.register_bot,
                    "discord",
                    str(client.user.name),
                    str(client.user.id),
                    int(bot_id) if bot_id and bot_id.isdigit() else None,
                )
                if registered:
                    relay.set_bot_id(registered)
                    print(f"[commandless] Registered botId: {relay.bot_id}")
                else:
                    print("[commandless] register_bot returned no botId (continuing with BOT_ID/env value)")
        except Exception as exc:
            print(f"[commandless] register_bot failed: {exc}")

        # Initialize config cache and polling once bot identity is available.
        try:
            if adapter.config_cache and relay.bot_id:
                await asyncio.to_thread(adapter.config_cache.fetch, str(relay.bot_id))
                adapter.config_cache.start_polling(str(relay.bot_id), interval_sec=30)
                print("[commandless] Config polling started (30s interval)")
                asyncio.create_task(_rate_limit_cleanup_loop(adapter))
            elif adapter.config_cache and not relay.bot_id:
                print("[commandless] No botId available, config filtering disabled")
        except Exception as exc:
            print(f"[commandless] Failed to initialize config cache: {exc}")

        asyncio.create_task(_heartbeat_loop(relay))

    client.run(token or "")
