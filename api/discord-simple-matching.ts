// Simple Pattern Matching (fallback when AI is not available)
export async function processWithSimpleMatching(cleanMessage: string, commandMappings: any[], message: any, userId: string, supabase: any): Promise<any> {
  const lowerMessage = cleanMessage.toLowerCase();
  
  // Check for command matches
  for (const mapping of commandMappings) {
    const commandName = mapping.name.toLowerCase();
    const pattern = mapping.natural_language_pattern.toLowerCase();
    
    // Simple matching logic
    if (lowerMessage.includes(commandName) || 
        lowerMessage.includes(pattern.replace(/execute|command/g, '').trim()) ||
        isCommandMatch(lowerMessage, commandName)) {
      
      // Extract parameters from the message
      const params = extractParametersFromMessage(message, mapping);
      
      // Build the command output
      let commandOutput = mapping.command_output;
      
      // Replace parameters in the output
      for (const [key, value] of Object.entries(params)) {
        if (value && value.toString().trim()) {
          commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
      }
      
      // Replace any remaining placeholders with defaults
      commandOutput = commandOutput.replace(/\{reason\}/g, 'No reason provided');
      commandOutput = commandOutput.replace(/\{message\}/g, 'No message provided');
      commandOutput = commandOutput.replace(/\{amount\}/g, '1');
      commandOutput = commandOutput.replace(/\{user\}/g, 'target user');

      // Log the command usage
      await supabase
        .from('command_mappings')
        .update({ 
          usage_count: (mapping.usage_count || 0) + 1 
        })
        .eq('id', mapping.id);

      return {
        success: true,
        response: `✅ Command "${mapping.name}" executed: ${commandOutput}`
      };
    }
  }

  // Conversational responses for common phrases
  if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
    return {
      success: true,
      response: "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
    };
  }

  if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
    return {
      success: true,
      response: "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀"
    };
  }

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      success: true,
      response: "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently."
    };
  }

  if (lowerMessage.includes('help')) {
    const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
    return {
      success: true,
      response: `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`
    };
  }

  return {
    success: true,
    response: "I understand you mentioned me, but I'm not sure what you'd like me to do. Try asking for 'help' to see what I can do!"
  };
}

// Helper function to check if message matches a command
function isCommandMatch(message: string, commandName: string): boolean {
  const commandKeywords: Record<string, string[]> = {
    'ping': ['ping', 'test', 'check', 'speed', 'latency'],
    'help': ['help', 'commands', 'what can you do'],
    'say': ['say', 'announce', 'tell everyone', 'broadcast'],
    'ban': ['ban', 'remove', 'kick out', 'get rid of'],
    'kick': ['kick', 'boot', 'eject'],
    'warn': ['warn', 'warning', 'caution'],
    'mute': ['mute', 'silence', 'quiet'],
    'purge': ['purge', 'delete', 'clear', 'clean up'],
    'channel': ['channel', 'info', 'details'],
    'server-info': ['server', 'guild', 'info', 'details']
  };
  
  const keywords = commandKeywords[commandName] || [commandName];
  return keywords.some(keyword => message.includes(keyword));
}

// Helper function to extract parameters from Discord message
function extractParametersFromMessage(message: any, mapping: any): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Extract mentioned users
  if (message.mentions && message.mentions.length > 0) {
    const firstMention = message.mentions[0];
    params.user = firstMention.id;
    params.username = firstMention.username;
  }
  
  // Extract reason (text after the command and user)
  const content = message.content.toLowerCase();
  const reasonMatch = content.match(/(?:for|because|reason:?)\s+(.+)/);
  if (reasonMatch) {
    params.reason = reasonMatch[1];
  }
  
  // Extract numbers (for amount, duration, etc.)
  const numberMatch = content.match(/(\d+)/);
  if (numberMatch) {
    params.amount = numberMatch[1];
    params.duration = numberMatch[1] + 'm'; // Default to minutes
  }
  
  // Extract quoted text (for messages)
  const quotedMatch = content.match(/"([^"]+)"/);
  if (quotedMatch) {
    params.message = quotedMatch[1];
  }
  
  return params;
} 