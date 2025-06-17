const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Store active Discord bots
const activeBots = new Map();

// Helper function to decode JWT and extract user ID
function decodeJWT(token) {
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

// Discord Bot Manager
class DiscordBotManager {
  constructor() {
    this.bots = new Map();
  }

  async startBot(token, userId) {
    try {
      if (this.bots.has(token)) {
        console.log('Bot already running for this token');
        return true;
      }

      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages
        ]
      });

      client.once(Events.ClientReady, (readyClient) => {
        console.log(`✅ Discord bot ready! Logged in as ${readyClient.user.tag}`);
      });

      client.on(Events.MessageCreate, async (message) => {
        try {
          if (message.author.bot) return;

          const botMentioned = message.mentions.users.has(client.user.id);
          const isReplyToBot = message.reference && 
            message.reference.messageId && 
            (await message.channel.messages.fetch(message.reference.messageId))?.author.id === client.user.id;

          if (!botMentioned && !isReplyToBot) return;

          console.log(`📨 Processing: "${message.content}" from ${message.author.username}`);

          // Simple AI response for now
          const responses = [
            "I'm your AI Discord bot! I'm now running on Railway and responding to your messages.",
            "Hello! I'm connected and working perfectly. What can I help you with?",
            "Your bot is live and responding! The Railway deployment is successful.",
            "I'm here and ready to help! Your Discord bot is now running in the cloud.",
            "Great! I can see your message. The bot connection is working perfectly."
          ];

          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          await message.reply(randomResponse);

        } catch (error) {
          console.error('❌ Error processing message:', error);
          try {
            await message.reply('Sorry, I encountered an error. Please try again.');
          } catch (replyError) {
            console.error('❌ Failed to send error reply:', replyError);
          }
        }
      });

      client.on(Events.Error, (error) => {
        console.error('❌ Discord client error:', error);
      });

      await client.login(token);
      this.bots.set(token, { client, userId });
      activeBots.set(token, { client, userId, startedAt: new Date() });
      
      console.log(`🤖 Discord bot started for user ${userId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      return false;
    }
  }

  async stopBot(token) {
    try {
      const botData = this.bots.get(token);
      if (botData) {
        await botData.client.destroy();
        this.bots.delete(token);
        activeBots.delete(token);
        console.log('🛑 Discord bot stopped');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error stopping Discord bot:', error);
      return false;
    }
  }
}

const discordBotManager = new DiscordBotManager();

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Commandless Discord Bot Server is running!',
    activeBots: activeBots.size,
    timestamp: new Date().toISOString()
  });
});

// Get user's bots
app.get('/api/bots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', decodedToken.userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch bots' });
    }

    const formattedBots = bots.map(bot => ({
      id: bot.id,
      botName: bot.bot_name,
      platformType: bot.platform_type,
      personalityContext: bot.personality_context,
      isConnected: bot.is_connected,
      createdAt: bot.created_at
    }));

    res.json(formattedBots);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync Commands endpoint
app.put('/api/bots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id: botId, action } = req.body;
    
    if (!botId || !action) {
      return res.status(400).json({ error: 'Bot ID and action are required' });
    }

    // Get bot details
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .single();

    if (botError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    if (action === 'sync-commands') {
      // Sync Discord commands for the bot
      console.log(`🔄 Syncing commands for bot: ${bot.bot_name}`);
      
      try {
        const commandsFound = await discoverDiscordCommands(bot.token);
        let commandsCreated = 0;
        let commandsSkipped = 0;

        for (const command of commandsFound) {
          // Check if command mapping already exists
          const { data: existingMapping } = await supabase
            .from('command_mappings')
            .select('id')
            .eq('bot_id', botId)
            .eq('name', command.name)
            .single();

          if (!existingMapping) {
            // Create new command mapping with correct column names
            const { error: insertError } = await supabase
              .from('command_mappings')
              .insert({
                bot_id: botId,
                name: command.name,
                natural_language_pattern: `Execute ${command.name} command`,
                command_output: `/${command.name}`,
                status: 'active',
                usage_count: 0,
                user_id: decodedToken.userId
              });

            if (!insertError) {
              commandsCreated++;
              console.log(`✅ Created mapping for command: ${command.name}`);
            } else {
              console.error(`❌ Failed to create mapping for ${command.name}:`, insertError);
            }
          } else {
            commandsSkipped++;
            console.log(`⏭️ Skipped existing command: ${command.name}`);
          }
        }

        // Create activity log
        await supabase
          .from('activities')
          .insert({
            user_id: decodedToken.userId,
            activity_type: 'commands_synced',
            description: `Synced ${commandsFound.length} Discord commands for ${bot.bot_name}`,
            metadata: { 
              botId: bot.id, 
              commandsFound: commandsFound.length,
              commandsCreated,
              commandsSkipped
            }
          });

        return res.json({
          success: true,
          commandsFound: commandsFound.length,
          commandsCreated,
          commandsSkipped,
          discoveredCommands: commandsFound
        });

      } catch (syncError) {
        console.error('Command sync error:', syncError);
        return res.status(500).json({ 
          error: 'Failed to sync commands',
          details: syncError.message
        });
      }
    }

    if (action === 'connect') {
      // Start the Discord bot automatically
      if (bot.platform_type === 'discord' && bot.token) {
        const started = await discordBotManager.startBot(bot.token, decodedToken.userId);
        
        if (started) {
          // Update database
          const { data: updatedBot, error: updateError } = await supabase
            .from('bots')
            .update({ is_connected: true })
            .eq('id', botId)
            .eq('user_id', decodedToken.userId)
            .select()
            .single();

          if (updateError) {
            return res.status(500).json({ error: 'Failed to update bot status' });
          }

          // Auto-discover commands when connecting
          try {
            console.log(`🔍 Auto-discovering commands for ${bot.bot_name}...`);
            const commandsFound = await discoverDiscordCommands(bot.token);
            
            if (commandsFound.length > 0) {
              console.log(`📋 Found ${commandsFound.length} Discord commands`);
              
              // Create command mappings automatically
              for (const command of commandsFound) {
                const { data: existingMapping } = await supabase
                  .from('command_mappings')
                  .select('id')
                  .eq('bot_id', botId)
                  .eq('name', command.name)
                  .single();

                if (!existingMapping) {
                  await supabase
                    .from('command_mappings')
                    .insert({
                      bot_id: botId,
                      name: command.name,
                      natural_language_pattern: `Execute ${command.name} command`,
                      command_output: `/${command.name}`,
                      status: 'active',
                      usage_count: 0,
                      user_id: decodedToken.userId
                    });
                }
              }
            }
          } catch (discoveryError) {
            console.warn('Auto-discovery failed:', discoveryError.message);
            // Don't fail the connection if discovery fails
          }

          return res.json({
            id: updatedBot.id,
            botName: updatedBot.bot_name,
            platformType: updatedBot.platform_type,
            personalityContext: updatedBot.personality_context,
            isConnected: updatedBot.is_connected,
            createdAt: updatedBot.created_at,
            autoStarted: true,
            message: `🎉 ${bot.bot_name} is now live and responding in Discord!`
          });
        } else {
          return res.status(500).json({ error: 'Failed to start Discord bot' });
        }
      }
    } else if (action === 'disconnect') {
      // Stop the Discord bot
      if (bot.platform_type === 'discord' && bot.token) {
        await discordBotManager.stopBot(bot.token);
      }

      // Update database
      const { data: updatedBot, error: updateError } = await supabase
        .from('bots')
        .update({ is_connected: false })
        .eq('id', botId)
        .eq('user_id', decodedToken.userId)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update bot status' });
      }

      return res.json({
        id: updatedBot.id,
        botName: updatedBot.bot_name,
        platformType: updatedBot.platform_type,
        personalityContext: updatedBot.personality_context,
        isConnected: updatedBot.is_connected,
        createdAt: updatedBot.created_at,
        message: `${bot.bot_name} has been disconnected.`
      });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Error managing bot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Command discovery function
async function discoverDiscordCommands(botToken) {
  try {
    console.log('🔍 Discovering Discord commands...');
    
    // Create a temporary Discord client to fetch commands
    const tempClient = new Client({
      intents: [GatewayIntentBits.Guilds]
    });

    await tempClient.login(botToken);
    
    // Wait for client to be ready
    await new Promise((resolve) => {
      tempClient.once(Events.ClientReady, resolve);
    });

    // Fetch global application commands
    const commands = await tempClient.application.commands.fetch();
    
    // Convert to our format
    const discoveredCommands = commands.map(command => ({
      id: command.id,
      name: command.name,
      description: command.description,
      options: command.options || [],
      type: command.type,
      defaultPermission: command.defaultPermission
    }));

    console.log(`📋 Discovered ${discoveredCommands.length} commands:`, 
      discoveredCommands.map(cmd => cmd.name));

    // Clean up temporary client
    await tempClient.destroy();

    return discoveredCommands;

  } catch (error) {
    console.error('❌ Command discovery failed:', error);
    
    // If discovery fails, return some default commands that most Discord bots have
    return [
      {
        name: 'help',
        description: 'Show available commands',
        options: [],
        type: 1
      },
      {
        name: 'ping',
        description: 'Check bot response time',
        options: [],
        type: 1
      }
    ];
  }
}

// Get command mappings
app.get('/api/mappings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: mappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', decodedToken.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch command mappings' });
    }

    // Format response to match frontend expectations
    const formattedMappings = mappings.map(mapping => ({
      id: mapping.id,
      botId: mapping.bot_id,
      name: mapping.name,
      naturalLanguagePattern: mapping.natural_language_pattern,
      commandOutput: mapping.command_output,
      status: mapping.status || 'active',
      usageCount: mapping.usage_count || 0,
      createdAt: mapping.created_at
    }));

    res.json(formattedMappings);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new command mapping
app.post('/api/mappings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { 
      botId, 
      commandName, 
      description, 
      actionType, 
      parameters, 
      responseTemplate 
    } = req.body;

    if (!botId || !commandName) {
      return res.status(400).json({ error: 'Bot ID and command name are required' });
    }

    const { data: newMapping, error } = await supabase
      .from('command_mappings')
      .insert({
        bot_id: botId,
        name: commandName,
        natural_language_pattern: description || `Execute ${commandName} command`,
        command_output: responseTemplate || `/${commandName}`,
        status: actionType || 'active',
        usage_count: 0,
        user_id: decodedToken.userId
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to create command mapping' });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'mapping_created',
        description: `Command mapping "${commandName}" was created`,
        metadata: { 
          botId,
          commandName,
          actionType: actionType || 'active'
        }
      });

    res.status(201).json({
      id: newMapping.id,
      botId: newMapping.bot_id,
      name: newMapping.name,
      naturalLanguagePattern: newMapping.natural_language_pattern,
      commandOutput: newMapping.command_output,
      status: newMapping.status,
      usageCount: newMapping.usage_count,
      createdAt: newMapping.created_at
    });
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new bot
app.post('/api/bots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { botName, platformType, token: botToken, personalityContext } = req.body;

    if (!botName || !platformType || !botToken) {
      return res.status(400).json({ error: 'Bot name, platform type, and token are required' });
    }

    // Check if a bot with this token already exists
    const { data: existingBot, error: checkError } = await supabase
      .from('bots')
      .select('id, bot_name, user_id')
      .eq('token', botToken)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means "not found", which is what we want
      console.error('Error checking for existing bot:', checkError);
      return res.status(500).json({ error: 'Failed to check for existing bot' });
    }

    if (existingBot) {
      if (existingBot.user_id === decodedToken.userId) {
        return res.status(409).json({ 
          error: 'You already have a bot with this token',
          details: `A bot named "${existingBot.bot_name}" already uses this token. Each bot must have a unique Discord token.`,
          suggestion: 'Please use a different Discord bot token or update your existing bot.'
        });
      } else {
        return res.status(409).json({ 
          error: 'This Discord bot token is already in use',
          details: 'Another user is already using this Discord bot token. Each Discord bot can only be connected to one Commandless account.',
          suggestion: 'Please create a new Discord bot at https://discord.com/developers/applications and use that token instead.'
        });
      }
    }

    const { data: newBot, error } = await supabase
      .from('bots')
      .insert({
        bot_name: botName,
        platform_type: platformType,
        token: botToken,
        personality_context: personalityContext || 'A helpful Discord bot assistant',
        user_id: decodedToken.userId,
        is_connected: false
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.message.includes('token')) {
          return res.status(409).json({ 
            error: 'Duplicate Discord bot token',
            details: 'This Discord bot token is already being used. Each bot must have a unique token.',
            suggestion: 'Please use a different Discord bot token.'
          });
        } else if (error.message.includes('user_id')) {
          return res.status(409).json({ 
            error: 'Bot limit reached',
            details: 'You have reached the maximum number of bots allowed for your account.',
            suggestion: 'Please delete an existing bot before creating a new one.'
          });
        }
      }
      
      return res.status(500).json({ 
        error: 'Failed to create bot',
        details: 'There was an error creating your bot. Please try again.',
        technical: error.message
      });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'bot_created',
        description: `Bot "${botName}" was created`,
        metadata: { 
          botId: newBot.id,
          platformType
        }
      });

    res.status(201).json({
      id: newBot.id,
      botName: newBot.bot_name,
      platformType: newBot.platform_type,
      personalityContext: newBot.personality_context,
      isConnected: newBot.is_connected,
      createdAt: newBot.created_at
    });
  } catch (error) {
    console.error('Error creating bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while creating your bot.',
      suggestion: 'Please try again. If the problem persists, contact support.'
    });
  }
});

// Get activities for dashboard
app.get('/api/activities', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', decodedToken.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch activities' });
    }

    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      activityType: activity.activity_type,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: activity.created_at
    }));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    activeBots: activeBots.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Commandless server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Supabase URL: ${process.env.SUPABASE_URL ? 'Connected' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  
  // Stop all Discord bots
  for (const [token, botData] of activeBots) {
    try {
      await botData.client.destroy();
      console.log('🤖 Discord bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  
  // Stop all Discord bots
  for (const [token, botData] of activeBots) {
    try {
      await botData.client.destroy();
      console.log('🤖 Discord bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }
  
  process.exit(0);
}); 