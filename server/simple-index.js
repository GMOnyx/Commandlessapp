const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('🤖 Gemini AI initialized');
} else {
  console.warn('⚠️ GEMINI_API_KEY not found - AI features will be limited');
}

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

// AI Message Processing Function
async function processMessageWithAI(message, userId) {
  try {
    // Clean the message content (remove bot mentions)
    let cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
    
    if (!cleanMessage) {
      return {
        success: true,
        response: "Hello! How can I help you today? I can help with moderation commands or just chat!"
      };
    }

    // Get command mappings for this user
    const { data: commandMappings, error: mappingsError } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (mappingsError) {
      console.error('Error fetching command mappings:', mappingsError);
      return {
        success: true,
        response: "I'm here to help! I had trouble accessing my commands, but I'm ready to chat."
      };
    }

    if (!commandMappings || commandMappings.length === 0) {
      return {
        success: true,
        response: "Hi there! I don't have any commands configured yet, but I'm happy to chat!"
      };
    }

    // Use AI if available, otherwise fall back to simple matching
    if (genAI) {
      return await processWithAI(cleanMessage, commandMappings, message, userId);
    } else {
      return await processWithSimpleMatching(cleanMessage, commandMappings, message, userId);
    }

  } catch (error) {
    console.error('Error in processMessageWithAI:', error);
    return {
      success: true,
      response: "Sorry, I encountered an error processing your message. Please try again!"
    };
  }
}

// Advanced AI Processing Functions (from local codebase)

// Calculate semantic similarity between user input and command patterns
function calculateCommandSimilarity(userInput, command) {
  const input = userInput.toLowerCase();
  let score = 0;
  
  // Extract command name from command output (e.g., "warn" from "/warn {user} {reason}")
  const commandName = extractCommandName(command.command_output);
  
  // 1. Direct command name match (highest weight)
  if (input.includes(commandName)) {
    score += 0.8;
  }
  
  // 2. Phrase-level pattern matching for natural language
  const phraseScore = calculatePhrasePatternScore(input, commandName);
  score += phraseScore * 0.7;
  
  // 3. Check natural language pattern similarity
  const pattern = command.natural_language_pattern.toLowerCase();
  const cleanPattern = pattern.replace(/\{[^}]+\}/g, '').trim();
  
  const inputWords = input.split(/\s+/);
  const patternWords = cleanPattern.split(/\s+/).filter(word => word.length > 2);
  
  const commonWords = inputWords.filter(word => 
    patternWords.some(pWord => 
      word.includes(pWord) || pWord.includes(word) || calculateSimilarity(word, pWord) > 0.7
    )
  );
  
  if (patternWords.length > 0) {
    score += (commonWords.length / patternWords.length) * 0.5;
  }
  
  // 4. Semantic keyword matching based on command type
  const semanticKeywords = generateSemanticKeywords(commandName);
  const keywordMatches = semanticKeywords.filter(keyword => input.includes(keyword));
  
  if (semanticKeywords.length > 0) {
    score += (keywordMatches.length / semanticKeywords.length) * 0.4;
  }
  
  return Math.min(score, 1.0);
}

// Calculate phrase-level pattern matching
function calculatePhrasePatternScore(input, commandName) {
  const phrasePatterns = {
    'ban': ['ban', 'remove', 'kick out', 'get rid of', 'block'],
    'kick': ['kick', 'remove temporarily', 'boot'],
    'warn': ['warn', 'warning', 'caution', 'alert'],
    'mute': ['mute', 'silence', 'quiet'],
    'purge': ['purge', 'delete', 'clear', 'clean up', 'remove messages'],
    'say': ['say', 'announce', 'tell everyone', 'broadcast'],
    'ping': ['ping', 'test', 'check', 'latency', 'speed'],
    'help': ['help', 'commands', 'what can you do'],
    'channel': ['channel', 'info', 'details'],
    'server-info': ['server', 'guild', 'info', 'details']
  };
  
  const patterns = phrasePatterns[commandName] || [commandName];
  return patterns.some(pattern => input.includes(pattern)) ? 1.0 : 0.0;
}

// Calculate string similarity using Levenshtein distance
function calculateSimilarity(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
}

// Generate semantic keywords for command types
function generateSemanticKeywords(commandName) {
  const keywordMap = {
    'ban': ['ban', 'remove', 'kick out', 'block', 'banish', 'exclude'],
    'kick': ['kick', 'boot', 'eject', 'remove temporarily'],
    'warn': ['warn', 'warning', 'caution', 'alert', 'notify'],
    'mute': ['mute', 'silence', 'quiet', 'shush'],
    'purge': ['purge', 'delete', 'clear', 'clean', 'remove messages', 'bulk delete'],
    'say': ['say', 'announce', 'broadcast', 'tell', 'message'],
    'ping': ['ping', 'test', 'check', 'latency', 'response time'],
    'help': ['help', 'commands', 'assistance', 'guide'],
    'channel': ['channel', 'room', 'chat'],
    'server-info': ['server', 'guild', 'info', 'details', 'stats']
  };
  
  return keywordMap[commandName] || [commandName];
}

// Extract command name from command output
function extractCommandName(commandOutput) {
  if (!commandOutput) return '';
  
  // Remove leading slash and extract first word
  const cleaned = commandOutput.replace(/^\//, '');
  const firstWord = cleaned.split(' ')[0];
  
  // Remove any parameter placeholders
  return firstWord.replace(/\{[^}]+\}/g, '').trim();
}

// Check if input contains natural language indicators
function hasNaturalLanguageIndicators(input) {
  const naturalLanguageIndicators = [
    'please', 'can you', 'could you', 'would you', 'how', 'what', 'why',
    'they are', 'user is', 'being', 'getting', 'remove them', 'get rid'
  ];
  
  const lowerInput = input.toLowerCase();
  return naturalLanguageIndicators.some(indicator => lowerInput.includes(indicator));
}

// Check for invalid compound inputs
function isInvalidCompound(input) {
  const invalidPatterns = [
    /ban.*kick/i,
    /kick.*ban/i,
    /mute.*ban/i,
    /warn.*kick.*ban/i
  ];
  
  return invalidPatterns.some(pattern => pattern.test(input));
}

// Check if input is purely conversational
function isConversationalInput(input) {
  const conversationalPatterns = [
    /^(hi|hello|hey)[\s!]*$/i,
    /^how are you[\s?]*$/i,
    /^what's up[\s?]*$/i,
    /^good (morning|afternoon|evening)[\s!]*$/i,
    /^thank you[\s!]*$/i,
    /^thanks[\s!]*$/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input.trim()));
}

// Advanced parameter extraction from user input and pattern
function extractParametersFromPattern(userInput, naturalLanguagePattern, mentionedUserIds) {
  const extractedParams = {};
  
  // Extract Discord user mentions
  if (mentionedUserIds && mentionedUserIds.length > 0) {
    extractedParams.user = mentionedUserIds[0];
  }
  
  // Extract user mentions from text
  const userMentionMatch = userInput.match(/<@!?(\d+)>/);
  if (userMentionMatch) {
    extractedParams.user = userMentionMatch[1];
  }
  
  // Extract username mentions
  const usernameMatch = userInput.match(/@(\w+)/);
  if (usernameMatch) {
    extractedParams.username = usernameMatch[1];
  }
  
  // Extract reason with multiple patterns
  const reasonPatterns = [
    /\bfor\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\bbecause\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\breason:?\s*(.+?)(?:\s+(?:and|but|however|also)|$)/i,
    /\b(?:due to|since)\s+(.+?)(?:\s+(?:and|but|however|also)|$)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const reasonMatch = userInput.match(pattern);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
      extractedParams.reason = reasonMatch[1].trim();
      break;
    }
  }
  
  // Extract numbers for amounts/duration
  const numberMatch = userInput.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    if (naturalLanguagePattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (naturalLanguagePattern.includes('{duration}')) {
      extractedParams.duration = number + 'm';
    }
  }
  
  // Extract quoted text for messages
  const quotedMatch = userInput.match(/"([^"]+)"/);
  if (quotedMatch) {
    extractedParams.message = quotedMatch[1];
  }
  
  // Extract message content for say command
  if (naturalLanguagePattern.includes('{message}')) {
    const sayMatch = userInput.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
}

// Find best command match using advanced algorithms
async function findBestCommandMatch(userInput, availableCommands, mentionedUserIds) {
  // Check for invalid compounds first
  if (isInvalidCompound(userInput)) {
    return null;
  }
  
  // Check for conversational input that should be rejected
  if (isConversationalInput(userInput)) {
    return null;
  }
  
  let bestMatch = null;
  let highestConfidence = 0;
  
  for (const command of availableCommands) {
    const confidence = calculateCommandSimilarity(userInput, command);
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      
      const params = extractParametersFromPattern(userInput, command.natural_language_pattern, mentionedUserIds);
      
      bestMatch = {
        command,
        confidence,
        params
      };
    }
  }
  
  return bestMatch;
}

// Extract Discord mentions from message for better AI processing
function preprocessDiscordMessage(message) {
  const extractedMentions = {};
  
  // Extract user mentions <@123456789> or <@!123456789>
  const userMentions = message.match(/<@!?(\d+)>/g);
  if (userMentions) {
    userMentions.forEach((mention, index) => {
      const userId = mention.match(/<@!?(\d+)>/)?.[1];
      if (userId) {
        extractedMentions[`user_mention_${index}`] = userId;
      }
    });
  }
  
  // Extract channel mentions <#123456789>
  const channelMentions = message.match(/<#(\d+)>/g);
  if (channelMentions) {
    channelMentions.forEach((mention, index) => {
      const channelId = mention.match(/<#(\d+)>/)?.[1];
      if (channelId) {
        extractedMentions[`channel_mention_${index}`] = channelId;
      }
    });
  }
  
  // Extract role mentions <@&123456789>
  const roleMentions = message.match(/<@&(\d+)>/g);
  if (roleMentions) {
    roleMentions.forEach((mention, index) => {
      const roleId = mention.match(/<@&(\d+)>/)?.[1];
      if (roleId) {
        extractedMentions[`role_mention_${index}`] = roleId;
      }
    });
  }
  
  return {
    cleanMessage: message,
    extractedMentions
  };
}

// Extract parameters from message using fallback method
function extractParametersFallback(message, commandPattern) {
  const extractedParams = {};
  
  // Extract ALL user mentions and find the target user (not the bot)
  const allUserMentions = message.match(/<@!?(\d+)>/g);
  if (allUserMentions && allUserMentions.length > 0) {
    // Find the target user mention (usually the one that's NOT the bot being mentioned)
    const userIds = allUserMentions.map(mention => {
      const match = mention.match(/<@!?(\d+)>/);
      return match ? match[1] : null;
    }).filter(id => id !== null);
    
    // If we have multiple mentions, try to determine which is the target
    if (userIds.length > 1) {
      // Skip the first mention if it looks like a bot mention at the start
      const messageWords = message.trim().split(/\s+/);
      if (messageWords[0] && messageWords[0].match(/<@!?\d+>/)) {
        // First word is a mention (likely bot mention), use the second user mentioned
        extractedParams.user = userIds[1];
      } else {
        // Use the first user mentioned if no bot mention at start
        extractedParams.user = userIds[0];
      }
    } else if (userIds.length === 1) {
      // Only one mention - could be bot or target, use it
      extractedParams.user = userIds[0];
    }
  }
  
  // Extract channel mentions <#123456789> and map to 'channel' parameter  
  const channelMention = message.match(/<#(\d+)>/);
  if (channelMention) {
    const channelId = channelMention[1];
    extractedParams.channel = channelId;
  }
  
  // Extract role mentions <@&123456789> and map to 'role' parameter
  const roleMention = message.match(/<@&(\d+)>/);
  if (roleMention) {
    const roleId = roleMention[1];
    extractedParams.role = roleId;
  }
  
  // Extract reason from common patterns
  const reasonPatterns = [
    /(?:for|because|reason:?\s*)(.*?)(?:\s*$)/i,
    /(?:being|they're|he's|she's)\s+(.*?)(?:\s*$)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const reasonMatch = message.match(pattern);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
      extractedParams.reason = reasonMatch[1].trim();
      break;
    }
  }
  
  // Extract numbers for amounts/duration
  const numberMatch = message.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    // Check if command pattern contains amount or duration
    if (commandPattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (commandPattern.includes('{duration}')) {
      extractedParams.duration = number + 'm'; // Default to minutes
    }
  }
  
  // Extract message content for say command
  if (commandPattern.includes('{message}')) {
    // Extract everything after "say" command
    const sayMatch = message.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
}

// Advanced AI Processing
async function processWithAI(cleanMessage, commandMappings, message, userId) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Create a comprehensive prompt for command analysis
    const commandList = commandMappings.map(cmd => 
      `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: "${cmd.natural_language_pattern}" → ${cmd.command_output}`
    ).join('\n');

    // Enhanced prompt with sophisticated AI analysis
    const prompt = `You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**

AVAILABLE COMMANDS:
${commandList}

🎯 **PARAMETER EXTRACTION MASTERY:**

**Discord Mentions**: Extract user IDs from any mention format:
- "warn <@560079402013032448> for spamming" → user: "560079402013032448"
- "please mute <@!123456> because annoying" → user: "123456"
- "ban that toxic <@999888> user" → user: "999888"

**Natural Language Patterns**: Understand ANY phrasing that indicates command intent:
- "can you delete like 5 messages please" → purge command, amount: "5"
- "remove that user from the server" → ban command
- "give them a warning for being rude" → warn command
- "tell everyone the meeting is starting" → say command
- "check how fast you are" → ping command
- "what server are we in" → server-info command

**Context-Aware Extraction**: Look at the ENTIRE message for parameters:
- "nothing much just warn <@560079402013032448> for being annoying" 
  → EXTRACT: user: "560079402013032448", reason: "being annoying"
- "hey bot, when you have time, could you ban <@123> for trolling everyone"
  → EXTRACT: user: "123", reason: "trolling everyone"
- "that user <@999> has been really helpful, make a note about it"
  → EXTRACT: user: "999", message: "has been really helpful"

**Semantic Understanding**: Map natural language to command actions:
- "remove/get rid of/kick out" → ban
- "tell everyone/announce/broadcast" → say
- "delete/clear/clean up messages" → purge
- "stick/attach this message" → pin
- "give warning/issue warning" → warn
- "check speed/latency/response time" → ping
- "server details/info/stats" → server-info

**Multi-Parameter Intelligence**: Extract complete information:
- "warn john for being toxic and breaking rules repeatedly" 
  → user: "john", reason: "being toxic and breaking rules repeatedly"
- "please purge about 15 messages to clean this up"
  → amount: "15"
- "tell everyone 'meeting moved to 3pm tomorrow'"
  → message: "meeting moved to 3pm tomorrow"

🔥 **DECISION MAKING RULES:**

**EXECUTE IMMEDIATELY IF:**
- ✅ Clear command intent (even with casual phrasing)
- ✅ ANY required parameters can be extracted
- ✅ User mentions someone with @ symbol for moderation commands
- ✅ Numbers found for amount-based commands (purge, slowmode)
- ✅ Message content found for say/note commands

**CASUAL CONVERSATION IF:**
- ❌ No command-related words or intent
- ❌ Pure greetings ("hi", "hello", "how are you")
- ❌ Questions about the bot's capabilities
- ❌ General chat without action words

**CONFIDENCE SCORING:**
- 90-100: Perfect match with all parameters extracted
- 80-89: Clear intent with most important parameters
- 70-79: Good intent with some parameters (STILL EXECUTE)
- 60-69: Likely intent but may need minor clarification
- Below 60: Ask for clarification only if truly ambiguous

USER MESSAGE: "${cleanMessage}"

CONTEXT: User mentioned me in Discord. Extract any mentioned users, numbers, or quoted text.

🚀 **RESPOND WITH JSON:**

**For COMMANDS (action intent detected):**
\`\`\`json
{
  "isCommand": true,
  "bestMatch": {
    "commandId": <command_id>,
    "confidence": <60-100>,
    "params": {
      "user": "extracted_user_id",
      "reason": "complete reason text",
      "message": "complete message text",
      "amount": "number_as_string"
    }
  }
}
\`\`\`

**For CONVERSATION (no command intent):**
\`\`\`json
{
  "isCommand": false,
  "conversationalResponse": "friendly, helpful response matching bot personality"
}
\`\`\`

**EXAMPLES OF AGGRESSIVE EXTRACTION:**
- "nothing much, just ban <@560079402013032448> for spam" → EXECUTE ban immediately
- "can you please delete like 10 messages" → EXECUTE purge immediately  
- "tell everyone the event is cancelled" → EXECUTE say immediately
- "that user keeps trolling, give them a warning" → EXTRACT context for warn
- "yo bot, how's your ping?" → EXECUTE ping immediately
- "remove this toxic user from server" → Need user ID for ban
- "hi how are you doing?" → CASUAL conversation

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!

Respond with valid JSON only:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text().trim();
    
    console.log('🤖 AI Response:', aiResponse);
    
    // Parse AI response
    let parsed;
    try {
      // Extract JSON from response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return {
        success: true,
        response: "Hey! I'm here and ready to help. What's going on?"
      };
    }

    if (parsed.isCommand && parsed.bestMatch && parsed.bestMatch.commandId) {
      // Find the matching command by ID
      const matchedCommand = commandMappings.find(cmd => cmd.id === parsed.bestMatch.commandId);
      
      if (matchedCommand) {
        // Also run advanced command matching for additional parameter extraction
        const mentionedUserIds = [];
        if (message.mentions && message.mentions.users.size > 0) {
          message.mentions.users.forEach(user => mentionedUserIds.push(user.id));
        }
        
        const bestMatch = await findBestCommandMatch(cleanMessage, commandMappings, mentionedUserIds);
        
        // Merge AI extracted parameters with advanced parameter extraction
        const aiParams = parsed.bestMatch.params || {};
        const advancedParams = bestMatch ? bestMatch.params : {};
        
        // Combine parameters, prioritizing AI extraction but filling gaps with advanced extraction
        const finalParams = { ...advancedParams, ...aiParams };
        
        // Add Discord-specific parameter extraction
        if (message.mentions.users.size > 0) {
          const firstMention = message.mentions.users.first();
          finalParams.user = finalParams.user || firstMention.id;
          finalParams.username = finalParams.username || firstMention.username;
        }

        let commandOutput = matchedCommand.command_output;
        
        // Replace parameters in the output
        for (const [key, value] of Object.entries(finalParams)) {
          if (value && value.toString().trim()) {
            commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
          }
        }
        
        // Replace any remaining placeholders with defaults
        commandOutput = commandOutput.replace(/\{reason\}/g, 'No reason provided');
        commandOutput = commandOutput.replace(/\{message\}/g, 'No message provided');
        commandOutput = commandOutput.replace(/\{amount\}/g, '1');
        commandOutput = commandOutput.replace(/\{duration\}/g, '5m');
        commandOutput = commandOutput.replace(/\{user\}/g, 'target user');

        // Log the command usage
        await supabase
          .from('command_mappings')
          .update({ 
            usage_count: (matchedCommand.usage_count || 0) + 1 
          })
          .eq('id', matchedCommand.id);

        // Log activity
        await supabase
          .from('activities')
          .insert({
            user_id: userId,
            activity_type: 'command_used',
            description: `Command "${matchedCommand.name}" was triggered by AI processing`,
            metadata: {
              commandId: matchedCommand.id,
              guildId: message.guildId,
              channelId: message.channelId,
              discordUserId: message.author.id,
              input: cleanMessage,
              output: commandOutput,
              aiConfidence: parsed.bestMatch.confidence,
              advancedConfidence: bestMatch ? bestMatch.confidence : 0,
              finalParams: finalParams
            }
          });

        return {
          success: true,
          response: `✅ Executing ${matchedCommand.name}: ${commandOutput}`
        };
      }
    }

    // Conversational response with enhanced personality
    let conversationalResponse = parsed.conversationalResponse;
    
    // Add some personality to common responses
    if (!conversationalResponse) {
      const lowerMessage = cleanMessage.toLowerCase();
      
      if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
        conversationalResponse = "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎";
      } else if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
        conversationalResponse = "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀";
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        conversationalResponse = "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently.";
      } else if (lowerMessage.includes('help')) {
        const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
        conversationalResponse = `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`;
      } else {
        conversationalResponse = "Hey! What's up? I'm here and ready to help with whatever you need!";
      }
    }

    return {
      success: true,
      response: conversationalResponse
    };

  } catch (aiError) {
    console.error('AI processing failed:', aiError);
    // Fall back to simple processing
    return await processWithSimpleMatching(cleanMessage, commandMappings, message, userId);
  }
}

// Simple Pattern Matching (fallback)
async function processWithSimpleMatching(cleanMessage, commandMappings, message, userId) {
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
      const params = extractParameters(message, mapping);
      
      // Build the command output
      let commandOutput = mapping.command_output;
      
      // Replace parameters in the output
      for (const [key, value] of Object.entries(params)) {
        commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      
      // Log the command usage
      await supabase
        .from('command_mappings')
        .update({ 
          usage_count: (mapping.usage_count || 0) + 1 
        })
        .eq('id', mapping.id);

      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'command_used',
          description: `Command "${mapping.name}" was triggered by pattern matching`,
          metadata: {
            commandId: mapping.id,
            guildId: message.guildId,
            channelId: message.channelId,
            discordUserId: message.author.id,
            input: cleanMessage,
            output: commandOutput
          }
        });

      return {
        success: true,
        response: `✅ Executing ${mapping.name}: ${commandOutput}`
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
function isCommandMatch(message, commandName) {
  const commandKeywords = {
    'ping': ['ping', 'test', 'check', 'speed', 'latency'],
    'help': ['help', 'commands', 'what can you do'],
    'say': ['say', 'announce', 'tell everyone', 'broadcast'],
    'channel': ['channel', 'info', 'details'],
    'server-info': ['server', 'guild', 'info', 'details']
  };
  
  const keywords = commandKeywords[commandName] || [commandName];
  return keywords.some(keyword => message.includes(keyword));
}

// Helper function to extract parameters from Discord message
function extractParameters(message, mapping) {
  const params = {};
  
  // Extract mentioned users
  if (message.mentions.users.size > 0) {
    const firstMention = message.mentions.users.first();
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

          // Process message with AI and command mappings
          const result = await processMessageWithAI(message, userId);
          
          if (result.success && result.response) {
            await message.reply(result.response);
          } else if (result.needsClarification && result.clarificationQuestion) {
            await message.reply(result.clarificationQuestion);
          } else {
            // Fallback response
            await message.reply("I'm here and ready to help! Try asking me to help with moderation commands or just chat.");
          }

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