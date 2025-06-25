const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Bot Configuration - REPLACE WITH YOUR REAL VALUES
const BOT_TOKEN = 'YOUR_DISCORD_BOT_TOKEN_HERE';
const BOT_ID = 'YOUR_BOT_ID_FROM_COMMANDLESS';
const BOT_NAME = 'YOUR_BOT_NAME';

console.log('🤖 Starting', BOT_NAME + '...');
console.log('🔗 Commandless API:', 'https://commandless.app');

// Create Discord client
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
  console.log(`✅ ${BOT_NAME} is ready! Logged in as ${readyClient.user.tag}`);
  console.log(`🤖 Bot ID: ${readyClient.user.id}`);
  console.log(`🧠 Commandless AI middleware is active!`);
});

// Message handling
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if bot is mentioned or replied to
    const botMentioned = message.mentions.users.has(client.user.id);
    const isReplyToBot = message.reference && 
      message.reference.messageId && 
      (await message.channel.messages.fetch(message.reference.messageId))?.author.id === client.user.id;

    if (!botMentioned && !isReplyToBot) return;

    console.log(`📨 Processing: "${message.content}" from ${message.author.username}`);

    // Prepare message data for Commandless AI
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
      botToken: BOT_TOKEN,
      botClientId: client.user.id
    };

    // Send to Commandless AI API
    const response = await fetch('https://commandless.app/api/discord?action=process-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();

    if (result.processed && result.response) {
      console.log(`🤖 AI Response: ${result.response}`);
      await message.reply(result.response);

      if (result.execution) {
        console.log(`⚡ Command: ${result.execution.success ? 'Success' : 'Failed'}`);
        if (result.execution.error) {
          console.log(`❌ Error: ${result.execution.error}`);
        }
      }
    } else {
      console.log(`⏭️ Not processed: ${result.reason || 'Unknown reason'}`);
    }

  } catch (error) {
    console.error('❌ Error processing message:', error);
    try {
      await message.reply('Sorry, I encountered an error. Please try again.');
    } catch (replyError) {
      console.error('❌ Failed to send error reply:', replyError);
    }
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down', BOT_NAME + '...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down', BOT_NAME + '...');
  client.destroy();
  process.exit(0);
});

// Start the bot
console.log('🔌 Connecting to Discord...');
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
}); 