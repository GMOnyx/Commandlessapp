import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Configuration from environment or defaults
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COMMANDLESS_API_URL = process.env.COMMANDLESS_API_URL || 'http://localhost:3000'; // For local testing
const CHECK_INTERVAL = 30000; // Check for new bots every 30 seconds

console.log('🧪 Starting Universal Discord Relay Service (TEST MODE)');
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);
console.log('📡 Supabase URL:', SUPABASE_URL ? 'Configured' : 'Missing');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_ANON_KEY');
  console.error('');
  console.error('💡 Create a .env file with these values or set them as environment variables');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store active Discord clients
const activeClients = new Map(); // token -> { client, botInfo }

// Test connection to Supabase and your API
async function testConnections() {
  console.log('🔍 Testing connections...');
  
  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('bots')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');
    
    // Test API connection (if not localhost)
    if (!COMMANDLESS_API_URL.includes('localhost')) {
      try {
        const response = await fetch(`${COMMANDLESS_API_URL}/api/health`);
        if (response.ok) {
          console.log('✅ Commandless API connection successful');
        } else {
          console.log('⚠️ Commandless API returned non-200 status');
        }
      } catch (apiError) {
        console.log('⚠️ Could not reach Commandless API (this is okay for local testing)');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

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
    
    // Show bot details for testing
    if (bots && bots.length > 0) {
      console.log('🤖 Connected bots:');
      bots.forEach(bot => {
        console.log(`   - ${bot.bot_name} (User: ${bot.user_id})`);
      });
    }
    
    return bots || [];
    
  } catch (error) {
    console.error('❌ Exception loading bots:', error);
    return [];
  }
}

// Simple test message processor (for testing without the full API)
async function testProcessMessage(message, botInfo) {
  const content = message.content.toLowerCase();
  
  if (content.includes('ping')) {
    return {
      processed: true,
      response: `🏓 Pong! I'm ${botInfo.bot_name} and I'm working through the Universal Relay Service!`
    };
  }
  
  if (content.includes('hello') || content.includes('hi')) {
    return {
      processed: true,
      response: `👋 Hello! I'm ${botInfo.bot_name}. I'm connected through the Universal Relay Service and ready to help!`
    };
  }
  
  if (content.includes('test')) {
    return {
      processed: true,
      response: `✅ Test successful! The Universal Relay Service is working correctly for ${botInfo.bot_name}.`
    };
  }
  
  // For other messages, try the real API
  try {
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
        }))
      },
      botToken: botInfo.token,
      botClientId: message.client.user.id
    };

    const response = await fetch(`${COMMANDLESS_API_URL}/api/discord?action=process-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    if (response.ok) {
      return await response.json();
    } else {
      console.log(`⚠️ API returned ${response.status}, using fallback response`);
      return {
        processed: true,
        response: `🤖 I received your message: "${message.content}" - but I'm in test mode. The Universal Relay Service is working!`
      };
    }
    
  } catch (error) {
    console.log('⚠️ API call failed, using test response:', error.message);
    return {
      processed: true,
      response: `🧪 Test mode response: I received "${message.content}". The Universal Relay Service is working!`
    };
  }
}

// Create Discord client for a bot
async function createDiscordClient(bot) {
  try {
    console.log(`🤖 Creating test client for bot: ${bot.bot_name} (User: ${bot.user_id})`);
    
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

        // Check if bot is mentioned or if this is a reply to the bot
        const botMentioned = message.mentions.users.has(client.user.id);
        
        if (!botMentioned) return; // For testing, only respond to mentions

        console.log(`📨 [${bot.bot_name}] TEST: Processing message from ${message.author.username}`);
        console.log(`   Content: "${message.content}"`);

        // Process message (with fallback for testing)
        const result = await testProcessMessage(message, bot);

        if (result.processed && result.response) {
          console.log(`🤖 [${bot.bot_name}] TEST: Responding with: ${result.response}`);
          await message.reply(result.response);
        }

      } catch (error) {
        console.error(`❌ [${bot.bot_name}] Error processing test message:`, error);
        try {
          await message.reply('🧪 Test mode error - but the relay service is working!');
        } catch (replyError) {
          console.error(`❌ Failed to send test error reply:`, replyError);
        }
      }
    });

    // Error handling
    client.on(Events.Error, (error) => {
      console.error(`❌ [${bot.bot_name}] Discord client error:`, error);
    });

    // Login to Discord
    await client.login(bot.token);
    
    return { client, botInfo: bot };
    
  } catch (error) {
    console.error(`❌ Failed to create test client for ${bot.bot_name}:`, error);
    return null;
  }
}

// Start a bot client
async function startBot(bot) {
  try {
    // Check if bot is already running
    if (activeClients.has(bot.token)) {
      console.log(`⚠️ Bot ${bot.bot_name} is already running`);
      return true;
    }

    const clientData = await createDiscordClient(bot);
    if (clientData) {
      activeClients.set(bot.token, clientData);
      console.log(`✅ Started test bot: ${bot.bot_name} for user ${bot.user_id}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`❌ Failed to start test bot ${bot.bot_name}:`, error);
    return false;
  }
}

// Main test function
async function runTest() {
  console.log('🧪 Universal Discord Relay Service - Test Mode');
  console.log('===============================================');
  
  // Test connections
  const connectionsOk = await testConnections();
  if (!connectionsOk) {
    console.error('❌ Connection tests failed. Please check your configuration.');
    process.exit(1);
  }
  
  // Load and start bots
  const connectedBots = await loadConnectedBots();
  
  if (connectedBots.length === 0) {
    console.log('⚠️ No connected bots found in database');
    console.log('💡 Make sure you have bots with is_connected=true in your database');
    process.exit(0);
  }
  
  console.log(`🚀 Starting ${connectedBots.length} bot(s) in test mode...`);
  
  for (const bot of connectedBots) {
    await startBot(bot);
  }
  
  console.log('');
  console.log('✅ Test relay service is running!');
  console.log('🧪 Test commands:');
  console.log('   @your_bot ping     - Test basic response');
  console.log('   @your_bot hello    - Test greeting');
  console.log('   @your_bot test     - Test relay service');
  console.log('   @your_bot <anything> - Test full AI processing');
  console.log('');
  console.log('🛑 Press Ctrl+C to stop');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down test service...');
  
  // Stop all bots
  for (const [token, { client, botInfo }] of activeClients) {
    console.log(`🛑 Stopping ${botInfo.bot_name}...`);
    await client.destroy();
  }
  
  console.log('👋 Test service stopped');
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Start the test
runTest().catch(error => {
  console.error('❌ Failed to start test service:', error);
  process.exit(1);
}); 