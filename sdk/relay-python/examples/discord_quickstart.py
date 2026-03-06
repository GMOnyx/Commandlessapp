import os

import discord

from commandless_relay import RelayClient, use_discord_adapter


def main() -> None:
    token = os.getenv("BOT_TOKEN")
    api_key = os.getenv("COMMANDLESS_API_KEY")
    base_url = os.getenv("COMMANDLESS_SERVICE_URL")
    hmac_secret = os.getenv("COMMANDLESS_HMAC_SECRET")

    if not token:
        raise RuntimeError("Missing BOT_TOKEN")
    if not api_key:
        raise RuntimeError("Missing COMMANDLESS_API_KEY")

    intents = discord.Intents.default()
    intents.message_content = True
    intents.messages = True
    intents.guilds = True

    client = discord.Client(intents=intents)
    relay = RelayClient(api_key=api_key, base_url=base_url, hmac_secret=hmac_secret)

    use_discord_adapter(client, relay, mention_required=True)

    @client.event
    async def on_ready() -> None:
        print(f"[commandless] Logged in as {client.user}")

    client.run(token)


if __name__ == "__main__":
    main()
