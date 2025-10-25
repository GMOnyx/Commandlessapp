// index.with-registry.js — Advanced: AI replies + command execution via pasted registry
// Paste your handlers in the PASTE ZONE below. Keys should match your slash/action names.

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@commandless/relay-node';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.DirectMessages,
	],
});

const relay = new RelayClient({
	apiKey: process.env.COMMANDLESS_API_KEY,
	baseUrl: process.env.COMMANDLESS_SERVICE_URL,
	hmacSecret: process.env.COMMANDLESS_HMAC_SECRET || undefined,
});

if (process.env.BOT_ID) {
	// @ts-ignore
	relay.botId = process.env.BOT_ID;
	console.log('[boot] Using fixed BOT_ID:', process.env.BOT_ID);
}

// ---------- PASTE ZONE: define your command registry here ----------
const registry = new Map();

// Example handlers ready to test:
registry.set('pin', {
	async execute(message) {
		let target = null;
		if (message.reference?.messageId) {
			try { target = await message.channel.messages.fetch(message.reference.messageId); } catch {}
		}
		if (!target) {
			const fetched = await message.channel.messages.fetch({ limit: 2 });
			target = fetched.filter(m => m.id !== message.id).first() || fetched.first();
		}
		try {
			if (target?.pin) {
				await target.pin();
				await message.reply('✅ Pinned.');
			} else {
				await message.reply('⚠️ Could not find a message to pin.');
			}
		} catch (e) {
			await message.reply('❌ Failed to pin.');
		}
	}
});

registry.set('purge', {
	async execute(message, args) {
		const raw = args?.amount ?? args?.n ?? args?.count ?? args?.num ?? 0;
		const n = Math.max(0, Math.min(100, Number(raw)));
		if (!n) {
			await message.reply('Provide an amount 1-100.');
			return;
		}
		try {
			if ('bulkDelete' in (message.channel)) {
				const res = await (message.channel).bulkDelete(n, true);
				await message.reply(`🧹 Deleted ${res.size} messages.`);
			} else {
				await message.reply('Channel does not support bulk delete.');
			}
		} catch (e) {
			await message.reply('❌ Failed to purge messages.');
		}
	}
});

registry.set('say', {
	async execute(message, args) {
		const text = String(args?.message || args?.text || args?.content || '').trim();
		if (!text) {
			await message.reply('Provide text to send.');
			return;
		}
		try {
			await message.channel.send({ content: text });
		} catch (e) {
			await message.reply('❌ Failed to send message.');
		}
	}
});

// ---------- Minimal router to your handlers ----------
function pickHandler(action) {
	const key = String(action || '').toLowerCase();
	return registry.get(key) || registry.get(key.toLowerCase());
}

function parseSlashToAction(slash, fallbackName) {
	const clean = String(slash || '').trim();
	if (!clean) return { action: String(fallbackName || '').toLowerCase(), args: {} };
	const without = clean.replace(/^\//, '');
	const parts = without.split(/\s+/);
	const action = String(parts.shift() || fallbackName || '').toLowerCase();
	const args = {};
	for (const p of parts) {
		const m = /^([a-zA-Z_][\w-]*):(.*)$/.exec(p);
		if (m) { args[m[1]] = m[2]; continue; }
		// heuristics
		if (!isNaN(Number(p))) { args.amount = Number(p); continue; }
		if (!args.message) { args.message = p; } else { args.message += ' ' + p; }
	}
	return { action, args };
}

async function runHandler(handler, message, args, rest) {
	if (!handler) return false;
	if (typeof handler.execute === 'function') { await handler.execute(message, args, rest); return true; }
	if (typeof handler.run === 'function') { await handler.run(message, args, rest); return true; }
	if (typeof handler.messageRun === 'function') { await handler.messageRun(message, { args, rest }); return true; }
	if (typeof handler.exec === 'function') { await handler.exec(message, rest?.join(' ') ?? ''); return true; }
	if (typeof handler === 'function') { await handler({ message, args, rest }); return true; }
	return false;
}

// Adapter: replies + route command actions to your registry
useDiscordAdapter({
    client,
    relay,
    mentionRequired: true,
    // Ensure conversational replies are always sent AND commands routed to registry
    execute: async (decision, ctx) => {
        try {
            const reply = decision?.actions?.find(a => a?.kind === 'reply');
            if (reply?.content) {
                if (ctx?.message) await ctx.message.reply({ content: reply.content }).catch(() => {});
                else if (ctx?.interaction?.isRepliable?.()) await ctx.interaction.reply({ content: reply.content }).catch(() => {});
            }
        } catch {}

        try {
            const command = decision?.actions?.find(a => a?.kind === 'command');
            if (command && ctx?.message) {
                const providedSlash = String(command?.slash || (command?.args?.slash ?? '')).trim();
                let action = String(command?.name || '').toLowerCase();
                let args = command?.args || {};
                if (!action || action === 'execute' || providedSlash) {
                    const parsed = parseSlashToAction(providedSlash, action);
                    action = parsed.action;
                    args = { ...args, ...parsed.args };
                }
                const handler = pickHandler(action);
                const ok = await runHandler(handler, ctx.message, args, []);
                if (!ok) console.log('[registry] no handler for', action);
            }
        } catch {}
    },
});

client.once('ready', async () => {
	console.log(`✅ Logged in as ${client.user.tag}`);
	try {
		const id = await relay.registerBot({
			platform: 'discord',
			name: client.user.username,
			clientId: client.user.id,
		});
		if (id && !relay.botId) relay.botId = id;
	} catch (e) {
		console.warn('registerBot error:', e?.message || e);
	}
	setInterval(async () => {
		try { await relay.heartbeat(); } catch {}
	}, 30_000);
});

client.login(process.env.BOT_TOKEN).catch((err) => {
	console.error('❌ Discord login failed:', err?.message || err);
	process.exit(1);
});


