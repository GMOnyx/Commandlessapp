import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active bot processes (in memory for this instance)
const activeBots = new Map<string, any>();

// Helper function to decode JWT and extract user ID
function decodeJWT(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { userId: token };
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub || payload.user_id || payload.id;
    
    if (!userId) {
      console.error('No user ID found in JWT payload:', payload);
      return null;
    }
    
    return { userId };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return { userId: token };
  }
}

interface StartupResult {
  started: boolean;
  method: string;
  message?: string;
  clientCode?: string;
  instructions?: string[];
  error?: string;
}

export default async function handler(req: any, res: any) {
  // Universal CORS headers - accept custom domain or any Vercel URL
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && (
    origin === 'https://www.commandless.app' ||
    origin === 'https://commandless.app' ||
    origin === 'http://localhost:5173' ||
    origin.endsWith('.vercel.app')
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = decodeJWT(token);
  
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const userId = decodedToken.userId;

  try {
    if (action === 'auto-start' && req.method === 'POST') {
      const { botId } = req.body;
      
      if (!botId) {
        return res.status(400).json({ error: 'Bot ID is required' });
      }

      // Get bot details
      const { data: bot, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }

      if (bot.platform_type !== 'discord') {
        return res.status(400).json({ error: 'Only Discord bots are supported' });
      }

      // Try to start the Discord bot automatically using a persistent service
      const startupResult = await attemptAutoStart(bot);
      
      return res.status(200).json({
        success: true,
        autoStarted: startupResult.started,
        method: startupResult.method,
        message: startupResult.message,
        clientCode: startupResult.clientCode,
        instructions: startupResult.instructions
      });
    }

    if (action === 'status' && req.method === 'GET') {
      // Return status of Discord bots and available startup methods
      const { data: userBots, error } = await supabase
        .from('bots')
        .select('id, bot_name, is_connected, platform_type')
        .eq('user_id', userId)
        .eq('platform_type', 'discord');

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch bots' });
      }

      return res.status(200).json({
        bots: userBots,
        availableStartupMethods: await getAvailableStartupMethods(),
        activeInstances: Array.from(activeBots.keys())
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Discord manager error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function attemptAutoStart(bot: any): Promise<StartupResult> {
  // Method 1: Try to use Railway/Render/other persistent services if available
  const persistentStart = await tryPersistentServiceStart(bot);
  if (persistentStart.started) {
    return persistentStart;
  }

  // Method 2: Try to use GitHub Actions or similar CI/CD for bot hosting
  const cicdStart = await tryCICDStart(bot);
  if (cicdStart.started) {
    return cicdStart;
  }

  // Method 3: Generate client code for manual execution (fallback)
  return {
    started: false,
    method: 'manual',
    message: 'Automatic startup not available. Please run the generated client code manually.',
    clientCode: generateDiscordClientCode(bot),
    instructions: [
      "1. Copy the client code below",
      "2. Save it to a file (e.g., discord-bot.js)",
      "3. Install dependencies: npm install discord.js node-fetch",
      "4. Run: node discord-bot.js",
      "5. Keep the process running to maintain bot connection"
    ]
  };
}

async function tryPersistentServiceStart(bot: any): Promise<StartupResult> {
  // Check if we have Railway, Render, or other persistent service credentials
  const railwayToken = process.env.RAILWAY_TOKEN;
  const renderApiKey = process.env.RENDER_API_KEY;
  
  if (railwayToken) {
    return await startOnRailway(bot, railwayToken);
  }
  
  if (renderApiKey) {
    return await startOnRender(bot, renderApiKey);
  }
  
  return { started: false, method: 'none' };
}

async function tryCICDStart(bot: any): Promise<StartupResult> {
  // Check if we have GitHub Actions or similar CI/CD setup
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  
  if (githubToken && githubRepo) {
    return await triggerGitHubActionsBot(bot, githubToken, githubRepo);
  }
  
  return { started: false, method: 'none' };
}

async function startOnRailway(bot: any, token: string): Promise<StartupResult> {
  try {
    // Railway API call to deploy bot instance
    // This would require Railway project setup
    console.log('Attempting Railway deployment for bot:', bot.bot_name);
    
    // For now, return not started since we'd need Railway project setup
    return { 
      started: false, 
      method: 'railway',
      message: 'Railway deployment requires project setup'
    };
  } catch (error: any) {
    return { started: false, method: 'railway', error: error.message };
  }
}

async function startOnRender(bot: any, apiKey: string): Promise<StartupResult> {
  try {
    // Render API call to deploy bot instance
    console.log('Attempting Render deployment for bot:', bot.bot_name);
    
    // For now, return not started since we'd need Render service setup
    return { 
      started: false, 
      method: 'render',
      message: 'Render deployment requires service setup'
    };
  } catch (error: any) {
    return { started: false, method: 'render', error: error.message };
  }
}

async function triggerGitHubActionsBot(bot: any, token: string, repo: string): Promise<StartupResult> {
  try {
    // GitHub Actions workflow dispatch
    console.log('Attempting GitHub Actions deployment for bot:', bot.bot_name);
    
    // This would trigger a workflow that runs the Discord bot
    return { 
      started: false, 
      method: 'github-actions',
      message: 'GitHub Actions deployment requires workflow setup'
    };
  } catch (error: any) {
    return { started: false, method: 'github-actions', error: error.message };
  }
}

async function getAvailableStartupMethods(): Promise<string[]> {
  const methods: string[] = [];
  
  if (process.env.RAILWAY_TOKEN) methods.push('railway');
  if (process.env.RENDER_API_KEY) methods.push('render');
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) methods.push('github-actions');
  
  methods.push('manual'); // Always available
  
  return methods;
}

function generateDiscordClientCode(bot: any): string {
  return `const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Bot Configuration
const BOT_TOKEN = '${bot.token}';
const BOT_ID = '${bot.id}';
const BOT_NAME = '${bot.bot_name}';
const COMMANDLESS_API_URL = 'https://commandlessapp-nft6hub5t-abdarrahmans-projects.vercel.app';

console.log('🤖 Starting \${BOT_NAME}...');
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
  console.log(\`✅ \${BOT_NAME} is ready! Logged in as \${readyClient.user.tag}\`);
  console.log(\`🤖 Bot ID: \${readyClient.user.id}\`);
  console.log(\`🧠 AI Personality: ${bot.personality_context || 'Default Discord bot personality'}\`);
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

    console.log(\`📨 Processing: "\${message.content}" from \${message.author.username}\`);

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
    const response = await fetch(\`\${COMMANDLESS_API_URL}/api/discord?action=process-message\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });

    const result = await response.json();

    if (result.processed && result.response) {
      console.log(\`🤖 AI Response: \${result.response}\`);
      await message.reply(result.response);

      if (result.execution) {
        console.log(\`⚡ Command: \${result.execution.success ? 'Success' : 'Failed'}\`);
        if (result.execution.error) {
          console.log(\`❌ Error: \${result.execution.error}\`);
        }
      }
    } else {
      console.log(\`⏭️ Not processed: \${result.reason || 'Unknown reason'}\`);
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
  console.log('🛑 Shutting down \${BOT_NAME}...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down \${BOT_NAME}...');
  client.destroy();
  process.exit(0);
});

// Start the bot
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});`;
} 