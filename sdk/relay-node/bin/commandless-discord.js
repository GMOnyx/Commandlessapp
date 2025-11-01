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
const baseUrl = process.env.COMMANDLESS_SERVICE_URL; // Optional - defaults to Commandless backend
const hmacSecret = process.env.COMMANDLESS_HMAC_SECRET;

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
    const botId = await relay.registerBot({ platform: 'discord', name: client.user.username, clientId: client.user.id });
    if (botId) relay.botId = botId;
  } catch (e) {
    console.warn('[commandless] registerBot failed:', e?.message || e);
  }
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(token);
