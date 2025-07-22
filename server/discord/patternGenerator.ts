import { DiscordCommand, DiscordCommandOption } from './api';
import { log } from '../vite';

export interface GeneratedPattern {
  primary: string;
  alternatives: string[];
  commandOutput: string;
  confidence: number;
}

/**
 * Discord command option types
 * https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
 */
const DISCORD_OPTION_TYPES = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11
};

/**
 * Service for generating natural language patterns from Discord commands
 */
export class PatternGenerator {
  
  /**
   * Generate natural language patterns for a Discord command
   */
  generatePatterns(command: DiscordCommand): GeneratedPattern {
    const { name, description, options = [] } = command;
    
    // Get required and optional parameters
    const requiredParams = options.filter(opt => opt.required === true);
    const optionalParams = options.filter(opt => opt.required !== true);
    
    // Generate primary pattern
    const primary = this.generatePrimaryPattern(name, requiredParams, optionalParams);
    
    // Generate alternative patterns
    const alternatives = this.generateAlternativePatterns(name, requiredParams, optionalParams);
    
    // Generate command output (Discord slash command format)
    const commandOutput = this.generateCommandOutput(name, options);
    
    // Calculate confidence based on command complexity and description quality
    const confidence = this.calculateConfidence(command);
    
    log(`Generated patterns for /${name}: ${primary}`, 'pattern');
    
    return {
      primary,
      alternatives,
      commandOutput,
      confidence
    };
  }
  
  /**
   * Generate the primary natural language pattern
   */
  private generatePrimaryPattern(commandName: string, required: DiscordCommandOption[], optional: DiscordCommandOption[]): string {
    let pattern = commandName;
    
    // Add required parameters
    for (const param of required) {
      const paramPattern = this.getParameterPattern(param);
      pattern += ` ${paramPattern}`;
    }
    
    // Add high-priority optional parameters (like reason)
    const importantOptional = optional.filter(opt => 
      ['reason', 'message', 'duration', 'time'].includes(opt.name.toLowerCase())
    );
    
    for (const param of importantOptional) {
      const paramPattern = this.getParameterPattern(param);
      pattern += ` ${paramPattern}`;
    }
    
    return pattern;
  }
  
  /**
   * Generate alternative natural language patterns
   */
  private generateAlternativePatterns(commandName: string, required: DiscordCommandOption[], optional: DiscordCommandOption[]): string[] {
    const alternatives: string[] = [];
    
    // Generate action-based alternatives for common commands
    const actionAlternatives = this.getActionAlternatives(commandName);
    
    for (const action of actionAlternatives) {
      let pattern = action;
      
      // Add required parameters
      for (const param of required) {
        const paramPattern = this.getParameterPattern(param);
        pattern += ` ${paramPattern}`;
      }
      
      alternatives.push(pattern);
    }
    
    // Generate preposition-based alternatives (for/because/with)
    if (required.length > 0) {
      const prepositions = ['for', 'because', 'with'];
      const reasonParam = optional.find(opt => opt.name.toLowerCase().includes('reason'));
      
      if (reasonParam) {
        for (const prep of prepositions) {
          let pattern = commandName;
          for (const param of required) {
            pattern += ` ${this.getParameterPattern(param)}`;
          }
          pattern += ` ${prep} ${this.getParameterPattern(reasonParam)}`;
          alternatives.push(pattern);
        }
      }
    }
    
    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }
  
  /**
   * Get action-based alternatives for common command names
   */
  private getActionAlternatives(commandName: string): string[] {
    const alternatives: Record<string, string[]> = {
      'ban': ['kick out', 'remove', 'banish'],
      'kick': ['remove', 'boot', 'eject'],
      'mute': ['silence', 'quiet'],
      'unmute': ['unsilence', 'allow speaking'],
      'warn': ['caution', 'alert'],
      'timeout': ['time out', 'temporarily mute'],
      'role': ['give role', 'assign role'],
      'nick': ['nickname', 'rename'],
      'avatar': ['profile picture', 'pfp'],
      'channel': ['create channel', 'make channel'],
      'delete': ['remove', 'destroy'],
      'clear': ['purge', 'clean'],
      'lock': ['lockdown', 'restrict'],
      'unlock': ['open', 'unrestrict']
    };
    
    return alternatives[commandName.toLowerCase()] || [];
  }
  
  /**
   * Get natural language pattern for a parameter
   */
  private getParameterPattern(param: DiscordCommandOption): string {
    const { name, type } = param;
    
    // Handle special parameter names
    const specialPatterns: Record<string, string> = {
      'user': '{user}',
      'member': '{user}',
      'target': '{user}',
      'person': '{user}',
      'player': '{user}',
      // Discord mute command often uses non-standard names
      'add': '{user}',        // Some bots use 'add' for the user to mute
      'remove': '{reason}',   // Some bots use 'remove' for the reason
      'role': '{role}',
      'reason': '{reason}',
      'message': '{message}',
      'text': '{text}',
      'content': '{message}',
      'duration': '{duration}',
      'time': '{duration}',
      'timeout': '{duration}',
      'length': '{duration}',
      'amount': '{amount}',
      'number': '{amount}',
      'count': '{amount}',
      'quantity': '{amount}',
      'channel': '{channel}',
      'name': '{name}',
      'title': '{name}'
    };
    
    const lowerName = name.toLowerCase();
    if (specialPatterns[lowerName]) {
      return specialPatterns[lowerName];
    }
    
    // Handle by Discord type - this provides additional normalization
    switch (type) {
      case DISCORD_OPTION_TYPES.USER:
        return '{user}';
      case DISCORD_OPTION_TYPES.CHANNEL:
        return '{channel}';
      case DISCORD_OPTION_TYPES.ROLE:
        return '{role}';
      case DISCORD_OPTION_TYPES.STRING:
        // For strings, try to infer what they represent based on name
        if (lowerName.includes('reason') || lowerName.includes('why') || lowerName.includes('cause')) {
          return '{reason}';
        }
        if (lowerName.includes('message') || lowerName.includes('text') || lowerName.includes('content')) {
          return '{message}';
        }
        if (lowerName.includes('duration') || lowerName.includes('time') || lowerName.includes('length')) {
          return '{duration}';
        }
        return `{${name}}`;
      case DISCORD_OPTION_TYPES.INTEGER:
      case DISCORD_OPTION_TYPES.NUMBER:
        // For numbers, try to infer what they represent
        if (lowerName.includes('amount') || lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('quantity')) {
          return '{amount}';
        }
        if (lowerName.includes('duration') || lowerName.includes('time') || lowerName.includes('length')) {
          return '{duration}';
        }
        return `{${name}}`;
      case DISCORD_OPTION_TYPES.BOOLEAN:
        return `{${name}}`;
      default:
        return `{${name}}`;
    }
  }
  
  /**
   * Generate Discord slash command output format
   */
  private generateCommandOutput(commandName: string, options: DiscordCommandOption[]): string {
    let output = `/${commandName}`;
    
    for (const option of options) {
      // Skip sub-commands and sub-command groups for now
      if (option.type === DISCORD_OPTION_TYPES.SUB_COMMAND || 
          option.type === DISCORD_OPTION_TYPES.SUB_COMMAND_GROUP) {
        continue;
      }
      
      // **CRITICAL FIX**: Use normalized parameter names instead of raw Discord names
      // This prevents issues with bots that use non-standard parameter names like {add}, {remove}, {target}, etc.
      const normalizedParam = this.getNormalizedParameterName(option);
      output += ` ${option.name}:${normalizedParam}`;
    }
    
    return output;
  }
  
  /**
   * Get normalized parameter name for command output
   * This ensures consistent parameter naming across all Discord bots
   */
  private getNormalizedParameterName(option: DiscordCommandOption): string {
    const { name, type } = option;
    const lowerName = name.toLowerCase();
    
    // Map Discord parameter names to standardized ones for command output
    const parameterMapping: Record<string, string> = {
      // User-related parameters
      'user': '{user}',
      'member': '{user}',
      'target': '{user}',
      'person': '{user}',
      'player': '{user}',
      'add': '{user}',        // Common in mute/ban commands
      'remove': '{user}',     // Sometimes used for user parameter
      
      // Reason-related parameters  
      'reason': '{reason}',
      'message': '{reason}',  // Often used for reason
      'description': '{reason}',
      'cause': '{reason}',
      
      // Role-related parameters
      'role': '{role}',
      'rank': '{role}',
      
      // Channel-related parameters
      'channel': '{channel}',
      'room': '{channel}',
      
      // Duration-related parameters
      'duration': '{duration}',
      'time': '{duration}',
      'timeout': '{duration}',
      'length': '{duration}',
      
      // Amount-related parameters
      'amount': '{amount}',
      'number': '{amount}',
      'count': '{amount}',
      'quantity': '{amount}',
      
      // Text/content parameters
      'text': '{message}',
      'content': '{message}',
      'msg': '{message}',
      
      // Name parameters
      'name': '{name}',
      'title': '{name}'
    };
    
    // First try exact name match
    if (parameterMapping[lowerName]) {
      return parameterMapping[lowerName];
    }
    
    // Then try Discord type-based mapping
    switch (type) {
      case DISCORD_OPTION_TYPES.USER:
        return '{user}';
      case DISCORD_OPTION_TYPES.CHANNEL:
        return '{channel}';
      case DISCORD_OPTION_TYPES.ROLE:
        return '{role}';
      case DISCORD_OPTION_TYPES.STRING:
        // For strings, infer based on name patterns
        if (lowerName.includes('reason') || lowerName.includes('why') || lowerName.includes('cause')) {
          return '{reason}';
        }
        if (lowerName.includes('message') || lowerName.includes('text') || lowerName.includes('content')) {
          return '{message}';
        }
        if (lowerName.includes('duration') || lowerName.includes('time') || lowerName.includes('length')) {
          return '{duration}';
        }
        if (lowerName.includes('name') || lowerName.includes('title')) {
          return '{name}';
        }
        // Default for unrecognized string parameters
        return '{message}';
      case DISCORD_OPTION_TYPES.INTEGER:
      case DISCORD_OPTION_TYPES.NUMBER:
        if (lowerName.includes('amount') || lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('quantity')) {
          return '{amount}';
        }
        if (lowerName.includes('duration') || lowerName.includes('time') || lowerName.includes('length')) {
          return '{duration}';
        }
        return '{amount}';
      case DISCORD_OPTION_TYPES.BOOLEAN:
        return `{${name}}`;
      default:
        // Fallback to the original parameter name if we can't normalize it
        return `{${name}}`;
    }
  }
  
  /**
   * Calculate confidence score for the generated patterns
   */
  private calculateConfidence(command: DiscordCommand): number {
    let confidence = 0.7; // Base confidence
    
    // Boost confidence for well-described commands
    if (command.description && command.description.length > 10) {
      confidence += 0.1;
    }
    
    // Boost confidence for commands with clear parameter names
    const options = command.options || [];
    const clearParamNames = ['user', 'reason', 'channel', 'role', 'message', 'duration'];
    const hasCleanParams = options.some(opt => 
      clearParamNames.includes(opt.name.toLowerCase())
    );
    
    if (hasCleanParams) {
      confidence += 0.1;
    }
    
    // Reduce confidence for very complex commands
    if (options.length > 5) {
      confidence -= 0.1;
    }
    
    // Boost confidence for common moderation commands
    const commonCommands = ['ban', 'kick', 'mute', 'warn', 'timeout', 'role'];
    if (commonCommands.includes(command.name.toLowerCase())) {
      confidence += 0.1;
    }
    
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }
}

export const patternGenerator = new PatternGenerator(); 