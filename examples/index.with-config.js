/**
 * Commandless SDK Example - With Configuration Filtering
 * 
 * This example shows how the SDK automatically filters messages based on
 * configuration set in the dashboard (channels, roles, rate limits, etc.)
 * 
 * Setup:
 * 1. npm install discord.js @abdarrahmanabdelnasir/relay-node
 * 2. Create bot in Commandless dashboard and get API key
 * 3. Configure bot settings in dashboard (channels, roles, rate limits)
 * 4. Set environment variables and run
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@abdarrahmanabdelnasir/relay-node';

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize Commandless relay client
const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY,
  baseUrl: process.env.COMMANDLESS_SERVICE_URL || 'https://commandless-app-production.up.railway.app',
  hmacSecret: process.env.COMMANDLESS_HMAC_SECRET,
});

// Wire up Discord adapter
// The adapter will automatically:
// - Fetch config on bot startup
// - Filter messages by channel (if configured)
// - Filter by user roles (if configured)
// - Apply rate limits locally (if configured)
// - Poll for config updates every 30s
useDiscordAdapter({ 
  client, 
  relay,
  // mentionRequired is now controlled by dashboard config
  // You can still override it here if needed
});

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  console.log(`🆔 Bot User ID: ${client.user.id}`);
  
  // Register with Commandless (sets botId)
  try {
    const botId = process.env.BOT_ID 
      ? await relay.registerBot({ 
          platform: 'discord', 
          name: client.user.username, 
          clientId: client.user.id,
          botId: parseInt(process.env.BOT_ID)
        })
      : await relay.registerBot({ 
          platform: 'discord', 
          name: client.user.username, 
          clientId: client.user.id 
        });
    
    if (botId) {
      console.log(`🔗 Registered with Commandless (Bot ID: ${botId})`);
      console.log('📋 Fetching configuration from dashboard...');
      // Config will be fetched automatically by the adapter
    } else {
      console.warn('⚠️  Failed to register. Config filtering may not work.');
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
  }

  // Heartbeat every 30 seconds
  setInterval(async () => {
    try {
      await relay.heartbeat();
    } catch (error) {
      // Silently fail
    }
  }, 30_000);
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

// Login
client.login(process.env.BOT_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

