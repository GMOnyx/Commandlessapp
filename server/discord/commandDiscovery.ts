import { discordAPI, DiscordCommand } from './api';
import { patternGenerator, GeneratedPattern } from './patternGenerator';
import { storage } from '../storage';
import { log } from '../vite';

export interface DiscoveredCommand {
  discordCommand: DiscordCommand;
  generatedPattern: GeneratedPattern;
  commandMappingId?: string;
}

export interface DiscoveryResult {
  success: boolean;
  applicationId?: string;
  botName?: string;
  discoveredCommands: DiscoveredCommand[];
  createdMappings: number;
  errors: string[];
}

export interface BotInfo {
  name: string;
  description?: string;
  avatar?: string;
  verified?: boolean;
  publicBot?: boolean;
}

/**
 * Fetch basic bot information from Discord API for personality context fallback
 */
export async function fetchBotInfo(botToken: string): Promise<BotInfo | null> {
  try {
    const validation = await discordAPI.validateBotToken(botToken);
    
    if (!validation.valid || !validation.applicationId) {
      return null;
    }

    // Get application info which includes bot description
    const applicationInfo = await discordAPI.getApplication(botToken);
    
    return {
      name: validation.botName || 'Unknown Bot',
      description: applicationInfo?.description,
      avatar: undefined,
      verified: undefined,
      publicBot: undefined
    };
  } catch (error) {
    log(`Error fetching bot info: ${(error as Error).message}`, 'discord');
    return null;
  }
}

/**
 * Generate fallback personality context based on bot info
 */
export function generateFallbackPersonality(botInfo: BotInfo): string {
  const { name, description } = botInfo;
  
  let context = `You are ${name}, a Discord bot assistant.`;
  
  if (description && description.trim()) {
    context += ` ${description}`;
  } else {
    context += ` You help with server moderation and management tasks.`;
  }
  
  context += ` Be helpful, friendly, and respond conversationally to casual messages. For commands, execute them efficiently and clearly.`;
  
  return context;
}

/**
 * Service for discovering Discord commands and auto-generating command mappings
 */
export class CommandDiscoveryService {
  
  /**
   * Discover and sync all commands for a Discord bot
   */
  async discoverAndSyncCommands(
    botId: string,
    userId: string,
    botToken: string,
    forceRefresh: boolean = false
  ): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      success: false,
      discoveredCommands: [],
      createdMappings: 0,
      errors: []
    };

    try {
      // Validate token and get application info
      log(`Starting command discovery for bot ${botId}`, 'discovery');
      const validation = await discordAPI.validateBotToken(botToken);
      
      if (!validation.valid || !validation.applicationId) {
        result.errors.push('Invalid Discord bot token');
        return result;
      }

      result.applicationId = validation.applicationId;
      result.botName = validation.botName;

      // Fetch Discord commands
      const discordCommands = await discordAPI.getGlobalCommands(botToken, validation.applicationId);
      
      if (discordCommands.length === 0) {
        log(`No Discord commands found for bot ${botId}`, 'discovery');
        result.success = true; // Not an error, just no commands
        return result;
      }

      // Get existing command mappings for this bot
      const existingMappings = await storage.getCommandMappings(userId);
      const botMappings = existingMappings.filter(mapping => mapping.botId === botId);
      
      // Process each Discord command
      for (const discordCommand of discordCommands) {
        try {
          // Generate patterns for this command
          const generatedPattern = patternGenerator.generatePatterns(discordCommand);
          
          const discoveredCommand: DiscoveredCommand = {
            discordCommand,
            generatedPattern
          };

          // Check if mapping already exists
          const existingMapping = botMappings.find(mapping => 
            mapping.name.toLowerCase() === discordCommand.name.toLowerCase() ||
            mapping.commandOutput.includes(`/${discordCommand.name}`)
          );

          if (existingMapping && !forceRefresh) {
            // Command mapping already exists, skip unless force refresh
            log(`Skipping existing command mapping for /${discordCommand.name}`, 'discovery');
            discoveredCommand.commandMappingId = existingMapping.id;
          } else {
            // Create new command mapping
            const mappingName = this.generateMappingName(discordCommand);
            
            const mapping = await storage.createCommandMapping({
              userId,
              botId,
              name: mappingName,
              naturalLanguagePattern: generatedPattern.primary,
              commandOutput: generatedPattern.commandOutput,
              status: 'active'
            });

            discoveredCommand.commandMappingId = mapping.id;
            result.createdMappings++;
            
            log(`Created command mapping: ${mappingName} -> ${generatedPattern.primary}`, 'discovery');

            // Create activity
            await storage.createActivity({
              userId,
              activityType: 'command_discovered',
              description: `Auto-discovered Discord command /${discordCommand.name}`,
              metadata: {
                botId,
                discordCommandId: discordCommand.id,
                commandName: discordCommand.name,
                pattern: generatedPattern.primary,
                confidence: generatedPattern.confidence
              }
            });
          }

          result.discoveredCommands.push(discoveredCommand);
          
        } catch (error) {
          const errorMsg = `Error processing command /${discordCommand.name}: ${(error as Error).message}`;
          log(errorMsg, 'discovery');
          result.errors.push(errorMsg);
        }
      }

      result.success = true;
      log(`Command discovery completed for bot ${botId}. Created ${result.createdMappings} new mappings.`, 'discovery');
      
    } catch (error) {
      const errorMsg = `Command discovery failed: ${(error as Error).message}`;
      log(errorMsg, 'discovery');
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Generate a user-friendly name for the command mapping
   */
  private generateMappingName(command: DiscordCommand): string {
    const { name, description } = command;
    
    // Use description if it's concise and descriptive
    if (description && description.length <= 50 && description.length > name.length + 5) {
      return description;
    }
    
    // Generate name based on command name
    const formatted = name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Add "Command" suffix if the name is too short
    if (formatted.length < 8) {
      return `${formatted} Command`;
    }
    
    return formatted;
  }

  /**
   * Sync commands for an existing bot (refresh command mappings)
   */
  async syncBotCommands(botId: string, userId: string, forceRefresh: boolean = false): Promise<DiscoveryResult> {
    const bot = await storage.getBot(botId);
    if (!bot) {
      return {
        success: false,
        discoveredCommands: [],
        createdMappings: 0,
        errors: ['Bot not found']
      };
    }

    if (bot.userId !== userId) {
      return {
        success: false,
        discoveredCommands: [],
        createdMappings: 0,
        errors: ['Unauthorized access to bot']
      };
    }

    return this.discoverAndSyncCommands(botId, userId, bot.token, forceRefresh);
  }

  /**
   * Get preview of commands that would be discovered (without creating mappings)
   */
  async previewCommands(botToken: string): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      success: false,
      discoveredCommands: [],
      createdMappings: 0,
      errors: []
    };

    try {
      // Validate token and get application info
      const validation = await discordAPI.validateBotToken(botToken);
      
      if (!validation.valid || !validation.applicationId) {
        result.errors.push('Invalid Discord bot token');
        return result;
      }

      result.applicationId = validation.applicationId;
      result.botName = validation.botName;

      // Fetch Discord commands
      const discordCommands = await discordAPI.getGlobalCommands(botToken, validation.applicationId);
      
      // Generate patterns for preview (without creating mappings)
      for (const discordCommand of discordCommands) {
        const generatedPattern = patternGenerator.generatePatterns(discordCommand);
        
        result.discoveredCommands.push({
          discordCommand,
          generatedPattern
        });
      }

      result.success = true;
      
    } catch (error) {
      const errorMsg = `Command preview failed: ${(error as Error).message}`;
      result.errors.push(errorMsg);
    }

    return result;
  }
}

export const commandDiscoveryService = new CommandDiscoveryService(); 