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

// Health check endpoint (for Railway)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeBots: activeClients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  const botStatus = Array.from(activeClients.values()).map(({ botInfo, client }) => ({
    botName: botInfo.bot_name,
    userId: botInfo.user_id,
    isReady: client.readyAt !== null,
    guilds: client.guilds.cache.size
  }));

  res.json({
    totalBots: activeClients.size,
    bots: botStatus,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

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

          // Pin the message that the user replied to, or the user's message if no reply
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

          // Extract user ID from command output or mentions
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          } else if (message.mentions.users.size > 0) {
            userId = message.mentions.users.first().id;
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to ban" };
          }

          if (userId === message.client.user?.id) {
            return { success: false, response: "❌ I cannot ban myself!" };
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

          // Extract user ID
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          } else if (message.mentions.users.size > 0) {
            userId = message.mentions.users.first().id;
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to kick" };
          }

          if (userId === message.client.user?.id) {
            return { success: false, response: "❌ I cannot kick myself!" };
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

          // Extract user ID
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          } else if (message.mentions.users.size > 0) {
            userId = message.mentions.users.first().id;
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to mute" };
          }

          if (userId === message.client.user?.id) {
            return { success: false, response: "❌ I cannot mute myself!" };
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
          // Extract user ID
          let userId = null;
          const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
          if (userMatch) {
            userId = userMatch[1];
          } else if (message.mentions.users.size > 0) {
            userId = message.mentions.users.first().id;
          }

          if (!userId) {
            return { success: false, response: "❌ Please specify a valid user to warn" };
          }

          if (userId === message.client.user?.id) {
            return { success: false, response: "❌ I cannot warn myself!" };
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