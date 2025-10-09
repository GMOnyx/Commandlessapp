import type { Client, Message, Interaction, CommandInteraction } from "discord.js";
import { RelayClient } from "../relayClient.js";
import type { RelayEvent, Decision } from "../types.js";

export interface DiscordAdapterOptions {
  client: Client;
  relay: RelayClient;
  execute?: (dec: Decision, ctx: { message?: Message; interaction?: Interaction }) => Promise<void>;
  onCommand?: (spec: { slash?: string; name?: string; args?: Record<string, unknown> }, ctx: { message?: Message; interaction?: Interaction }) => Promise<void>;
}

export function useDiscordAdapter(opts: DiscordAdapterOptions) {
  const { client, relay } = opts;

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    try {
      const ch: any = message.channel as any;
      if (ch && typeof ch.sendTyping === 'function') await ch.sendTyping();
    } catch {}
    const evt: RelayEvent = {
      type: "messageCreate",
      id: message.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      authorId: message.author.id,
      content: message.content,
      timestamp: message.createdTimestamp,
      botClientId: client.user?.id as string | undefined,
      isReplyToBot: !!(message.reference?.messageId && message.mentions.users.has(client.user?.id || "")),
      referencedMessageId: message.reference?.messageId,
      referencedMessageAuthorId: message.reference ? (client.user?.id as string | undefined) : undefined,
    };
    try {
      const dec = await relay.sendEvent(evt);
      if (dec) await (opts.execute ? opts.execute(dec, { message }) : defaultExecute(dec, { message }, opts));
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
      options: ((): Record<string, unknown> => {
        const out: Record<string, unknown> = {};
        try {
          // Guard for discord.js v14 CommandInteractionOptionResolver
          const data: any[] = (cmd as any).options?.data || [];
          for (const d of data) out[d.name] = d.value;
        } catch {}
        return out;
      })(),
      timestamp: Date.now(),
    };
    try {
      const dec = await relay.sendEvent(evt);
      if (dec) await (opts.execute ? opts.execute(dec, { interaction }) : defaultExecute(dec, { interaction }, opts));
    } catch (err) {
      // swallow
    }
  });
}

async function defaultExecute(decision: Decision, ctx: { message?: Message; interaction?: Interaction }, opts?: DiscordAdapterOptions) {
  const reply = decision.actions?.find(a => a.kind === "reply") as any;
  const command = decision.actions?.find(a => a.kind === "command") as any;
  if (reply) {
    if (ctx.message) await ctx.message.reply({ content: reply.content });
    else if (ctx.interaction && ctx.interaction.isRepliable()) await ctx.interaction.reply({ content: reply.content, ephemeral: reply.ephemeral ?? false });
  }
  if (command && ctx.message) {
    const slash = String((command as any).slash || '').trim();
    if (opts?.onCommand) {
      await opts.onCommand({ slash, name: command.name, args: command.args || {} }, ctx).catch(() => {});
    } else if (slash) {
      await executeLocalDiscordCommand(slash, ctx.message).catch(() => {});
    } else {
      await executeLocalAction(String(command.name || ''), command.args || {}, ctx.message).catch(() => {});
    }
  }
}

async function executeLocalDiscordCommand(slashText: string, message: Message): Promise<void> {
  const { action, params } = parseSlash(slashText);
  if (!action) return;
  try {
    switch (action) {
      case 'say': {
        const content = String(params.message || params.text || params.content || '').trim();
        const ch: any = message.channel as any;
        if (content && ch && typeof ch.send === 'function') await ch.send({ content });
        break;
      }
      case 'pin': {
        let target = null as any;
        if ((message as any).reference?.messageId) {
          try { target = await message.channel.messages.fetch((message as any).reference.messageId); } catch {}
        }
        if (!target) {
          const fetched = await message.channel.messages.fetch({ limit: 2 });
          target = fetched.filter(m => m.id !== message.id).first() || fetched.first();
        }
        if (target && typeof (target as any).pin === 'function') await (target as any).pin();
        break;
      }
      case 'purge': {
        const amt = Number(params.amount || params.n || params.count || '0');
        if (amt > 0 && 'bulkDelete' in (message.channel as any)) {
          await (message.channel as any).bulkDelete(Math.min(amt, 100), true);
          break;
        }
        // No amount -> delete referenced/last message
        let target: any = null;
        if ((message as any).reference?.messageId) {
          try { target = await message.channel.messages.fetch((message as any).reference.messageId); } catch {}
        }
        if (!target) {
          const fetched = await message.channel.messages.fetch({ limit: 2 });
          target = fetched.filter((m: any) => m.id !== message.id).first() || fetched.first();
        }
        if (target && typeof target.delete === 'function') await target.delete().catch(() => {});
        break;
      }
      default:
        // Let bots handle domain-specific actions via custom routing
        break;
    }
  } catch {}
}

async function executeLocalAction(action: string, params: Record<string, unknown>, message: Message): Promise<void> {
  try {
    switch (action) {
      case 'say': {
        const t = String(params.message || '').trim();
        const ch: any = message.channel as any;
        if (t && ch?.send) await ch.send({ content: t });
        break;
      }
      // Add common cross-bot actions here if desired
      default:
        break;
    }
  } catch {}
}

function parseSlash(text: string): { action: string | null; params: Record<string, string> } {
  const out: Record<string, string> = {};
  const t = String(text || '').trim().replace(/^\//, '');
  if (!t) return { action: null, params: out };
  const [head, ...rest] = t.split(/\s+/);
  let action = head.toLowerCase();
  // parse k=v pairs
  for (const part of rest) {
    const m = part.match(/^([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  // also support freeform for simple commands e.g., "purge 5" or "say hello" (map to message)
  if (!Object.keys(out).length && rest.length) {
    if (action === 'purge' && /^\d+$/.test(rest[0])) out.amount = rest[0];
    else out.message = rest.join(' ');
  }
  return { action, params: out };
}

