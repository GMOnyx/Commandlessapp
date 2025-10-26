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
const baseUrl = getEnv('COMMANDLESS_SERVICE_URL');
const hmacSecret = process.env.COMMANDLESS_HMAC_SECRET;
const fixedBotId = getEnv('BOT_ID');

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
relay.botId = fixedBotId;

useDiscordAdapter({ client, relay, mentionRequired: true });

client.once('ready', async () => {
  console.log(`[commandless] Logged in as ${client.user.tag}`);
  try {
    await relay.registerBot({ platform: 'discord', name: client.user.username, clientId: client.user.id });
  } catch (e) {
    console.warn('[commandless] registerBot failed:', e?.message || e);
  }
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(token);
