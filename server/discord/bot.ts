import { Client, GatewayIntentBits, Message } from 'discord.js';
import { log } from '../vite';
import { processDiscordMessageWithAI } from './messageHandlerAI';
import { executeDiscordAction } from './discordActionExecutor';

interface DiscordBot {
  client: Client;
  token: string;
  userId: string;
  isConnected: boolean;
}

// Store recent messages for context (simple in-memory cache)
interface MessageContext {
  messageId: string;
  content: string;
  author: string;
  timestamp: Date;
  isBot: boolean;
}

class MessageContextManager {
  private contexts: Map<string, MessageContext[]> = new Map(); // channelId -> messages
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private readonly CONTEXT_EXPIRY_HOURS = 2;

  addMessage(channelId: string, messageId: string, content: string, author: string, isBot: boolean) {
    if (!this.contexts.has(channelId)) {
      this.contexts.set(channelId, []);
    }

    const messages = this.contexts.get(channelId)!;
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

  getRecentMessages(channelId: string, limit: number = 5): MessageContext[] {
    const messages = this.contexts.get(channelId) || [];
    return messages.slice(-limit);
  }

  getMessageById(channelId: string, messageId: string): MessageContext | undefined {
    const messages = this.contexts.get(channelId) || [];
    return messages.find(msg => msg.messageId === messageId);
  }

  private cleanupOldMessages(channelId: string) {
    const messages = this.contexts.get(channelId);
    if (!messages) return;

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.CONTEXT_EXPIRY_HOURS);

    const validMessages = messages.filter(msg => msg.timestamp > cutoff);
    this.contexts.set(channelId, validMessages);
  }
}

const messageContextManager = new MessageContextManager();

class DiscordBotManager {
  private bots: Map<string, DiscordBot> = new Map();

  async startBot(botToken: string, userId: string): Promise<boolean> {
    try {
      // Check if bot is already running
      if (this.bots.has(botToken)) {
        log(`Bot for user ${userId} is already running`, 'discord');
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

      // Set up event handlers
      client.once('ready', () => {
        log(`Discord bot logged in as ${client.user?.tag} for user ${userId}`, 'discord');
      });

      client.on('messageCreate', async (message: Message) => {
        // Ignore messages from bots (including this bot)
        if (message.author.bot) return;

        // Store this message for context
        messageContextManager.addMessage(
          message.channelId,
          message.id,
          message.content,
          message.author.tag,
          false
        );

        // Check if this is a reply to our bot or if the bot is mentioned
        const isReplyToBot = message.reference?.messageId && 
          await this.isReplyToBot(message, client.user?.id || '');
        const botMentioned = message.mentions.users.has(client.user?.id || '');
        
        // Debug logging for reply detection
        if (message.reference?.messageId) {
          log(`Message is a reply to messageId: ${message.reference.messageId}`, 'discord');
          log(`Reply to bot detected: ${isReplyToBot}`, 'discord');
        }
        if (botMentioned) {
          log(`Bot mentioned in message`, 'discord');
        }
        
        if (!botMentioned && !isReplyToBot) return;

        try {
          log(`Processing message from ${message.author.tag}: ${message.content}`, 'discord');

          // Get context for this conversation
          let conversationContext = '';
          
          if (isReplyToBot && message.reference?.messageId) {
            // Get the referenced message context
            const referencedMessage = messageContextManager.getMessageById(
              message.channelId, 
              message.reference.messageId
            );
            
            if (referencedMessage) {
              conversationContext = `Previous message context: ${referencedMessage.author}: "${referencedMessage.content}"`;
            }
          }

          // Get recent conversation context (last few messages)
          const recentMessages = messageContextManager.getRecentMessages(message.channelId, 3);
          if (recentMessages.length > 0) {
            const contextMessages = recentMessages
              .filter(msg => msg.messageId !== message.id) // Don't include current message
              .map(msg => `${msg.author}: "${msg.content}"`)
              .join('\n');
            
            if (contextMessages) {
              conversationContext = conversationContext 
                ? `${conversationContext}\n\nRecent conversation:\n${contextMessages}`
                : `Recent conversation:\n${contextMessages}`;
            }
          }

          // Process with AI
          const result = await processDiscordMessageWithAI(
            message.content,
            message.guildId || 'dm',
            message.channelId,
            message.author.id,
            !!isReplyToBot, // Skip mention check if this is a reply to bot
            userId,
            conversationContext // Pass the conversation context
          );

          let botResponseText = '';
          let botMessage: Message | undefined;

          if (result.processed) {
            if (result.command) {
              // Parse and execute actual Discord moderation actions
              const executionResult = await executeDiscordAction(result.command, message);
              
              if (executionResult.success) {
                botMessage = await message.reply(executionResult.response);
                botResponseText = executionResult.response;
                log(`Executed Discord action: ${result.command} - ${executionResult.response}`, 'discord');
              } else {
                botMessage = await message.reply(`❌ ${executionResult.error}`);
                botResponseText = `❌ ${executionResult.error}`;
                log(`Failed to execute Discord action: ${result.command} - ${executionResult.error}`, 'discord');
              }
            } else if (result.needsClarification && result.clarificationQuestion) {
              // Send clarification question
              const clarificationText = result.clarificationQuestion;
              botMessage = await message.reply(clarificationText);
              botResponseText = clarificationText;
              log(`Sent clarification: ${clarificationText}`, 'discord');
            } else if (result.conversationalResponse) {
              // Send conversational response
              botMessage = await message.reply(result.conversationalResponse);
              botResponseText = result.conversationalResponse;
              log(`Sent conversational response: ${result.conversationalResponse}`, 'discord');
            }
          } else {
            // No processing occurred
            const fallbackText = "🤔 I couldn't understand that. Try mentioning me with a command like 'ban @user for spam' or 'warn @user stop spamming'.";
            botMessage = await message.reply(fallbackText);
            botResponseText = fallbackText;
          }

          // Store bot's response for context using the actual Discord message ID
          if (botMessage && botResponseText) {
            messageContextManager.addMessage(
              message.channelId,
              botMessage.id, // Use the actual Discord message ID
              botResponseText,
              client.user?.tag || 'Bot',
              true
            );
          }

        } catch (error) {
          log(`Error processing Discord message: ${(error as Error).message}`, 'discord');
          await message.reply("❌ Sorry, I encountered an error processing your message.");
        }
      });

      client.on('error', (error: Error) => {
        log(`Discord client error for user ${userId}: ${error.message}`, 'discord');
      });

      // Login to Discord
      await client.login(botToken);

      // Store the bot
      this.bots.set(botToken, {
        client,
        token: botToken,
        userId,
        isConnected: true
      });

      log(`Successfully started Discord bot for user ${userId}`, 'discord');
      return true;

    } catch (error) {
      log(`Failed to start Discord bot for user ${userId}: ${(error as Error).message}`, 'discord');
      return false;
    }
  }

  private async isReplyToBot(message: Message, botId: string): Promise<boolean> {
    if (!message.reference?.messageId) return false;

    try {
      // Check if the referenced message is from our bot
      const referencedMessage = messageContextManager.getMessageById(
        message.channelId, 
        message.reference.messageId
      );
      
      if (referencedMessage) {
        return referencedMessage.isBot;
      }

      // Fallback: fetch the message from Discord if not in our cache
      const channel = message.channel;
      if ('messages' in channel) {
        const referencedMsg = await channel.messages.fetch(message.reference.messageId);
        return referencedMsg.author.id === botId;
      }
    } catch (error) {
      log(`Error checking if reply is to bot: ${(error as Error).message}`, 'discord');
    }

    return false;
  }

  async stopBot(botToken: string): Promise<boolean> {
    try {
      const bot = this.bots.get(botToken);
      if (!bot) {
        log(`No bot found with token ${botToken}`, 'discord');
        return false;
      }

      await bot.client.destroy();
      this.bots.delete(botToken);
      
      log(`Successfully stopped Discord bot for user ${bot.userId}`, 'discord');
      return true;

    } catch (error) {
      log(`Failed to stop Discord bot: ${(error as Error).message}`, 'discord');
      return false;
    }
  }

  getBotStatus(botToken: string): boolean {
    const bot = this.bots.get(botToken);
    return bot ? bot.isConnected : false;
  }

  getAllBots(): DiscordBot[] {
    return Array.from(this.bots.values());
  }
}

// Export singleton instance
export const discordBotManager = new DiscordBotManager(); 