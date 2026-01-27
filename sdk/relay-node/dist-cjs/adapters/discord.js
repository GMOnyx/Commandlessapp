"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDiscordAdapter = useDiscordAdapter;
const configCache_js_1 = require("../configCache.js");
function useDiscordAdapter(opts) {
    const { client, relay } = opts;
    const configCache = opts.disableConfigCache ? null : new configCache_js_1.ConfigCache(relay.baseUrl || '', relay.apiKey);
    // Fetch config on client ready and start polling
    if (configCache) {
        client.once("ready", async () => {
            try {
                // Wait for bot ID to be set (either from registration or env)
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (relay.botId) {
                    console.log(`[commandless] Fetching config for bot ${relay.botId}...`);
                    await configCache.fetch(relay.botId);
                    // Start polling for updates every 30 seconds
                    configCache.startPolling(relay.botId, 30000);
                    console.log('[commandless] Config polling started (30s interval)');
                    // Cleanup rate limits every 5 minutes
                    setInterval(() => configCache.cleanupRateLimits(), 5 * 60 * 1000);
                }
                else {
                    console.warn('[commandless] No botId available, config filtering disabled');
                }
            }
            catch (error) {
                console.error('[commandless] Failed to initialize config cache:', error);
            }
        });
    }
    client.on("messageCreate", async (message) => {
        if (message.author.bot)
            return;
        // Get member roles if in guild
        const memberRoles = message.member?.roles.cache.map(r => r.id) || [];
        // Config-based filtering (if enabled)
        if (configCache && relay.botId) {
            const filterResult = configCache.shouldProcessMessage({
                channelId: message.channelId,
                authorId: message.author.id,
                guildId: message.guildId || undefined,
                memberRoles,
            });
            if (!filterResult.allowed) {
                // Silently ignore (filtered by config)
                console.log(`[commandless] Message filtered: ${filterResult.reason}`);
                return;
            }
        }
        // Check mention requirement (from config or options)
        const config = configCache?.getConfig();
        const mentionRequired = config?.mentionRequired !== false && opts.mentionRequired !== false;
        const mentioned = !!client.user?.id && (message.mentions?.users?.has?.(client.user.id) ?? false);
        // Detect reply-to-bot accurately
        let isReplyToBot = false;
        try {
            if (message.reference?.messageId && client.user?.id) {
                const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                if (ref && ref.author && ref.author.id === client.user.id)
                    isReplyToBot = true;
            }
        }
        catch { }
        if (mentionRequired && !mentioned && !isReplyToBot)
            return;
        const evt = {
            type: "messageCreate",
            id: message.id,
            guildId: message.guildId ?? undefined,
            channelId: message.channelId,
            authorId: message.author.id,
            content: message.content,
            timestamp: message.createdTimestamp,
            botClientId: client.user?.id,
            botId: relay.botId || undefined, // Include botId for backend config enforcement
            isReplyToBot,
            referencedMessageId: message.reference?.messageId,
            referencedMessageAuthorId: message.reference ? client.user?.id : undefined,
        };
        try {
            let typingTimer = null;
            try {
                await message.channel?.sendTyping?.();
            }
            catch { }
            typingTimer = setInterval(() => {
                try {
                    message.channel?.sendTyping?.();
                }
                catch { }
            }, 8000);
            const dec = await relay.sendEvent(evt);
            if (dec)
                await (opts.execute ? opts.execute(dec, { message }) : defaultExecute(dec, { message }, opts));
            if (typingTimer)
                clearInterval(typingTimer);
        }
        catch (err) {
            // swallow; user code can add logging
            // ensure typing cleared
            // no-op: interval cleared by GC if not set
        }
    });
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isCommand())
            return;
        const cmd = interaction;
        const evt = {
            type: "interactionCreate",
            id: interaction.id,
            guildId: interaction.guildId ?? undefined,
            channelId: interaction.channelId ?? undefined,
            userId: interaction.user.id,
            name: cmd.commandName,
            options: (() => {
                const out = {};
                try {
                    // Guard for discord.js v14 CommandInteractionOptionResolver
                    const data = cmd.options?.data || [];
                    for (const d of data)
                        out[d.name] = d.value;
                }
                catch { }
                return out;
            })(),
            timestamp: Date.now(),
            botId: relay.botId || undefined, // Include botId for backend config enforcement
        };
        try {
            const dec = await relay.sendEvent(evt);
            if (dec)
                await (opts.execute ? opts.execute(dec, { interaction }) : defaultExecute(dec, { interaction }, opts));
        }
        catch (err) {
            // swallow
        }
    });
}
function getByPath(root, path) {
    if (!root || !path)
        return undefined;
    try {
        return path.split('.').reduce((o, k) => (o ? o[k] : undefined), root);
    }
    catch {
        return undefined;
    }
}
function pickHandler(registry, action) {
    if (!registry || !action)
        return null;
    try {
        if (typeof registry.get === 'function') {
            return registry.get(action) || registry.get(action.toLowerCase());
        }
        return registry[action] || registry[action.toLowerCase?.()];
    }
    catch {
        return null;
    }
}
async function runHandler(handler, message, args, rest) {
    if (!handler)
        return false;
    try {
        if (typeof handler.execute === 'function') {
            await handler.execute(message, args, rest);
            return true;
        }
        if (typeof handler.run === 'function') {
            await handler.run(message, args, rest);
            return true;
        }
        if (typeof handler.messageRun === 'function') {
            await handler.messageRun(message, { args, rest });
            return true;
        }
        if (typeof handler.exec === 'function') {
            await handler.exec(message, rest.join(' '));
            return true;
        }
        if (typeof handler === 'function') {
            await handler({ message, args, rest });
            return true;
        }
    }
    catch {
        // swallow; user code can add logging
        return true; // handler existed and threw; consider handled to avoid double-processing
    }
    return false;
}
async function defaultExecute(decision, ctx, opts) {
    const reply = decision.actions?.find(a => a.kind === "reply");
    const command = decision.actions?.find(a => a.kind === "command");
    if (reply) {
        if (ctx.message) {
            await ctx.message.reply({ content: reply.content });
        }
        else if (ctx.interaction && ctx.interaction.isRepliable())
            await ctx.interaction.reply({ content: reply.content, ephemeral: reply.ephemeral ?? false });
    }
    if (command && ctx.message) {
        const slash = String(command.slash || '').trim();
        const disableBuiltins = String(process.env.COMMANDLESS_DISABLE_BUILTINS || '').toLowerCase() === 'true';
        const registryPath = process.env.COMMAND_REGISTRY_PATH || '';
        // If user provided explicit handler via onCommand, prefer it
        if (opts?.onCommand) {
            await opts.onCommand({ slash, name: command.name, args: command.args || {} }, ctx).catch(() => { });
            return;
        }
        // Env-based auto-routing to existing registry
        if (registryPath) {
            const aliasesRaw = process.env.COMMAND_REGISTRY_ALIAS_JSON || '';
            let alias = {};
            try {
                if (aliasesRaw)
                    alias = JSON.parse(aliasesRaw);
            }
            catch { }
            const fromSlash = slash ? parseSlash(slash).action : null;
            const base = String(command.name || fromSlash || '').toLowerCase();
            const action = (alias[base] || base);
            const registry = getByPath(opts?.client, registryPath);
            const handler = pickHandler(registry, action);
            const ok = await runHandler(handler, ctx.message, (command.args || {}), []);
            if (ok || disableBuiltins)
                return; // handled or built-ins disabled
            // fallthrough to built-ins only if not disabled
        }
        // Default built-ins (only if not disabled)
        if (!disableBuiltins) {
            if (slash)
                await executeLocalDiscordCommand(slash, ctx.message).catch(() => { });
            else
                await executeLocalAction(String(command.name || ''), command.args || {}, ctx.message).catch(() => { });
        }
    }
}
async function executeLocalDiscordCommand(slashText, message) {
    const { action, params } = parseSlash(slashText);
    if (!action)
        return;
    try {
        switch (action) {
            case 'say': {
                const content = String(params.message || params.text || params.content || '').trim();
                const ch = message.channel;
                if (content && ch && typeof ch.send === 'function')
                    await ch.send({ content });
                break;
            }
            case 'pin': {
                let target = null;
                if (message.reference?.messageId) {
                    try {
                        target = await message.channel.messages.fetch(message.reference.messageId);
                    }
                    catch { }
                }
                if (!target) {
                    const fetched = await message.channel.messages.fetch({ limit: 2 });
                    target = fetched.filter(m => m.id !== message.id).first() || fetched.first();
                }
                if (target && typeof target.pin === 'function')
                    await target.pin();
                break;
            }
            case 'purge': {
                const amt = Number(params.amount || params.n || params.count || '0');
                if (amt > 0 && 'bulkDelete' in message.channel) {
                    await message.channel.bulkDelete(Math.min(amt, 100), true);
                    break;
                }
                // No amount -> delete referenced/last message
                let target = null;
                if (message.reference?.messageId) {
                    try {
                        target = await message.channel.messages.fetch(message.reference.messageId);
                    }
                    catch { }
                }
                if (!target) {
                    const fetched = await message.channel.messages.fetch({ limit: 2 });
                    target = fetched.filter((m) => m.id !== message.id).first() || fetched.first();
                }
                if (target && typeof target.delete === 'function')
                    await target.delete().catch(() => { });
                break;
            }
            default:
                // Let bots handle domain-specific actions via custom routing
                break;
        }
    }
    catch { }
}
async function executeLocalAction(action, params, message) {
    try {
        switch (action) {
            case 'say': {
                const t = String(params.message || '').trim();
                const ch = message.channel;
                if (t && ch?.send)
                    await ch.send({ content: t });
                break;
            }
            // Add common cross-bot actions here if desired
            default:
                break;
        }
    }
    catch { }
}
function parseSlash(text) {
    const out = {};
    const t = String(text || '').trim().replace(/^\//, '');
    if (!t)
        return { action: null, params: out };
    const [head, ...rest] = t.split(/\s+/);
    let action = head.toLowerCase();
    // parse k=v pairs
    for (const part of rest) {
        const m = part.match(/^([^=]+)=(.*)$/);
        if (m)
            out[m[1]] = m[2];
    }
    // also support freeform for simple commands e.g., "purge 5" or "say hello" (map to message)
    if (!Object.keys(out).length && rest.length) {
        if (action === 'purge' && /^\d+$/.test(rest[0]))
            out.amount = rest[0];
        else
            out.message = rest.join(' ');
    }
    return { action, params: out };
}
