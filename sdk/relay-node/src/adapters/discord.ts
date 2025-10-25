import type { Client, Message, Interaction, CommandInteraction } from "discord.js";
import { RelayClient } from "../relayClient.js";
import type { RelayEvent, Decision } from "../types.js";

export interface DiscordAdapterOptions {
  client: Client;
  relay: RelayClient;
  execute?: (dec: Decision, ctx: { message?: Message; interaction?: Interaction }) => Promise<void>;
  onCommand?: (spec: { slash?: string; name?: string; args?: Record<string, unknown> }, ctx: { message?: Message; interaction?: Interaction }) => Promise<void>;
  mentionRequired?: boolean; // default true: only process when bot is mentioned or replied to
}

export function useDiscordAdapter(opts: DiscordAdapterOptions) {
  const { client, relay } = opts;

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    const mentionRequired = opts.mentionRequired !== false;
    const mentioned = !!client.user?.id && (message.mentions?.users?.has?.(client.user.id) ?? false);
    // Typing indicator will be driven by a short loop only when addressed
    // Detect reply-to-bot accurately
    let isReplyToBot = false;
    try {
      if ((message as any).reference?.messageId && client.user?.id) {
        const ref = await message.channel.messages.fetch((message as any).reference.messageId).catch(() => null);
        if (ref && ref.author && ref.author.id === client.user.id) isReplyToBot = true;
      }
    } catch {}

    if (mentionRequired && !mentioned && !isReplyToBot) return;
    const evt: RelayEvent = {
      type: "messageCreate",
      id: message.id,
      guildId: message.guildId ?? undefined,
      channelId: message.channelId,
      authorId: message.author.id,
      content: message.content,
      timestamp: message.createdTimestamp,
      botClientId: client.user?.id as string | undefined,
      isReplyToBot,
      referencedMessageId: message.reference?.messageId,
      referencedMessageAuthorId: message.reference ? (client.user?.id as string | undefined) : undefined,
    };
    try {
      let typingTimer: any = null;
      try { await (message.channel as any)?.sendTyping?.(); } catch {}
      typingTimer = setInterval(() => {
        try { (message.channel as any)?.sendTyping?.(); } catch {}
      }, 8000);

      const dec = await relay.sendEvent(evt);
      if (dec) await (opts.execute ? opts.execute(dec, { message }) : defaultExecute(dec, { message }, opts));
      if (typingTimer) clearInterval(typingTimer);
    } catch (err) {
      // swallow; user code can add logging
      // ensure typing cleared
      // no-op: interval cleared by GC if not set
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

function getByPath(root: any, path: string | undefined): any {
  if (!root || !path) return undefined;
  try { return path.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), root); } catch { return undefined; }
}

function pickHandler(registry: any, action: string | null) {
  if (!registry || !action) return null;
  try {
    if (typeof (registry as any).get === 'function') {
      return registry.get(action) || registry.get(action.toLowerCase());
    }
    return registry[action] || registry[action.toLowerCase?.()];
  } catch { return null; }
}

async function runHandler(handler: any, message: Message, args: any, rest: string[]): Promise<boolean> {
  if (!handler) return false;
  try {
    if (typeof handler.execute === 'function') { await handler.execute(message, args, rest); return true; }
    if (typeof handler.run === 'function') { await handler.run(message, args, rest); return true; }
    if (typeof handler.messageRun === 'function') { await handler.messageRun(message, { args, rest }); return true; }
    if (typeof handler.exec === 'function') { await handler.exec(message, rest.join(' ')); return true; }
    if (typeof handler === 'function') { await handler({ message, args, rest }); return true; }
  } catch {
    // swallow; user code can add logging
    return true; // handler existed and threw; consider handled to avoid double-processing
  }
  return false;
}

async function defaultExecute(decision: Decision, ctx: { message?: Message; interaction?: Interaction }, opts?: DiscordAdapterOptions) {
  const reply = decision.actions?.find(a => a.kind === "reply") as any;
  const command = decision.actions?.find(a => a.kind === "command") as any;
  if (reply) {
    if (ctx.message) {
      await ctx.message.reply({ content: reply.content });
    }
    else if (ctx.interaction && ctx.interaction.isRepliable()) await ctx.interaction.reply({ content: reply.content, ephemeral: reply.ephemeral ?? false });
  }
  if (command && ctx.message) {
    const slash = String((command as any).slash || '').trim();
    const disableBuiltins = String(process.env.COMMANDLESS_DISABLE_BUILTINS || '').toLowerCase() === 'true';
    const registryPath = process.env.COMMAND_REGISTRY_PATH || '';

    // If user provided explicit handler via onCommand, prefer it
    if (opts?.onCommand) {
      await opts.onCommand({ slash, name: command.name, args: command.args || {} }, ctx).catch(() => {});
      return;
    }

    // Env-based auto-routing to existing registry
    if (registryPath) {
      const aliasesRaw = process.env.COMMAND_REGISTRY_ALIAS_JSON || '';
      let alias: Record<string, string> = {};
      try { if (aliasesRaw) alias = JSON.parse(aliasesRaw); } catch {}
      const fromSlash = slash ? parseSlash(slash).action : null;
      const base = String(command.name || fromSlash || '').toLowerCase();
      const action = (alias[base] || base);
      const registry = getByPath((opts as any)?.client, registryPath);
      const handler = pickHandler(registry, action);
      const ok = await runHandler(handler, ctx.message, (command.args || {}), []);
      if (ok || disableBuiltins) return; // handled or built-ins disabled
      // fallthrough to built-ins only if not disabled
    }

    // Default built-ins (only if not disabled)
    if (!disableBuiltins) {
      if (slash) await executeLocalDiscordCommand(slash, ctx.message).catch(() => {});
      else await executeLocalAction(String(command.name || ''), command.args || {}, ctx.message).catch(() => {});
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

