const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Get your bot token from Commandless app
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const COMMANDLESS_API_URL = 'https://commandless.app';

console.log('🤖 Starting Discord Bot...');
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);

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
  console.log(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
  console.log(`🤖 Bot ID: ${readyClient.user.id}`);
  console.log(`🧠 Connected to Commandless AI`);
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
    const response = await fetch(`${COMMANDLESS_API_URL}/api/discord?action=process-message`, {
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
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});

// Start the bot
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to start bot:', error);
  console.log('🔧 Make sure you set DISCORD_BOT_TOKEN environment variable or edit the token in this file');
  process.exit(1);
}); 