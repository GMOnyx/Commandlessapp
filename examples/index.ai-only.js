// index.js — AI-Only Mode
// Perfect for conversational bots. Your bot responds naturally using AI.
// No local command execution needed. Just copy, paste, and run!

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
	relay.botId = process.env.BOT_ID;
	console.log('[boot] Using fixed BOT_ID:', process.env.BOT_ID);
}

useDiscordAdapter({ client, relay, mentionRequired: true });

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



