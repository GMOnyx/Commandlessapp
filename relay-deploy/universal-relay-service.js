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
      if (!interaction.isChatInputCommand()) return;

      try {
        console.log(`🎯 Slash command received: /${interaction.commandName}`);
        
        // Convert slash command to the same format as AI-processed commands
        const commandOutput = await convertSlashCommandToCommandOutput(interaction, bot.user_id);
        
        if (commandOutput) {
          // Execute the command using the same logic as AI commands
          // Create a mock message object that's compatible with the executeDiscordCommand function
          const mockMessage = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            mentions: {
              users: new Map() // We'll populate this based on slash command options
            },
            // Add methods/properties that commands might need
            delete: async () => {}, // Slash commands don't have messages to delete
            reply: async (content) => interaction.followUp(content),
            reference: null, // Slash commands don't reference other messages
            // Mark this as a slash command context
            isSlashCommand: true
          };
          
          const result = await executeDiscordCommand(commandOutput, mockMessage);
          
          if (result.success) {
            await interaction.reply({ content: result.response, ephemeral: false });
          } else {
            await interaction.reply({ content: result.response, ephemeral: true });
          }
        } else {
          await interaction.reply({ content: '❌ Unknown command', ephemeral: true });
        }
      } catch (error) {
        console.error('❌ Error handling slash command:', error);
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ An error occurred while executing the command', ephemeral: true });
        }
      }
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
    
    // Convert command mappings to Discord slash command format
    const slashCommands = commandMappings.map(mapping => {
      const commandName = extractCommandName(mapping.command_output);
      const description = mapping.natural_language_pattern || `Execute ${commandName} command`;
      
      // Build options based on the command output parameters
      const options = extractSlashCommandOptions(mapping.command_output);
      
      return {
        name: commandName,
        description: description.length > 100 ? description.substring(0, 97) + '...' : description,
        options: options
      };
    });
    
    // Remove duplicates (same command name)
    const uniqueCommands = slashCommands.filter((command, index, self) => 
      index === self.findIndex(c => c.name === command.name)
    );
    
    console.log(`📋 Registering ${uniqueCommands.length} unique slash commands:`, uniqueCommands.map(c => c.name).join(', '));
    
    // Register commands with Discord
    await client.application.commands.set(uniqueCommands);
    
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
    
    // Find matching command mapping
    const matchingMapping = commandMappings.find(mapping => {
      const commandName = extractCommandName(mapping.command_output);
      return commandName === interaction.commandName;
    });
    
    if (!matchingMapping) {
      console.log(`❌ No mapping found for slash command: ${interaction.commandName}`);
      return null;
    }
    
    // Start with the command output template
    let commandOutput = matchingMapping.command_output;
    
    // Replace parameters with values from slash command options
    if (interaction.options) {
      interaction.options.data.forEach(option => {
        const placeholder = `{${option.name}}`;
        let value = option.value;
        
        // Handle user mentions
        if (option.type === 6) { // USER type
          value = `<@${option.value}>`;
        }
        
        commandOutput = commandOutput.replace(placeholder, value);
      });
    }
    
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
          await message.delete(); // Delete the command message
          
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
          
          await message.delete(); // Delete the command message
          
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

          // Extract user ID from command output
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to ban" };
          }

          // Extract reason
          const reasonMatch = commandOutput.match(/reason:?\s*(.+)/) || 
                             commandOutput.match(/for\s+(.+)/) ||
                             commandOutput.match(/\{reason\}\s*(.+)/);
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