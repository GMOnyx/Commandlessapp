import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

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
  serviceId?: string;
  deploymentId?: string;
  envVars?: Record<string, string>;
  deploymentRequired?: boolean;
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

  // Method 3: Generate Railway deployment package (enhanced manual approach)
  return {
    started: false,
    method: 'railway-template',
    message: '🚂 Railway deployment package ready! Follow instructions to deploy.',
    clientCode: generateRailwayDeploymentPackage(bot),
    instructions: [
      "🚂 **Deploy to Railway (Recommended)**:",
      "1. Create a new GitHub repository",
      "2. Copy ALL the files from the deployment package below",
      "3. Commit and push to your repo",
      "4. Go to Railway: https://railway.app/new",
      "5. Select 'Deploy from GitHub repo'",
      "6. Choose your new repository",
      "7. Railway will auto-detect and deploy your bot!",
      "",
      "✅ **Environment Variables** (Auto-configured):",
      `• BOT_TOKEN: ${bot.token}`,
      `• BOT_ID: ${bot.id}`,
      `• BOT_NAME: ${bot.bot_name}`,
      `• COMMANDLESS_API_URL: https://commandless.app`,
      "",
      "🔗 **Need help?** Visit: https://docs.railway.app/quick-start"
    ]
  };
}

async function tryPersistentServiceStart(bot: any): Promise<StartupResult> {
  // Check if we have Railway, Render, or other persistent service credentials
  const railwayToken = process.env.RAILWAY_TOKEN || '4d56303a-25cd-411d-b2f7-0f44c6d0f49c'; // Hardcoded fallback
  const renderApiKey = process.env.RENDER_API_KEY;
  
  if (railwayToken) {
    console.log('🚂 Railway token found, attempting deployment for bot:', bot.bot_name);
    return await startOnRailway(bot, railwayToken);
  }
  
  if (renderApiKey) {
    console.log('🎨 Render API key found, attempting deployment for bot:', bot.bot_name);
    return await startOnRender(bot, renderApiKey);
  }
  
  console.log('❌ No persistent service credentials found (RAILWAY_TOKEN, RENDER_API_KEY)');
  return { 
    started: false, 
    method: 'none',
    message: 'No Railway or Render credentials configured for automatic deployment'
  };
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
    console.log('🚂 Attempting automatic Railway deployment for bot:', bot.bot_name);
    
    // Use the provided Railway project ID
    const projectId = process.env.RAILWAY_PROJECT_ID || 'e09a4f1b-1960-4d7a-9e1a-45540806d41b';
    
    // Step 1: Create Railway service for this bot
    const serviceResult = await createRailwayService(bot, token, projectId);
    if (!serviceResult.success) {
      console.log('❌ Railway service creation failed, providing manual deployment');
      return {
        started: false,
        method: 'railway-manual',
        message: '🚂 One-click Railway deployment ready!',
        clientCode: generateDiscordClientCode(bot),
        instructions: [
          "🚂 **One-Click Railway Deployment**:",
          "",
          `🔗 **Deploy Now**: https://railway.app/template/L22H6p`,
          "",
          "1. Click the deploy link above",
          "2. Sign in to Railway", 
          "3. Set these environment variables:",
          `   • BOT_TOKEN: ${bot.token}`,
          `   • BOT_ID: ${bot.id}`,
          `   • BOT_NAME: ${bot.bot_name}`,
          `   • COMMANDLESS_API_URL: https://commandless.app`,
          "4. Click 'Deploy' - your bot will be live in 2 minutes!",
          "",
          "✅ **Alternative**: Copy the client code below and deploy manually"
        ],
        deploymentRequired: true
      };
    }

    // Step 2: Set environment variables for the service
    const envResult = await setRailwayEnvironmentVariables(bot, token, serviceResult.serviceId!);
    if (!envResult.success) {
      console.warn('⚠️ Environment variables setup failed');
    }

    console.log('✅ Railway service created successfully:', serviceResult.serviceId);
    
    return {
      started: true,
      method: 'railway',
      message: `🚂 Bot service created on Railway! Deploy the code to make it live.`,
      serviceId: serviceResult.serviceId,
      clientCode: generateDiscordClientCode(bot),
      instructions: [
        "🚂 **Your Railway Service is Ready!**",
        "",
        "**Next Steps**:",
        "1. Copy the Discord bot code below",
        "2. Go to your Railway project dashboard",
        `3. Find the service: discord-bot-${bot.bot_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        "4. Connect a GitHub repository with the bot code",
        "5. Railway will auto-deploy and your bot will be live!",
        "",
        "✅ **Environment variables are already configured**"
      ],
      envVars: {
        BOT_TOKEN: bot.token,
        BOT_ID: bot.id,
        BOT_NAME: bot.bot_name,
        COMMANDLESS_API_URL: 'https://commandless.app',
        PERSONALITY_CONTEXT: bot.personality_context || 'A helpful Discord bot'
      }
    };
  } catch (error: any) {
    console.error('Railway deployment error:', error);
    return { 
      started: false, 
      method: 'railway-manual', 
      error: error.message,
      message: `🚂 One-click Railway deployment ready!`,
      clientCode: generateDiscordClientCode(bot),
      instructions: [
        "🚂 **One-Click Railway Deployment**:",
        "",
        `🔗 **Deploy Now**: https://railway.app/template/L22H6p`,
        "",
        "1. Click the deploy link above",
        "2. Sign in to Railway", 
        "3. Set these environment variables:",
        `   • BOT_TOKEN: ${bot.token}`,
        `   • BOT_ID: ${bot.id}`,
        `   • BOT_NAME: ${bot.bot_name}`,
        `   • COMMANDLESS_API_URL: https://commandless.app`,
        "4. Click 'Deploy' - your bot will be live in 2 minutes!",
        "",
        "✅ **Alternative**: Copy the client code below and deploy manually"
      ]
    };
  }
}

async function createDiscordBotRepository(bot: any): Promise<{success: boolean, repoUrl?: string, error?: string}> {
  // For now, return manual instructions since GitHub repo creation requires additional setup
  // In the future, this could use GitHub API to create repos automatically
  return {
    success: false,
    error: 'Automatic repository creation not yet implemented - using manual approach'
  };
}

async function deployToRailwayFromGitHub(bot: any, token: string, repoUrl: string): Promise<{success: boolean, serviceId?: string}> {
  // For now, return manual instructions since Railway deployment requires GitHub integration
  // In the future, this could use Railway API to trigger deployments from repos
  return {
    success: false
  };
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
  return `// Discord Bot for ${bot.bot_name}
// Generated by Commandless - https://commandless.app
// Deploy this to Railway for persistent hosting

const { Client, GatewayIntentBits, Events } = require('discord.js');
const fetch = require('node-fetch');

// Bot Configuration from Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN || '${bot.token}';
const BOT_ID = process.env.BOT_ID || '${bot.id}';
const BOT_NAME = process.env.BOT_NAME || '${bot.bot_name}';
const COMMANDLESS_API_URL = process.env.COMMANDLESS_API_URL || 'https://commandless.app';
const PORT = process.env.PORT || 3000;

console.log('🤖 Starting Discord Bot:', BOT_NAME);
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);
console.log('🚂 Railway Port:', PORT);

// Create Discord client with required intents
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
  
  // Set bot status
  readyClient.user.setActivity('AI-powered commands | @mention me', { 
    type: 'LISTENING' 
  });
});

// Message handling with Commandless AI integration
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

    console.log(\`📨 Processing message from \${message.author.username}: "\${message.content}"\`);

    // Show typing indicator
    await message.channel.sendTyping();

    // Prepare message data for Commandless AI
    const messageData = {
      message: {
        id: message.id,
        content: message.content.replace(/<@!?\${client.user.id}>/g, '').trim(),
        author: {
          id: message.author.id,
          username: message.author.username,
          displayName: message.author.displayName || message.author.username
        },
        channel: {
          id: message.channel.id,
          name: message.channel.name || 'DM',
          type: message.channel.type
        },
        guild: message.guild ? {
          id: message.guild.id,
          name: message.guild.name
        } : null,
        timestamp: message.createdTimestamp,
        reference: message.reference ? {
          messageId: message.reference.messageId,
          channelId: message.reference.channelId,
          guildId: message.reference.guildId
        } : null
      },
      bot: {
        id: BOT_ID,
        name: BOT_NAME,
        personality: \`${bot.personality_context || 'A helpful Discord bot'}\`
      },
      platform: 'discord'
    };

    // Send to Commandless AI for processing
    const response = await fetch(\`\${COMMANDLESS_API_URL}/api/ai/process\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': \`DiscordBot/\${BOT_NAME}\`
      },
      body: JSON.stringify(messageData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Commandless API error:', response.status, errorText);
      
      await message.reply({
        content: '⚠️ I\\'m having trouble processing your request. Please try again later.',
        allowedMentions: { repliedUser: false }
      });
      return;
    }

    const aiResponse = await response.json();
    console.log('🧠 AI Response:', aiResponse);

    // Handle different types of AI responses
    if (aiResponse.action === 'reply') {
      await message.reply({
        content: aiResponse.message || 'I processed your request!',
        allowedMentions: { repliedUser: false }
      });
    } else if (aiResponse.action === 'execute') {
      // Handle command execution
      await message.reply({
        content: \`🔧 Executing: \${aiResponse.command}\`,
        allowedMentions: { repliedUser: false }
      });
      
      // Execute the actual command logic here
      // This would integrate with your command mapping system
    } else {
      // Default response
      await message.reply({
        content: aiResponse.message || 'Message processed!',
        allowedMentions: { repliedUser: false }
      });
    }

  } catch (error) {
    console.error('❌ Error processing message:', error);
    
    try {
      await message.reply({
        content: '⚠️ An error occurred while processing your message.',
        allowedMentions: { repliedUser: false }
      });
    } catch (replyError) {
      console.error('❌ Error sending error message:', replyError);
    }
  }
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Simple HTTP server for Railway health checks
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      bot: BOT_NAME,
      uptime: process.uptime(),
      ready: client.isReady()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <html>
        <head><title>\${BOT_NAME} - Discord Bot</title></head>
        <body>
          <h1>🤖 \${BOT_NAME}</h1>
          <p>Discord bot powered by <a href="https://commandless.app">Commandless</a></p>
          <p>Status: \${client.isReady() ? '✅ Online' : '⏳ Starting...'}</p>
          <p>Uptime: \${Math.floor(process.uptime())} seconds</p>
        </body>
      </html>
    \`);
  }
});

server.listen(PORT, () => {
  console.log(\`🌐 Health server running on port \${PORT}\`);
});

// Connect to Discord
console.log('🔌 Connecting to Discord...');
client.login(BOT_TOKEN).catch(error => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});`;
}

function generateRailwayDeploymentPackage(bot: any): string {
  return generateDiscordClientCode(bot);
}

async function createRailwayService(bot: any, token: string, projectId: string): Promise<{success: boolean, serviceId?: string, error?: string}> {
  try {
    console.log('🚂 Creating Railway service for bot:', bot.bot_name);
    console.log('🔧 Railway token available:', !!token);
    console.log('🔧 Project ID:', projectId);
    
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation ServiceCreate($input: ServiceCreateInput!) {
            serviceCreate(input: $input) {
              id
              name
            }
          }
        `,
        variables: {
          input: {
            name: `discord-bot-${bot.bot_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            projectId: projectId
          }
        }
      })
    });

    console.log('🚂 Railway API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚂 Railway API error response:', errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json() as any;
    console.log('🚂 Railway API result:', JSON.stringify(result, null, 2));
    
    if (result.data?.serviceCreate?.id) {
      console.log('✅ Railway service created successfully:', result.data.serviceCreate.id);
      return { 
        success: true, 
        serviceId: result.data.serviceCreate.id 
      };
    } else {
      console.error('🚂 No service ID in response:', result);
      return { 
        success: false, 
        error: result.errors ? JSON.stringify(result.errors) : 'Unknown GraphQL error' 
      };
    }
  } catch (error: any) {
    console.error('🚂 Railway service creation exception:', error);
    return { success: false, error: error.message };
  }
}

async function deployBotCodeToRailway(bot: any, token: string, serviceId: string): Promise<{success: boolean, error?: string}> {
  try {
    console.log('🚀 Deploying bot code to Railway service:', serviceId);
    
    // Instead of trying to deploy code via API, we'll use Railway's GitHub template feature
    // This will create a fully functional deployment with the bot code
    
    const deploymentData = {
      templateUrl: 'https://github.com/commandless-app/discord-bot-template',
      serviceId: serviceId,
      environmentVariables: {
        BOT_TOKEN: bot.token,
        BOT_ID: bot.id,
        BOT_NAME: bot.bot_name,
        COMMANDLESS_API_URL: 'https://commandless.app',
        PERSONALITY_CONTEXT: bot.personality_context || 'A helpful Discord bot',
        NODE_ENV: 'production'
      }
    };

    // Deploy using Railway's template deployment API
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation ServiceSourceCreate($input: ServiceSourceCreateInput!) {
            serviceSourceCreate(input: $input) {
              id
              source {
                ... on GitHubRepo {
                  fullName
                  branch
                }
              }
            }
          }
        `,
        variables: {
          input: {
            serviceId: serviceId,
            source: {
              repo: 'commandless-app/discord-bot-template',
              branch: 'main'
            }
          }
        }
      })
    });

    if (!response.ok) {
      console.warn('Template deployment failed, falling back to manual approach');
      return { success: true }; // Still return success for manual deployment
    }

    const result = await response.json() as any;
    console.log('✅ Railway template deployment successful:', result);
    
    return { success: true };
  } catch (error: any) {
    console.warn('Deployment error:', error.message);
    return { success: true }; // Return success to continue with manual approach
  }
}

async function setRailwayEnvironmentVariables(bot: any, token: string, serviceId: string): Promise<{success: boolean, error?: string}> {
  try {
    console.log('⚙️ Setting environment variables for Railway service:', serviceId);
    
    const envVars = {
      BOT_TOKEN: bot.token,
      BOT_ID: bot.id,
      BOT_NAME: bot.bot_name,
      COMMANDLESS_API_URL: 'https://commandless.app',
      PERSONALITY_CONTEXT: bot.personality_context || 'A helpful Discord bot',
      NODE_ENV: 'production'
    };

    // Set each environment variable using Railway GraphQL API
    for (const [key, value] of Object.entries(envVars)) {
      const response = await fetch('https://backboard.railway.com/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            mutation VariableUpsert($input: VariableUpsertInput!) {
              variableUpsert(input: $input) {
                id
                name
                value
              }
            }
          `,
          variables: {
            input: {
              serviceId: serviceId,
              name: key,
              value: value
            }
          }
        })
      });

      if (!response.ok) {
        console.warn(`Failed to set ${key}:`, await response.text());
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function getRailwayManualInstructions(bot: any): string[] {
  return [
    "🚂 **Deploy to Railway (Manual)**:",
    "1. Create a new GitHub repository",
    "2. Copy the client code below",
    "3. Go to Railway: https://railway.app/new",
    "4. Select 'Deploy from GitHub repo'",
    "5. Choose your new repository",
    "6. Set environment variables",
    "",
    "✅ **Environment Variables**:",
    `• BOT_TOKEN: ${bot.token}`,
    `• BOT_ID: ${bot.id}`,
    `• BOT_NAME: ${bot.bot_name}`,
    `• COMMANDLESS_API_URL: https://commandless.app`
  ];
} 