import { log } from '../vite';
import fetch from 'node-fetch';
import { maskSensitiveData } from '../utils/encryption';

export interface DiscordCommand {
  id: string;
  name: string;
  description: string;
  options?: DiscordCommandOption[];
  type?: number;
}

export interface DiscordCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: Array<{
    name: string;
    value: string | number;
  }>;
}

export interface DiscordApplication {
  id: string;
  name: string;
  description?: string;
}

/**
 * Discord API client for fetching bot commands and application info
 */
export class DiscordAPI {
  private baseUrl = 'https://discord.com/api/v10';

  /**
   * Get application info from Discord using bot token
   */
  async getApplication(botToken: string): Promise<DiscordApplication | null> {
    const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
    
    // Log with masked token for security
    log(`Attempting Discord API call with token: ${maskSensitiveData(cleanToken)}`, 'discord');
    
    try {
      const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
        headers: {
          'Authorization': `Bot ${cleanToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`Discord API error getting application: ${response.status} - ${errorText}`, 'discord');
        
        log(`❌ Token validation failed. Common issues:
          • Token is invalid or expired
          • Token missing required scopes (bot, applications.commands)
          • Token was regenerated and this is an old one
          • Bot was deleted or disabled`, 'discord');
        
        return null;
      }

      const application = await response.json() as DiscordApplication;
      return application;
    } catch (error) {
      log(`Discord API fetch error: ${(error as Error).message}`, 'discord');
      return null;
    }
  }

  /**
   * Fetch all global commands for a Discord bot
   */
  async getGlobalCommands(botToken: string, applicationId: string): Promise<DiscordCommand[]> {
    try {
      const response = await fetch(`${this.baseUrl}/applications/${applicationId}/commands`, {
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        log(`Discord API error fetching commands: ${response.status} - ${error}`, 'discord');
        return [];
      }

      const commands = await response.json();
      log(`Fetched ${commands.length} Discord commands for application ${applicationId}`, 'discord');
      
      return commands.map((cmd: any) => ({
        id: cmd.id,
        name: cmd.name,
        description: cmd.description,
        options: cmd.options || [],
        type: cmd.type
      }));
    } catch (error) {
      log(`Error fetching Discord commands: ${(error as Error).message}`, 'discord');
      return [];
    }
  }

  /**
   * Validate a Discord bot token by attempting to get application info
   */
  async validateBotToken(botToken: string): Promise<{ valid: boolean; applicationId?: string; botName?: string }> {
    const app = await this.getApplication(botToken);
    if (app) {
      return {
        valid: true,
        applicationId: app.id,
        botName: app.name
      };
    }
    return { valid: false };
  }
}

export const discordAPI = new DiscordAPI(); 