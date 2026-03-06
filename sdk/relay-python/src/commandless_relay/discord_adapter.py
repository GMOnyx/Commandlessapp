import asyncio
import time
from typing import Any, Awaitable, Callable, Dict, Optional

from .client import RelayClient, RelayError
from .config_cache import ConfigCache

DecisionHandler = Callable[[Dict[str, Any], Any], Awaitable[None]]


class DiscordAdapter:
    def __init__(
        self,
        client: Any,
        relay: RelayClient,
        mention_required: bool = True,
        execute: Optional[DecisionHandler] = None,
        debug: bool = False,
        disable_config_cache: bool = False,
    ) -> None:
        self.client = client
        self.relay = relay
        self.mention_required = mention_required
        self.execute = execute
        self.debug = debug
        self.disable_config_cache = disable_config_cache
        self.config_cache: Optional[ConfigCache] = None
        if not disable_config_cache:
            self.config_cache = ConfigCache(relay.base_url, relay.api_key, debug=debug)

    def bind(self) -> None:
        # Support multiple discord.py-style client variants.
        if hasattr(self.client, "add_listener"):
            self.client.add_listener(self._on_message, "on_message")
            self.client.add_listener(self._on_interaction, "on_interaction")
            return

        if hasattr(self.client, "listen"):
            self.client.listen("on_message")(self._on_message)
            self.client.listen("on_interaction")(self._on_interaction)
            return

        # Fallback for clients that only support @client.event assignment.
        if hasattr(self.client, "event"):
            @self.client.event
            async def on_message(message: Any) -> None:
                await self._on_message(message)

            @self.client.event
            async def on_interaction(interaction: Any) -> None:
                await self._on_interaction(interaction)
            return

        raise RuntimeError("Unsupported discord client: cannot register on_message listener")

    def _debug(self, msg: str) -> None:
        if self.debug:
            print(f"[commandless][debug] {msg}")

    async def _on_message(self, message: Any) -> None:
        if not message or not getattr(message, "author", None):
            return
        if getattr(message.author, "bot", False):
            return

        member_roles = []
        try:
            member_roles = [str(r.id) for r in (getattr(message.author, "roles", None) or []) if getattr(r, "id", None)]
        except Exception:
            member_roles = []

        # Config-based local filtering (Node SDK parity)
        if self.config_cache and self.relay.bot_id:
            filter_result = self.config_cache.should_process_message(
                channel_id=str(message.channel.id),
                author_id=str(message.author.id),
                guild_id=str(message.guild.id) if getattr(message, "guild", None) else None,
                member_roles=member_roles,
            )
            if not filter_result.get("allowed", True):
                reason = str(filter_result.get("reason") or "")
                try:
                    if reason == "Premium only":
                        await message.reply(
                            "This command is part of this bot's premium features, and your account is not marked as premium for this bot."
                        )
                    elif reason.startswith("Rate limit") or reason.startswith("Server rate limit"):
                        await message.reply("You've hit the rate limit for this bot. Please try again later.")
                    else:
                        self._debug(f"filtered: {reason}")
                except Exception:
                    pass
                return

        mentioned = False
        try:
            mentioned = bool(self.client.user and self.client.user in message.mentions)
        except Exception:
            mentioned = False

        is_reply_to_bot = False
        try:
            if getattr(message, "reference", None) and getattr(message.reference, "resolved", None):
                ref = message.reference.resolved
                if getattr(ref, "author", None) and self.client.user:
                    is_reply_to_bot = ref.author.id == self.client.user.id
        except Exception:
            is_reply_to_bot = False

        if self.mention_required and not mentioned and not is_reply_to_bot:
            self._debug(f"filtered: mention_required id={getattr(message, 'id', 'unknown')}")
            return

        event = {
            "type": "messageCreate",
            "id": str(message.id),
            "guildId": str(message.guild.id) if getattr(message, "guild", None) else None,
            "channelId": str(message.channel.id),
            "authorId": str(message.author.id),
            "content": str(message.content or ""),
            "timestamp": int((getattr(message, "created_at", None) or time.time()).timestamp() * 1000)
            if getattr(message, "created_at", None)
            else int(time.time() * 1000),
            "botClientId": str(self.client.user.id) if getattr(self.client, "user", None) else None,
            "isReplyToBot": is_reply_to_bot,
            "referencedMessageId": str(message.reference.message_id) if getattr(message, "reference", None) and getattr(message.reference, "message_id", None) else None,
        }

        try:
            self._debug(
                f"event: id={event.get('id')} guild={event.get('guildId')} channel={event.get('channelId')} "
                f"author={event.get('authorId')} botId={self.relay.bot_id}"
            )
            async with message.channel.typing():
                decision = await asyncio.to_thread(self.relay.send_event, event)

            if not decision:
                self._debug(f"decision: none for event={event.get('id')}")
                return
            self._debug(f"decision: actions={len(decision.get('actions') or [])} for event={event.get('id')}")

            if self.execute:
                await self.execute(decision, message)
            else:
                await self._default_execute(decision, message)
        except RelayError as err:
            msg = str(err)
            self._debug(f"relay error: status={err.status} message={msg}")
            if err.status == 402 or "SUBSCRIPTION_REQUIRED" in msg or "Payment Required" in msg:
                try:
                    await message.reply(
                        "This bot's Commandless subscription is inactive or out of free credits. "
                        "Please ask the bot owner to update billing."
                    )
                except Exception:
                    pass
        except Exception:
            # Keep adapter resilient by default
            self._debug("adapter exception: non-relay error swallowed")

    async def _default_execute(self, decision: Dict[str, Any], message: Any) -> None:
        actions = decision.get("actions") or []
        for action in actions:
            if action.get("kind") == "reply":
                content = action.get("content")
                if content:
                    await message.reply(str(content))
                return

    async def _on_interaction(self, interaction: Any) -> None:
        # commands-only for now (parity with Node's interactionCreate command handling)
        try:
            if not interaction:
                return
            if not hasattr(interaction, "type"):
                return
            # discord.py v2 has .is_command(); for compatibility, guard access.
            is_command = False
            try:
                if hasattr(interaction, "is_command"):
                    is_command = bool(interaction.is_command())
            except Exception:
                is_command = False
            if not is_command:
                return
        except Exception:
            return

        options: Dict[str, Any] = {}
        try:
            data = getattr(interaction, "data", None) or {}
            # interaction.data.options is typically a list of {name, value}
            for opt in (data.get("options") or []):
                if isinstance(opt, dict) and "name" in opt:
                    options[str(opt["name"])] = opt.get("value")
        except Exception:
            options = {}

        event = {
            "type": "interactionCreate",
            "id": str(getattr(interaction, "id", "")),
            "guildId": str(getattr(getattr(interaction, "guild", None), "id", "")) or None,
            "channelId": str(getattr(getattr(interaction, "channel", None), "id", "")) or None,
            "userId": str(getattr(getattr(interaction, "user", None), "id", "")),
            "name": str(getattr(getattr(interaction, "command", None), "name", None) or getattr(interaction, "command_name", "")),
            "options": options,
            "timestamp": int(time.time() * 1000),
            "botId": self.relay.bot_id,
        }

        try:
            self._debug(
                f"interaction: id={event.get('id')} guild={event.get('guildId')} channel={event.get('channelId')} "
                f"user={event.get('userId')} name={event.get('name')} botId={self.relay.bot_id}"
            )
            decision = await asyncio.to_thread(self.relay.send_event, event)
            if not decision:
                self._debug(f"interaction decision: none id={event.get('id')}")
                return
            actions = decision.get("actions") or []
            self._debug(f"interaction decision: actions={len(actions)} id={event.get('id')}")

            # For milestone C: execute reply action only (command actions remain user-code territory).
            for action in actions:
                if action.get("kind") == "reply":
                    content = action.get("content")
                    if not content:
                        return
                    ephemeral = bool(action.get("ephemeral", False))
                    try:
                        if not getattr(interaction, "response", None):
                            return
                        if getattr(interaction.response, "is_done", lambda: False)():
                            # already responded -> followup
                            if getattr(interaction, "followup", None):
                                await interaction.followup.send(str(content), ephemeral=ephemeral)
                        else:
                            await interaction.response.send_message(str(content), ephemeral=ephemeral)
                    except Exception:
                        # fallback attempt
                        try:
                            if getattr(interaction, "followup", None):
                                await interaction.followup.send(str(content), ephemeral=ephemeral)
                        except Exception:
                            pass
                    return
        except RelayError as err:
            msg = str(err)
            self._debug(f"interaction relay error: status={err.status} message={msg}")
            if err.status == 402 or "SUBSCRIPTION_REQUIRED" in msg or "Payment Required" in msg:
                try:
                    text = (
                        "This bot's Commandless subscription is inactive or out of free credits. "
                        "Please ask the bot owner to update billing."
                    )
                    if getattr(interaction, "response", None) and not getattr(interaction.response, "is_done", lambda: False)():
                        await interaction.response.send_message(text, ephemeral=True)
                    elif getattr(interaction, "followup", None):
                        await interaction.followup.send(text, ephemeral=True)
                except Exception:
                    pass
        except Exception:
            self._debug("interaction exception: non-relay error swallowed")


def use_discord_adapter(
    client: Any,
    relay: RelayClient,
    mention_required: bool = True,
    execute: Optional[DecisionHandler] = None,
    debug: bool = False,
    disable_config_cache: bool = False,
) -> DiscordAdapter:
    adapter = DiscordAdapter(
        client=client,
        relay=relay,
        mention_required=mention_required,
        execute=execute,
        debug=debug,
        disable_config_cache=disable_config_cache,
    )
    adapter.bind()
    return adapter
