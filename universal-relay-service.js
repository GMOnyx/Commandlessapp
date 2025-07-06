import { Client, GatewayIntentBits, Events, PermissionFlagsBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import express from 'express';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COMMANDLESS_API_URL = process.env.COMMANDLESS_API_URL || 'https://commandless.app';
const CHECK_INTERVAL = 30000; // Check for new bots every 30 seconds

console.log('🚀 Starting Universal Discord Relay Service');
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);
console.log('📡 Supabase URL:', SUPABASE_URL ? 'Configured' : 'Missing');

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store active Discord clients
const activeClients = new Map(); // token -> { client, botInfo }
const botMessageIds = new Set(); // Track bot message IDs for reply detection

// Message context manager for conversation tracking
class MessageContextManager {
  constructor() {
    this.contexts = new Map(); // channelId -> messages
    this.MAX_CONTEXT_MESSAGES = 10;
    this.CONTEXT_EXPIRY_HOURS = 2;
  }

  addMessage(channelId, messageId, content, author, isBot) {
    if (!this.contexts.has(channelId)) {
      this.contexts.set(channelId, []);
    }

    const messages = this.contexts.get(channelId);
    messages.push({
      messageId,
      content,
      author,
      timestamp: new Date(),
      isBot
    });

    // Keep only recent messages
    if (messages.length > this.MAX_CONTEXT_MESSAGES) {
      messages.splice(0, messages.length - this.MAX_CONTEXT_MESSAGES);
    }

    // Clean up old messages
    this.cleanupOldMessages(channelId);
  }

  getMessageById(channelId, messageId) {
    const messages = this.contexts.get(channelId) || [];
    return messages.find(msg => msg.messageId === messageId);
  }

  cleanupOldMessages(channelId) {
    const messages = this.contexts.get(channelId);
    if (!messages) return;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.CONTEXT_EXPIRY_HOURS);

    const validMessages = messages.filter(msg => msg.timestamp > cutoff);
    this.contexts.set(channelId, validMessages);
  }
}

const messageContextManager = new MessageContextManager();

// Load connected bots from database
async function loadConnectedBots() {
  try {
    console.log('📋 Loading connected bots from database...');
    
    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('platform_type', 'discord')
      .eq('is_connected', true);

    if (error) {
      console.error('❌ Error loading bots:', error);
      return [];
    }

    console.log(`✅ Found ${bots?.length || 0} connected Discord bots`);
    return bots || [];
    
  } catch (error) {
    console.error('❌ Exception loading bots:', error);
    return [];
  }
}

// Create Discord client for a bot
async function createDiscordClient(bot) {
  try {
    console.log(`🤖 Creating client for bot: ${bot.bot_name} (User: ${bot.user_id})`);
    
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    // Bot ready event
    client.once(Events.ClientReady, (readyClient) => {
      console.log(`✅ ${bot.bot_name} ready! Logged in as ${readyClient.user.tag}`);
    });

    // Message handling
    client.on(Events.MessageCreate, async (message) => {
      try {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Store message for context
        messageContextManager.addMessage(
          message.channelId,
          message.id,
          message.content,
          message.author.tag,
          false
        );

        // Check if bot is mentioned or if this is a reply to the bot
        const botMentioned = message.mentions.users.has(client.user.id);
        
        let isReplyToBot = false;
        if (message.reference?.messageId) {
          // Check our context manager first
          const referencedMessage = messageContextManager.getMessageById(
            message.channelId, 
            message.reference.messageId
          );
          
          if (referencedMessage?.isBot) {
            isReplyToBot = true;
          } else {
            // Fallback: check if we tracked this message ID
            isReplyToBot = botMessageIds.has(message.reference.messageId);
          }
        }

        if (!botMentioned && !isReplyToBot) return;

        console.log(`📨 [${bot.bot_name}] Processing: "${message.content}" from ${message.author.username}`);
        console.log(`   Bot mentioned: ${botMentioned}, Reply to bot: ${isReplyToBot}`);

        // Prepare message data for Commandless AI API
        const messageData = {
          message: {
            content: message.content,
            author: {
              id: message.author.id,
              username: message.author.username,
              bot: message.author.bot
            },
            channel_id: message.channel.id,
            guild_id: message.guild?.id,
            mentions: message.mentions.users.map(user => ({
              id: user.id,
              username: user.username
            })),
            referenced_message: message.reference ? {
              id: message.reference.messageId,
              author: { id: client.user.id }
            } : undefined
          },
          botToken: bot.token,
          botClientId: client.user.id
        };

        // Show "Bot is typing..." indicator
        await message.channel.sendTyping();

        // Send to Commandless AI API
        const response = await fetch(`${COMMANDLESS_API_URL}/api/discord`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        });

        const result = await response.json();

        if (result.processed && result.response) {
          console.log(`🤖 [${bot.bot_name}] AI Response: ${result.response}`);
          
          const botMessage = await message.reply(result.response);
          
          // Track bot message for reply detection
          if (botMessage) {
            botMessageIds.add(botMessage.id);
            messageContextManager.addMessage(
              message.channelId,
              botMessage.id,
              result.response,
              client.user.tag,
              true
            );
          }

        } else {
          console.error(`❌ [${bot.bot_name}] AI API call failed or returned no response:`, result);
        }
      } catch (error) {
        console.error(`❌ [${bot.bot_name}] Error handling message:`, error);
        
        try {
          // Attempt to send a generic error message
          await message.reply("Sorry, I encountered an error while processing your request. Please try again later.");
        } catch (replyError) {
          console.error(`❌ [${bot.bot_name}] Failed to send error reply:`, replyError);
        }
      }
    });

    return client;
  } catch (error) {
    console.error(`❌ Exception creating Discord client for ${bot.bot_name}:`, error);
    return null;
  }
}

// Start a bot
async function startBot(bot) {
  if (!bot || !bot.token) {
    console.error('❌ Cannot start bot without token:', bot.bot_name);
    return;
  }

  // If client already exists, do nothing
  if (activeClients.has(bot.token)) return;

  const client = await createDiscordClient(bot);
  if (client) {
    try {
      await client.login(bot.token);
      activeClients.set(bot.token, { client, botInfo: bot });
    } catch (error) {
      console.error(`❌ Failed to login for ${bot.bot_name}:`, error);
      // Clean up failed client
      if (client.readyTimestamp) {
        await client.destroy();
      }
    }
  }
}

// Stop a bot
async function stopBot(token) {
  const clientData = activeClients.get(token);
  if (clientData) {
    console.log(`🔌 Stopping bot: ${clientData.botInfo.bot_name}`);
    await clientData.client.destroy();
    activeClients.delete(token);
  }
}

// Sync bots with database
async function syncBots() {
  console.log('🔄 Syncing bots with database...');
  const connectedBots = await loadConnectedBots();
  const connectedTokens = new Set(connectedBots.map(bot => bot.token));
  const activeTokens = new Set(activeClients.keys());

  // Start new bots
  for (const bot of connectedBots) {
    if (!activeTokens.has(bot.token)) {
      await startBot(bot);
    }
  }

  // Stop disconnected bots
  for (const token of activeTokens) {
    if (!connectedTokens.has(token)) {
      await stopBot(token);
    }
  }

  console.log(`✨ Sync complete. Running bots: ${activeClients.size}`);
}

// Main function
async function main() {
  try {
    // Initial sync
    await syncBots();

    // Periodically sync bots
    setInterval(syncBots, CHECK_INTERVAL);

    console.log('✅ Universal Relay Service is fully operational');
  } catch (error) {
    console.error('❌ A critical error occurred in the main function:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔌 SIGTERM received, shutting down gracefully...');
  for (const token of activeClients.keys()) {
    await stopBot(token);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔌 SIGINT received, shutting down gracefully...');
  for (const token of activeClients.keys()) {
    await stopBot(token);
  }
  process.exit(0);
});

// Unhandled error handling
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// --- Health Check and Web Server ---
const app = express();
const PORT = process.env.PORT || 3000;

// Basic root endpoint
app.get('/', (req, res) => {
  res.status(200).send('Universal Relay Service is running.');
});

// Detailed health check
app.get('/health', (req, res) => {
  const runningBots = Array.from(activeClients.values());
  if (runningBots.length > 0) {
    res.status(200).json({
      status: 'ok',
      runningBots: runningBots.length,
      botDetails: runningBots.map(bot => ({
        name: bot.botInfo.bot_name,
        readyAt: bot.client.readyAt
      }))
    });
  } else {
    res.status(503).json({ status: 'error', message: 'No active bots running' });
  }
});

app.listen(PORT, () => {
  console.log(`🏥 Health check endpoint running on port ${PORT}`);
  // Start the main bot logic ONLY after the server is ready
  main();
});
