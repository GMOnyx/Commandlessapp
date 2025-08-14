import { Client, GatewayIntentBits, Events, PermissionFlagsBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import express from 'express';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COMMANDLESS_API_URL = process.env.COMMANDLESS_API_URL || 'https://commandless-app-production.up.railway.app';
const CHECK_INTERVAL = 30000; // Check for new bots every 30 seconds

console.log('🚀 Starting Universal Discord Relay Service');
console.log('🔗 Commandless API:', COMMANDLESS_API_URL);
console.log('🧩 URS Mode: unified slash + conversational executor (build: 2025-08-12)');
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
    client.once(Events.ClientReady, async (readyClient) => {
      console.log(`✅ ${bot.bot_name} ready! Logged in as ${readyClient.user.tag}`);
      
      // Register discovered commands as Discord slash commands
      await registerSlashCommands(readyClient, bot.user_id);
    });

    // Handle slash command interactions
    client.on(Events.InteractionCreate, async (interaction) => {
      console.log(`🚨 [DEBUG] InteractionCreate fired! Command: ${interaction.commandName}, Type: ${interaction.type}`);
      
      if (!interaction.isChatInputCommand()) return;

      try {
        console.log(`🎯 Slash command received: /${interaction.commandName}`);
        console.log('🧪 Unified slash handler active: converting options -> commandOutput');
        
        // Immediately defer the reply to prevent timeout
        await interaction.deferReply({ ephemeral: false });
        console.log(`⏳ Interaction deferred, processing command...`);
        
        // Build command output from mapping and slash options, then execute via the common path
        // This unifies behavior between conversational and slash commands
        let commandOutput = await convertSlashCommandToCommandOutput(interaction, bot.user_id);
        if (!commandOutput) {
          // Fallback to bare command if no mapping exists
          commandOutput = `/${interaction.commandName}`;
        }

        const result = await executeDiscordCommand(commandOutput, {
          guild: interaction.guild,
          channel: interaction.channel,
          author: interaction.user,
          client: interaction.client,
          isSlashCommand: true,
        });
        console.log(`📤 Slash command result:`, result);

        // Follow up with the result
        try {
          await interaction.editReply({ content: result.response });
          console.log(`✅ Sent response: ${result.response}`);
        } catch (replyError) {
          if (replyError && replyError.code === 40060) {
            console.log(`⚠️ Interaction already acknowledged by another handler: ${replyError.message}`);
          } else {
            console.error(`❌ Failed to edit reply:`, replyError);
          }
        }
      } catch (error) {
        console.error('❌ Error handling slash command:', error);
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ An error occurred while executing the command', ephemeral: true });
        }
      }
    });

    // Subscribe to command mapping changes for this user to live-refresh slash commands
    try {
      const channel = supabase
        .channel(`realtime-cm-${bot.user_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'command_mappings',
            filter: `user_id=eq.${bot.user_id}`,
          },
          async (payload) => {
            try {
              console.log(`🔁 Detected command_mappings change for user ${bot.user_id}:`, payload.eventType);
              await registerSlashCommands(client, bot.user_id);
            } catch (e) {
              console.error('❌ Failed to refresh slash commands:', e);
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 Realtime subscription (user ${bot.user_id}) status:`, status);
        });
    } catch (e) {
      console.error('❌ Failed to initialize realtime subscription for command mappings:', e);
    }

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
        const response = await fetch(`${COMMANDLESS_API_URL}/api/discord?action=process-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        });

        const result = await response.json();

        if (result.processed && result.response) {
          console.log(`🤖 [${bot.bot_name}] AI Response: ${result.response}`);
          
          // Check if this is a command that needs execution
          const isCommandExecution = result.response.startsWith('Command executed:');
          
          if (isCommandExecution) {
            console.log(`⚡ [${bot.bot_name}] Executing Discord command: ${result.response}`);
            
            // Execute the actual Discord command
            const executionResult = await executeDiscordCommand(result.response, message);
            
            if (executionResult.success) {
              // Send the execution result if there's a response
              if (executionResult.response) {
                const botMessage = await message.reply(executionResult.response);
                
                // Track bot message for reply detection
                if (botMessage) {
                  botMessageIds.add(botMessage.id);
                  messageContextManager.addMessage(
                    message.channelId,
                    botMessage.id,
                    executionResult.response,
                    client.user.tag,
                    true
                  );
                }
              }
              
              console.log(`✅ [${bot.bot_name}] Command executed successfully`);
            } else {
              // Send error message
              const errorMessage = await message.reply(executionResult.response);
              
              // Track bot message for reply detection
              if (errorMessage) {
                botMessageIds.add(errorMessage.id);
                messageContextManager.addMessage(
                  message.channelId,
                  errorMessage.id,
                  executionResult.response,
                  client.user.tag,
                  true
                );
              }
              
              console.log(`❌ [${bot.bot_name}] Command execution failed: ${executionResult.response}`);
            }
          } else {
            // This is a regular conversational response
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
          }
          
          // Clean up old message IDs (keep last 1000)
          if (botMessageIds.size > 1000) {
            const oldestIds = Array.from(botMessageIds).slice(0, botMessageIds.size - 1000);
            oldestIds.forEach(id => botMessageIds.delete(id));
          }

          if (result.execution) {
            console.log(`⚡ [${bot.bot_name}] Command executed: ${result.execution.success ? 'Success' : 'Failed'}`);
            if (result.execution.error) {
              console.log(`❌ [${bot.bot_name}] Error: ${result.execution.error}`);
            }
          }
        } else {
          console.log(`⏭️ [${bot.bot_name}] Not processed: ${result.reason || 'Unknown reason'}`);
        }

      } catch (error) {
        console.error(`❌ [${bot.bot_name}] Error processing message:`, error);
        try {
          await message.reply('Sorry, I encountered an error. Please try again.');
        } catch (replyError) {
          console.error(`❌ [${bot.bot_name}] Failed to send error reply:`, replyError);
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
    console.error(`❌ Failed to create client for ${bot.bot_name}:`, error);
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
      console.log(`✅ Started bot: ${bot.bot_name} for user ${bot.user_id}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`❌ Failed to start bot ${bot.bot_name}:`, error);
    return false;
  }
}

// Stop a bot client
async function stopBot(token) {
  try {
    const clientData = activeClients.get(token);
    if (clientData) {
      await clientData.client.destroy();
      activeClients.delete(token);
      console.log(`🛑 Stopped bot: ${clientData.botInfo.bot_name}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Failed to stop bot:`, error);
    return false;
  }
}

// Sync bots with database
async function syncBots() {
  try {
    const connectedBots = await loadConnectedBots();
    const currentTokens = new Set(activeClients.keys());
    const shouldBeRunning = new Set(connectedBots.map(bot => bot.token));

    // Start new bots
    for (const bot of connectedBots) {
      if (!currentTokens.has(bot.token)) {
        console.log(`🆕 Starting new bot: ${bot.bot_name}`);
        await startBot(bot);
      }
    }

    // Stop removed bots
    for (const token of currentTokens) {
      if (!shouldBeRunning.has(token)) {
        console.log(`🗑️ Stopping removed bot`);
        await stopBot(token);
      }
    }

    console.log(`🔄 Sync complete. Running bots: ${activeClients.size}`);
    
  } catch (error) {
    console.error('❌ Error during bot sync:', error);
  }
}

// Express health check server
const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', bots: activeClients.size });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

/**
 * Register discovered command mappings as Discord slash commands
 */
async function registerSlashCommands(client, userId) {
  try {
    console.log('🔄 Registering slash commands from database...');
    
    // Get command mappings from database
    const { data: commandMappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (error) {
      console.error('❌ Error fetching command mappings:', error);
      return;
    }
    
    if (!commandMappings || commandMappings.length === 0) {
      console.log('📝 No command mappings found to register');
      return;
    }
    
    // Group mappings by top-level command; detect subcommand (facet) in output (e.g., "/ban add ...")
    const groupMap = new Map(); // name -> { name, description, options or subcommands[] }
    for (const mapping of commandMappings) {
      const output = mapping.command_output || '';
      const tokens = output.trim().split(/\s+/);
      const main = tokens[0]?.startsWith('/') ? tokens[0].slice(1) : 'unknown';
      const maybeFacet = tokens[1] && !tokens[1].includes(':') && !tokens[1].startsWith('{') ? tokens[1] : null;
      const description = mapping.natural_language_pattern || `Execute ${main} command`;

      if (!groupMap.has(main)) {
        groupMap.set(main, { name: main, description: description, subcommands: [], options: [] });
      }

      const entry = groupMap.get(main);
      if (maybeFacet) {
        // Treat as subcommand
        entry.subcommands.push({
          type: 1, // SUB_COMMAND
          name: maybeFacet,
          description: description.length > 100 ? description.substring(0, 97) + '...' : description,
          options: extractSlashCommandOptions(output)
        });
      } else {
        // Standalone command
        // If subcommands already exist, keep as-is; otherwise use options at top level
        if (entry.subcommands.length === 0) {
          entry.options = extractSlashCommandOptions(output);
          entry.description = description.length > 100 ? description.substring(0, 97) + '...' : description;
        }
      }
    }

    // Build final payload
    const slashPayload = Array.from(groupMap.values()).map(cmd => {
      if (cmd.subcommands.length > 0) {
        return { name: cmd.name, description: cmd.description, options: cmd.subcommands };
      }
      return { name: cmd.name, description: cmd.description, options: cmd.options };
    });

    console.log(`📋 Registering ${slashPayload.length} commands (with subcommands when applicable):`, slashPayload.map(c => c.name).join(', '));

    await client.application.commands.set(slashPayload);
    
    console.log('✅ Slash commands registered successfully');
    
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

/**
 * Convert Discord slash command interaction to command output format
 */
async function convertSlashCommandToCommandOutput(interaction, userId) {
  try {
    try {
      console.log('🧩 [Slash] Raw options payload:', JSON.stringify(interaction?.options?.data || [], null, 2));
    } catch {}
    // Find the command mapping in the database
    const { data: commandMappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (error || !commandMappings) {
      console.error('❌ Error fetching command mappings:', error);
      return null;
    }
    
    // Find matching mapping by command and optional subcommand (facet)
    const sub = interaction.options?.data?.find?.(d => d.type === 1 /* SUB_COMMAND */)?.name || null;
    try {
      console.log('🧩 [Slash] Command:', interaction.commandName, 'Subcommand:', sub || '(none)');
    } catch {}
    const matchingMapping = commandMappings.find(mapping => {
      const output = mapping.command_output || '';
      const tokens = output.trim().split(/\s+/);
      const main = tokens[0]?.startsWith('/') ? tokens[0].slice(1) : 'unknown';
      const facet = tokens[1] && !tokens[1].includes(':') && !tokens[1].startsWith('{') ? tokens[1] : null;
      return main === interaction.commandName && (sub ? facet === sub : !facet);
    });
    
    if (!matchingMapping) {
      console.log(`❌ No mapping found for slash command: ${interaction.commandName}`);
      try {
        const candidates = (commandMappings || []).filter(m => {
          const output = m.command_output || '';
          const tokens = output.trim().split(/\s+/);
          const main = tokens[0]?.startsWith('/') ? tokens[0].slice(1) : 'unknown';
          return main === interaction.commandName;
        }).map(m => ({ id: m.id, name: m.name, output: m.command_output }));
        console.log('🧪 [Slash] Candidates for main command:', JSON.stringify(candidates, null, 2));
      } catch {}
      return null;
    }
    try {
      console.log('✅ [Slash] Selected mapping:', { id: matchingMapping.id, name: matchingMapping.name, output: matchingMapping.command_output });
    } catch {}
    
    // Start with the command output template
    let commandOutput = matchingMapping.command_output;
    let capturedUserId = null;
    const before = commandOutput;

    // Replace parameters with values from slash command options (handle nested subcommand options)
    const normalizeName = (name, type) => {
      const n = String(name || '').toLowerCase();
      const map = {
        'user': 'user', 'member': 'user', 'target': 'user', 'person': 'user', 'player': 'user', 'user-id': 'user', 'userid': 'user', 'user_id': 'user', 'id': 'user',
        'reason': 'reason', 'message': 'message', 'description': 'reason', 'cause': 'reason', 'text': 'message', 'content': 'message',
        'duration': 'duration', 'time': 'duration', 'timeout': 'duration', 'length': 'duration',
        'amount': 'amount', 'number': 'amount', 'count': 'amount', 'quantity': 'amount',
        'channel': 'channel', 'room': 'channel',
        'role': 'role', 'rank': 'role',
        'name': 'name', 'title': 'name'
      };
      if (map[n]) return map[n];
      // Discord type fallbacks
      if (type === 6) return 'user';
      if (type === 7) return 'channel';
      if (type === 8) return 'role';
      if (type === 4 || type === 10) return 'amount';
      return n;
    };

    const applyOptions = (opts) => {
      if (!Array.isArray(opts)) return;
      opts.forEach(option => {
        if (option.type === 1 && Array.isArray(option.options)) {
          // SUB_COMMAND: apply its child options
          applyOptions(option.options);
          return;
        }
        const placeholder = `{${option.name}}`;
        const canonical = `{${normalizeName(option.name, option.type)}}`;
        let value = option.value;
        // USER type
        if (option.type === 6) {
          value = `<@${option.value}>`;
          capturedUserId = option.value;
        }
        // Replace all occurrences of this placeholder
        commandOutput = commandOutput.replace(new RegExp(`\\{${option.name}\\}`, 'g'), value);
        // Also replace canonical placeholder if different
        if (canonical !== placeholder) {
          commandOutput = commandOutput.replace(new RegExp(canonical.replace(/[{}]/g, m => `\\${m}`), 'g'), value);
        }
      });
    };

    if (interaction.options && Array.isArray(interaction.options.data)) {
      applyOptions(interaction.options.data);
    }
    // Fallback: if no user mention present but we captured a USER option, append it
    if (!/(<@!?\d+>)|(\d{17,19})/.test(commandOutput) && capturedUserId) {
      commandOutput += ` <@${capturedUserId}>`;
      try { console.log('🧷 [Slash] Appended fallback user to output:', commandOutput); } catch {}
    }
    try {
      console.log('🛠️ [Slash] Output before:', before);
      console.log('🛠️ [Slash] Output after: ', commandOutput);
    } catch {}
    
    // Replace any remaining placeholders with defaults
    commandOutput = commandOutput.replace(/\{reason\}/g, 'No reason provided');
    commandOutput = commandOutput.replace(/\{message\}/g, 'No message provided');
    commandOutput = commandOutput.replace(/\{amount\}/g, '1');
    commandOutput = commandOutput.replace(/\{duration\}/g, '5m');
    
    console.log(`🔄 Converted slash command to: ${commandOutput}`);
    return commandOutput;
    
  } catch (error) {
    console.error('❌ Error converting slash command:', error);
    return null;
  }
}

/**
 * Extract command name from command output (e.g., "mute" from "/mute {user} {reason}")
 */
function extractCommandName(commandOutput) {
  const match = commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Extract slash command options from command output parameters
 */
function extractSlashCommandOptions(commandOutput) {
  const options = [];
  const paramRegex = /\{([^}]+)\}/g;
  let match;
  
  while ((match = paramRegex.exec(commandOutput)) !== null) {
    const paramName = match[1];
    
    // Map parameter names to Discord option types
    let option = {
      name: paramName,
      description: `The ${paramName} parameter`,
      required: true
    };
    
    switch (paramName) {
      case 'user':
        option.type = 6; // USER
        option.description = 'The user to target';
        break;
      case 'reason':
        option.type = 3; // STRING
        option.description = 'The reason for this action';
        option.required = false;
        break;
      case 'message':
        option.type = 3; // STRING
        option.description = 'The message content';
        break;
      case 'duration':
        option.type = 3; // STRING
        option.description = 'Duration (e.g., 10m, 1h, 1d)';
        option.required = false;
        break;
      case 'amount':
        option.type = 4; // INTEGER
        option.description = 'Amount or number';
        option.required = false;
        break;
      case 'channel':
        option.type = 7; // CHANNEL
        option.description = 'The channel to target';
        break;
      case 'role':
        option.type = 8; // ROLE
        option.description = 'The role to assign';
        break;
      default:
        option.type = 3; // STRING
        break;
    }
    
    options.push(option);
  }
  // Discord requires required options before optional ones
  options.sort((a, b) => (a.required === b.required ? 0 : a.required ? -1 : 1));
  
  return options;
}

// Main startup
async function main() {
  console.log('🚀 Universal Discord Relay Service starting...');
  
  // Initial bot sync
  await syncBots();
  
  // Periodic sync for new/removed bots
  setInterval(syncBots, CHECK_INTERVAL);
  
  console.log('✅ Universal Discord Relay Service is running');
  console.log(`🔄 Checking for bot changes every ${CHECK_INTERVAL / 1000} seconds`);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  
  // Stop all bots
  for (const token of activeClients.keys()) {
    await stopBot(token);
  }
  
  console.log('👋 Universal Discord Relay Service stopped');
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Start the service
main().catch(error => {
  console.error('❌ Failed to start service:', error);
  process.exit(1);
});

// Discord.js Command Execution Function
async function executeDiscordCommand(commandOutput, message) {
  try {
    // Extract the command name from the command output (e.g., "/pin" from "Command executed: /pin")
    const commandMatch = commandOutput.match(/^(?:Command executed:\s*)?\/([a-zA-Z0-9_-]+)/);
    if (!commandMatch) {
      return {
        success: false,
        response: `❌ Invalid command format: ${commandOutput}`
      };
    }

    const command = commandMatch[1].toLowerCase();
    const botMember = message.guild?.members?.me;
    
    if (!botMember) {
      return {
        success: false,
        response: "❌ Bot is not in a guild"
      };
    }

    console.log(`⚡ Executing Discord command: ${command}`);

    switch (command) {
      case 'pin':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return { success: false, response: "❌ I don't have permission to pin messages" };
          }

          // Handle different contexts (slash command vs regular message)
          const isSlashCommand = message.isSlashCommand;
          
          if (isSlashCommand) {
            // For slash commands, we need to get the message to pin from context
            // Since slash commands don't have a specific message to pin, 
            // we'll pin the most recent regular message in the channel (not the slash command)
            try {
              const messages = await message.channel.messages.fetch({ limit: 10 });
              // Find the first message that's not a slash command (slash commands don't show as messages)
              const messageToPin = messages.find(msg => !msg.author.bot || msg.content);
              
              if (!messageToPin) {
                return { success: false, response: "❌ No message found to pin" };
              }
              
              await messageToPin.pin();
              
              return {
                success: true,
                response: `📌 **Message pinned**\n**Pinned by:** ${message.author.username}`
              };
            } catch (error) {
              return { success: false, response: `❌ Failed to pin message: ${error.message}` };
            }
          } else {
            // Regular message context - pin the message that the user replied to, or the user's message
            let messageToPin = message;
            
            // Check if this is a reply and pin the original message
            if (message.reference?.messageId) {
              try {
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (referencedMessage) {
                  messageToPin = referencedMessage;
                }
              } catch (error) {
                // If we can't fetch the referenced message, pin the command message
              }
            }
            
            await messageToPin.pin();
            
            return {
              success: true,
              response: `📌 **Message pinned**\n**Pinned by:** ${message.author.username}`
            };
          }
        } catch (error) {
          return { success: false, response: `❌ Failed to pin message: ${error.message}` };
        }

      case 'ping':
        const ping = message.client.ws.ping;
        return { success: true, response: `🏓 **Pong!** Latency: ${ping}ms` };

      case 'say':
        try {
          // Extract message from command output
          const sayMatch = commandOutput.match(/say\s+(.+)/i) || commandOutput.match(/\{message\}\s*(.+)/i);
          const messageContent = sayMatch ? sayMatch[1] : 'Hello everyone!';
          
          await message.channel.send(messageContent);
          // Delete the triggering message when available (not present for slash)
          if (typeof message.delete === 'function') {
            await message.delete().catch(() => {});
          }
          
          return { success: true, response: '' }; // Empty response since we handled it above
        } catch (error) {
          return { success: false, response: `❌ Failed to send message: ${error.message}` };
        }

      case 'purge':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return { success: false, response: "❌ I don't have permission to manage messages" };
          }

          // Extract amount from command output or default to 1
          const amountMatch = commandOutput.match(/(\d+)/);
          const amount = amountMatch ? Math.min(parseInt(amountMatch[1]), 100) : 1;
          
          if (!message.channel.isTextBased() || message.channel.isDMBased()) {
            return { success: false, response: "❌ This command can only be used in server text channels" };
          }
          
          // Delete the triggering message when available (not present for slash)
          if (typeof message.delete === 'function') {
            await message.delete().catch(() => {});
          }
          
          if ('bulkDelete' in message.channel) {
            const deleted = await message.channel.bulkDelete(amount, true);
            
            const response = await message.channel.send(`🗑️ **Purged ${deleted.size} message(s)**`);
            // Auto-delete the confirmation after 5 seconds
            setTimeout(() => response.delete().catch(() => {}), 5000);
            
            return { success: true, response: '' }; // Empty response since we handled it above
          } else {
            return { success: false, response: "❌ This channel doesn't support bulk delete" };
          }
        } catch (error) {
          return { success: false, response: `❌ Failed to purge messages: ${error.message}` };
        }

      case 'ban':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            return { success: false, response: "❌ I don't have permission to ban members" };
          }

          // Normalize potential AI prefix and support facets
          const cleanedOutput = commandOutput.replace(/^Command executed:\s*/i, '');
          // Support facet 'remove' for unban and default/add for ban
          const tokens = cleanedOutput.trim().split(/\s+/);
          const facet = tokens[1] && !tokens[1].includes(':') && !tokens[1].startsWith('{') ? tokens[1].toLowerCase() : null;
          console.log('🧭 [Exec] ban facet detected:', facet || '(none)', 'from output:', cleanedOutput);

          if (facet === 'remove' || facet === 'unban') {
            // Unban flow
            let targetId = null;
            const um = cleanedOutput.match(/<@!?(\d+)>/) || cleanedOutput.match(/(\d{17,19})/);
            if (um) targetId = um[1];
            if (!targetId) {
              console.log('⚠️ [Exec] Unban missing user in output:', cleanedOutput);
              return { success: false, response: "❌ Please specify a valid user to unban" };
            }
            await message.guild.bans.remove(targetId, `Unbanned by ${message.author.username}`);
            return { success: true, response: `✅ **User unbanned**\n**User:** <@${targetId}>\n**By:** ${message.author.username}` };
          }

          // Extract user ID from command output (ban/add)
          let userId = null;
          const userMatch = cleanedOutput.match(/<@!?(\d+)>/) || cleanedOutput.match(/user:?(\d{17,19})/) || cleanedOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          }

          if (!userId) {
            console.log('⚠️ [Exec] Ban missing user in output:', cleanedOutput);
            return { success: false, response: "❌ Please specify a valid user to ban" };
          }

          // Extract reason
          const reasonMatch = cleanedOutput.match(/reason:?\s*(.+)/) || 
                             cleanedOutput.match(/for\s+(.+)/) ||
                             cleanedOutput.match(/\{reason\}\s*(.+)/);
          const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

          await message.guild.bans.create(userId, { 
            reason: `${reason} (Banned by ${message.author.username})` 
          });
          
          return {
            success: true,
            response: `🔨 **User banned**\n**User:** <@${userId}>\n**Reason:** ${reason}\n**Banned by:** ${message.author.username}`
          };
        } catch (error) {
          return { success: false, response: `❌ Failed to ban user: ${error.message}` };
        }

      case 'kick':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
            return { success: false, response: "❌ I don't have permission to kick members" };
          }

          // Extract user ID from command output
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to kick" };
          }

          const reasonMatch = commandOutput.match(/reason:?\s*(.+)/) || 
                             commandOutput.match(/for\s+(.+)/);
          const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

          const member = await message.guild.members.fetch(userId);
          await member.kick(`${reason} (Kicked by ${message.author.username})`);
          
          return {
            success: true,
            response: `👢 **User kicked**\n**User:** ${member.displayName}\n**Reason:** ${reason}\n**Kicked by:** ${message.author.username}`
          };
        } catch (error) {
          return { success: false, response: `❌ Failed to kick user: ${error.message}` };
        }

      case 'mute':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return { success: false, response: "❌ I don't have permission to timeout members" };
          }

          // Extract user ID from command output 
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to mute" };
          }

          // Extract duration (default 10 minutes)
          const durationMatch = commandOutput.match(/(\d+)\s*([mhd])/i);
          let duration = 10 * 60 * 1000; // 10 minutes default
          
          if (durationMatch) {
            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            switch (unit) {
              case 'm': duration = amount * 60 * 1000; break;
              case 'h': duration = amount * 60 * 60 * 1000; break;
              case 'd': duration = amount * 24 * 60 * 60 * 1000; break;
            }
          }

          const reasonMatch = commandOutput.match(/reason:?\s*(.+)/) || 
                             commandOutput.match(/for\s+(.+)/);
          const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

          const member = await message.guild.members.fetch(userId);
          const timeoutUntil = new Date(Date.now() + duration);
          
          await member.timeout(duration, `${reason} (Muted by ${message.author.username})`);
          
          return {
            success: true,
            response: `🔇 **User muted**\n**User:** ${member.displayName}\n**Duration:** until ${timeoutUntil.toLocaleString()}\n**Reason:** ${reason}\n**Muted by:** ${message.author.username}`
          };
        } catch (error) {
          return { success: false, response: `❌ Failed to mute user: ${error.message}` };
        }

      case 'warn':
        try {
          // Extract user ID from command output
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to warn" };
          }

          const reasonMatch = commandOutput.match(/reason:?\s*(.+)/) || 
                             commandOutput.match(/for\s+(.+)/);
          const reason = reasonMatch ? reasonMatch[1] : 'No reason provided';

          const member = await message.guild.members.fetch(userId);
          
          // Send warning in channel
          const warningResponse = `⚠️ **User warned**\n**User:** ${member.displayName}\n**Reason:** ${reason}\n**Warned by:** ${message.author.username}`;
          
          // Try to DM the user
          try {
            await member.send(`⚠️ **Warning from ${message.guild.name}**\n**Reason:** ${reason}\n**Warned by:** ${message.author.username}`);
          } catch (dmError) {
            // If DM fails, that's okay
          }
          
          return {
            success: true,
            response: warningResponse
          };
        } catch (error) {
          return { success: false, response: `❌ Failed to warn user: ${error.message}` };
        }

      case 'slowmode':
        try {
          if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return { success: false, response: "❌ I don't have permission to manage channels" };
          }

          // Extract duration in seconds (default 30 seconds)
          const durationMatch = commandOutput.match(/(\d+)/);
          const duration = durationMatch ? Math.min(parseInt(durationMatch[1]), 21600) : 30; // Max 6 hours
          
          if (!message.channel.isTextBased() || message.channel.isDMBased()) {
            return { success: false, response: "❌ This command can only be used in server text channels" };
          }

          if ('setRateLimitPerUser' in message.channel) {
            await message.channel.setRateLimitPerUser(duration, `Slowmode set by ${message.author.username}`);
            
            const formattedDuration = duration === 0 ? 'disabled' : 
              duration >= 3600 ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m` :
              duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;
            
            return {
              success: true,
              response: `🐌 **Slowmode ${duration === 0 ? 'disabled' : 'enabled'}**\n**Duration:** ${formattedDuration}\n**Set by:** ${message.author.username}`
            };
          } else {
            return { success: false, response: "❌ This channel doesn't support slowmode" };
          }
        } catch (error) {
          return { success: false, response: `❌ Failed to set slowmode: ${error.message}` };
        }

      default:
        return {
          success: false,
          response: `❌ Unknown command: ${command}`
        };
    }
  } catch (error) {
    console.error(`❌ Error executing Discord command:`, error);
    return {
      success: false,
      response: `❌ An error occurred while executing the command: ${error.message}`
    };
  }
}

// Slash Command Execution Function - build a normalized command output and route through common executor
async function executeSlashCommand(interaction, _unused) {
  try {
    const botMember = interaction.guild?.members?.me;
    if (!botMember) {
      return { success: false, response: "❌ Bot is not in a guild" };
    }

    // Build a normalized command output from the interaction options
    const command = interaction.commandName.toLowerCase();
    let commandOutput = `/${command}`;

    if (interaction.options && Array.isArray(interaction.options.data)) {
      for (const opt of interaction.options.data) {
        // Normalize common option names/types into the text format expected by executeDiscordCommand
        if (opt.type === 6 || opt.name === 'user') { // USER
          commandOutput += ` <@${opt.value}>`;
        } else if (opt.name === 'reason') {
          commandOutput += ` reason: ${opt.value}`;
        } else if (opt.name === 'message') {
          commandOutput += ` message: ${opt.value}`;
        } else if (opt.name === 'duration') {
          commandOutput += ` ${opt.value}`;
        } else if (opt.name === 'amount') {
          commandOutput += ` ${opt.value}`;
        } else if (opt.type === 7 && opt.name === 'channel') { // CHANNEL
          commandOutput += ` channel:${opt.value}`;
        } else if (opt.type === 8 && opt.name === 'role') { // ROLE
          commandOutput += ` role:${opt.value}`;
        } else {
          commandOutput += ` ${opt.name}:${opt.value}`;
        }
      }
    }

    console.log(`⚡ Executing slash command: ${command}`);

    // Reuse the common executor so behavior matches conversational path
    const result = await executeDiscordCommand(commandOutput, {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      client: interaction.client,
      isSlashCommand: true,
    });

    return result;
  } catch (error) {
    console.error(`❌ Error executing slash command:`, error);
    return { success: false, response: `❌ An error occurred while executing the command: ${error.message}` };
  }
}