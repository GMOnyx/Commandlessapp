import type { Client, Message, Interaction, CommandInteraction } from "discord.js";
import { RelayClient } from "../relayClient";
import type { RelayEvent, Decision } from "../types";

export interface DiscordAdapterOptions {
  client: Client;
  relay: RelayClient;
  execute?: (dec: Decision, ctx: { message?: Message; interaction?: Interaction }) => Promise<void>;
}

export function useDiscordAdapter(opts: DiscordAdapterOptions) {
  const { client, relay } = opts;

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    const evt: RelayEvent = {
      type: "messageCreate",
      id: message.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      authorId: message.author.id,
      content: message.content,
      timestamp: message.createdTimestamp,
    };
    try {
      const dec = await relay.sendEvent(evt);
      if (dec) await (opts.execute ? opts.execute(dec, { message }) : defaultExecute(dec, { message }));
    } catch (err) {
      // swallow; user code can add logging
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;
    const cmd = interaction as CommandInteraction;
    const evt: RelayEvent = {
      type: "interactionCreate",
      id: interaction.id,
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId ?? undefined,
      userId: interaction.user.id,
      name: cmd.commandName,
      options: Object.fromEntries(cmd.options.data.map(d => [d.name, d.value])),
      timestamp: Date.now(),
    };
    try {
      const dec = await relay.sendEvent(evt);
      if (dec) await (opts.execute ? opts.execute(dec, { interaction }) : defaultExecute(dec, { interaction }));
    } catch (err) {
      // swallow
    }
  });
}

async function defaultExecute(decision: Decision, ctx: { message?: Message; interaction?: Interaction }) {
  const action = decision.actions?.find(a => a.kind === "reply");
  if (!action || action.kind !== "reply") return;
  if (ctx.message) await ctx.message.reply({ content: action.content });
  else if (ctx.interaction && ctx.interaction.isRepliable()) await ctx.interaction.reply({ content: action.content, ephemeral: action.ephemeral ?? false });
}

