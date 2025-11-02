#!/usr/bin/env node
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@abdarrahmanabdelnasir/relay-node';

function getEnv(name, optional = false) {
  const v = process.env[name];
  if (!v && !optional) {
    console.error(`[commandless] Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const token = getEnv('BOT_TOKEN');
const apiKey = getEnv('COMMANDLESS_API_KEY');
const botId = getEnv('BOT_ID');
const baseUrl = process.env.COMMANDLESS_SERVICE_URL; // Optional - defaults to Commandless backend
const hmacSecret = process.env.COMMANDLESS_HMAC_SECRET;

// Log API key for debugging (first 15 chars only)
console.log(`[commandless] Using API key: ${apiKey.substring(0, 15)}... (full length: ${apiKey.length})`);
console.log(`[commandless] Using BOT_ID: ${botId}`);
console.log(`[commandless] Using base URL: ${baseUrl || 'https://commandless-app-production.up.railway.app'}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

const relay = new RelayClient({ apiKey, baseUrl, hmacSecret });

useDiscordAdapter({ client, relay, mentionRequired: true });

client.once('ready', async () => {
  console.log(`[commandless] Logged in as ${client.user.tag}`);
  try {
    const registeredBotId = await relay.registerBot({ 
      platform: 'discord', 
      name: client.user.username, 
      clientId: client.user.id,
      botId: parseInt(botId, 10)
    });
    if (registeredBotId) relay.botId = registeredBotId;
    console.log(`[commandless] Bot registered with ID: ${registeredBotId}`);
  } catch (e) {
    console.error('[commandless] registerBot failed:', e?.message || e);
    process.exit(1);
  }
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(token);
