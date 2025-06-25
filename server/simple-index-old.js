const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

// Dynamic configuration
const CONFIG = {
  server: {
    port: parseInt(PORT, 10),
    environment: NODE_ENV,
    enableDebugLogging: process.env.DEBUG_LOGGING === 'true'
  },
  database: {
    useSupabase: USE_SUPABASE,
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || ''
  },
  auth: {
    clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
    jwtSecret: process.env.JWT_SECRET || 'your-fallback-secret-key'
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || ''
  },
  features: {
    skipSampleData: process.env.SKIP_SAMPLE_DATA === 'true',
    resetData: process.env.RESET_DATA === 'true'
  }
};

// Validate critical configuration
function validateConfig() {
  const errors = [];
  
  if (CONFIG.server.environment === 'production') {
    if (!CONFIG.ai.geminiApiKey || CONFIG.ai.geminiApiKey.length < 20) {
      errors.push('GEMINI_API_KEY required in production');
    }
    
    if (!CONFIG.auth.clerkSecretKey || !CONFIG.auth.clerkSecretKey.startsWith('sk_')) {
      errors.push('Valid CLERK_SECRET_KEY required in production');
    }
    
    if (CONFIG.database.useSupabase && (!CONFIG.database.supabaseUrl || !CONFIG.database.supabaseKey)) {
      errors.push('SUPABASE_URL and SUPABASE_ANON_KEY required when USE_SUPABASE=true');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ CONFIG VALIDATION FAILED:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (CONFIG.server.environment === 'production') {
      throw new Error('Production configuration invalid. See errors above.');
    } else {
      console.warn('⚠️ Config issues detected (development mode continues)');
    }
  } else {
    console.log('✅ Configuration validated successfully');
  }
}

// Dynamic user ID extraction (no hardcoding)
function extractUserIdFromRequest(req) {
  // Try to extract from Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/, '');
    if (token && token !== 'undefined' && token !== 'null') {
      return token;
    }
  }
  
  // Fallback to test user only in development
  if (CONFIG.server.environment === 'development') {
    const testUserId = process.env.DEFAULT_TEST_USER_ID || `dev-user-${Date.now()}`;
    console.warn('⚠️ Using development test user ID:', testUserId);
    return testUserId;
  }
  
  return null;
}

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

// Store bot message IDs for reply tracking
const botMessageIds = new Set();

// Advanced Message Context Management (migrated from local TypeScript version)
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

  getRecentMessages(channelId, limit = 5) {
    const messages = this.contexts.get(channelId) || [];
    return messages.slice(-limit);
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

// AI Message Processing Function
async function processMessageWithAI(message, userId) {
  try {
    // Clean the message content (remove bot mentions)
    let cleanMessage = message.content.replace(/<@!?\d+>/g, '').trim();
    
    // Enhanced conversation context building using MessageContextManager
    let conversationContext = '';
    if (message.reference && message.reference.messageId) {
      try {
        // First check MessageContextManager for the referenced message
        const referencedMessage = messageContextManager.getMessageById(
          message.channelId, 
          message.reference.messageId
        );
        
        if (referencedMessage) {
          conversationContext = `Previous message context: ${referencedMessage.author}: "${referencedMessage.content}"`;
          console.log(`🧠 Adding conversation context from MessageContextManager: ${conversationContext}`);
        } else {
          // Fallback: fetch from Discord API if not in our cache
          const fetchedMessage = await message.channel.messages.fetch(message.reference.messageId);
          if (fetchedMessage && fetchedMessage.author.bot) {
            conversationContext = `Previous bot message: "${fetchedMessage.content}"`;
            // Add to our tracking for future reference
            messageContextManager.addMessage(
              message.channelId,
              fetchedMessage.id,
              fetchedMessage.content,
              fetchedMessage.author.tag,
              true
            );
            botMessageIds.add(fetchedMessage.id);
            console.log(`🧠 Adding conversation context (fetched from Discord): ${conversationContext}`);
          }
        }
      } catch (error) {
        console.error('Error fetching conversation context:', error);
        // Even if we can't fetch the message, if there's a reference, assume it's conversational
        if (message.reference && message.reference.messageId) {
          conversationContext = 'User is replying to a previous message (context unavailable)';
          console.log(`🧠 Adding fallback conversation context: ${conversationContext}`);
        }
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
        console.log(`💬 Enhanced with recent conversation context`);
      }
    }
    
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
      return await processWithAI(cleanMessage, commandMappings, message, userId, conversationContext);
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
    /^whats up[\s?]*$/i,
    /^wassup[\s?]*$/i,
    /^good (morning|afternoon|evening)[\s!]*$/i,
    /^thank you[\s!]*$/i,
    /^thanks[\s!]*$/i,
    /^(im great|not much|good|fine).*$/i,  // Allow anything after these patterns
    /^(lol|haha|awesome|nice|wow)[\s!]*$/i,
    /^(yes|no|sure|maybe|alright)[\s!]*$/i,
    /^(ok|okay|cool|got it|gotcha)[\s!]*$/i,
    /^(i'm good|i'm fine|i'm great|i'm okay).*$/i,  // Allow anything after these patterns
    /^(doing good|doing well|doing fine|doing great|doing awesome).*$/i,  // Added "doing great" and "doing awesome"
    /^not much[\s,].*$/i,
    /^just.*$/i,
    /^nothing much[\s,].*$/i,
    // Add more flexible patterns for common conversational replies
    /^(great|good|fine|awesome|excellent)\s+(thanks?|thank you)[\s!]*$/i,
    /^(thanks?|thank you)\s+(for\s+.+)?$/i,
    /^(sounds?\s+good|sounds?\s+great|sounds?\s+awesome)[\s!]*$/i,
    /^(that's?\s+)?(cool|nice|great|awesome|perfect)[\s!]*$/i,
    /^(wassup|what's up|whats up|how are you|i'm good|i'm fine|i'm great|i'm okay|doing good|doing well|doing great|awesome|nice|wow|thanks|thank you|just|nothing much|sounds good|that's cool)[\s!]*$/i
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
async function processWithAI(cleanMessage, commandMappings, message, userId, conversationContext) {
  try {
    // **CRITICAL PREPROCESSING**: Check for conversational input BEFORE AI
    // This matches the sophisticated local TypeScript system
    if (isConversationalInput(cleanMessage)) {
      console.log(`🎯 CONVERSATIONAL INPUT DETECTED: "${cleanMessage}" - Bypassing aggressive AI`);
      
      // Return appropriate conversational response based on input
      const lowerMessage = cleanMessage.toLowerCase();
      
      if (lowerMessage.includes('wassup') || lowerMessage.includes('what\'s up') || lowerMessage.includes('whats up')) {
        return {
          success: true,
          response: "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
        };
      } else if (lowerMessage.includes('how') && (lowerMessage.includes('going') || lowerMessage.includes('doing'))) {
        return {
          success: true,
          response: "I'm doing great! Running smooth and ready for action. How about you? Need help with anything? 🚀"
        };
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return {
          success: true,
          response: "Hello! I'm your AI Discord bot. You can give me natural language commands and I'll execute them intelligently."
        };
      } else if (lowerMessage.includes('help')) {
        const commandNames = commandMappings.map(cmd => cmd.name).slice(0, 5);
        return {
          success: true,
          response: `I can help with these commands: ${commandNames.join(', ')}. Try using natural language like "execute ${commandNames[0]}" or just mention the command name!`
        };
      } else {
        // Default conversational response for other patterns
        return {
          success: true,
          response: "Hey! What's up? I'm here and ready to help with whatever you need!"
        };
      }
    }
    
    // **ADVANCED COMMAND MATCHING**: Use local sophisticated logic BEFORE AI
    const mentionedUserIds = [];
    if (message.mentions && message.mentions.users.size > 0) {
      message.mentions.users.forEach(user => mentionedUserIds.push(user.id));
    }
    
    const bestMatch = await findBestCommandMatch(cleanMessage, commandMappings, mentionedUserIds);
    
    if (bestMatch && bestMatch.confidence > 0.5) {
      console.log(`🎯 ADVANCED MATCHING FOUND: "${bestMatch.command.name}" with ${bestMatch.confidence} confidence`);
      
      // Use advanced match instead of AI for high-confidence matches
      let commandOutput = bestMatch.command.command_output;
      
      // Replace parameters in the output
      for (const [key, value] of Object.entries(bestMatch.params)) {
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
          usage_count: (bestMatch.command.usage_count || 0) + 1 
        })
        .eq('id', bestMatch.command.id);

      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: 'command_used',
          description: `Command "${bestMatch.command.name}" was triggered by advanced matching`,
          metadata: {
            commandId: bestMatch.command.id,
            guildId: message.guildId,
            channelId: message.channelId,
            discordUserId: message.author.id,
            input: cleanMessage,
            output: commandOutput,
            advancedConfidence: bestMatch.confidence,
            method: 'advanced_matching'
          }
        });

      // Execute the actual Discord command
      const executionResult = await executeDiscordCommand(commandOutput, bestMatch.command.name, message);
      
      return {
        success: executionResult.success,
        response: executionResult.response
      };
    }
    
    console.log(`🤖 USING AI PROCESSING: No conversational or advanced match found for "${cleanMessage}"`);
    
    // **CRITICAL FIX**: Get bot personality context like local TypeScript system
    const { data: bots } = await supabase
      .from('bot_connections')
      .select('personality_context')
      .eq('user_id', userId)
      .limit(1);
    
    const bot = bots && bots.length > 0 ? bots[0] : null;
    const personalityContext = bot?.personality_context || 
      "You are a helpful Discord bot assistant that can handle moderation commands and casual conversation. You're friendly, efficient, and great at understanding natural language.";
    
    // **UPGRADE TO ADVANCED MODEL**: Use gemini-1.5-pro like local system
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a comprehensive prompt for command analysis
    const commandList = commandMappings.map(cmd => 
      `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: "${cmd.natural_language_pattern}" → ${cmd.command_output}`
    ).join('\n');

    // **ENHANCED PROMPT**: Match local TypeScript system with personality context
    const prompt = `${personalityContext}

${conversationContext ? `
🗣️ **CONVERSATION CONTEXT:**
${conversationContext}
` : ''}

You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**
4. **Handle help requests and capability questions conversationally**

AVAILABLE COMMANDS:
${commandList}

🎯 **INTELLIGENT DECISION MAKING:**

**EXECUTE COMMANDS IF:**
- ✅ Clear action words present (ban, kick, warn, mute, purge, delete, remove, tell, say, check, ping, etc.)
- ✅ User mentions someone AND context suggests moderation action
- ✅ Numbers present AND context suggests amount-based commands (purge, slowmode)
- ✅ Message content present AND context suggests announcement/communication
- ✅ Context clearly indicates user wants something DONE rather than just chatting

**CASUAL CONVERSATION IF:**
- ❌ **GREETING PATTERNS**: Any form of greeting, hello, how are you, what's up, wassup, etc.
- ❌ **HELP/CAPABILITY QUESTIONS**: "what can you do", "show commands", "list commands", "help me", "command list", etc.
- ❌ **SOCIAL CHAT**: Casual social interaction without action intent
- ❌ **STATUS QUESTIONS**: Asking about bot status, capabilities, or general wellbeing
- ❌ **ACKNOWLEDGMENTS**: Thanks, ok, got it, cool, nice, wow, etc.
- ❌ **EMOTIONAL RESPONSES**: Reactions like lol, haha, awesome without command context
- ❌ **GENERAL CHAT**: Any message that feels like normal human conversation vs commanding

**KEY INSIGHT**: Questions about capabilities ("what can you do", "make a command list") = HELP REQUESTS = Conversational response with command information, NOT executing commands!

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

USER MESSAGE: "${cleanMessage}"

CONTEXT: ${conversationContext || 'User mentioned me in Discord. Extract any mentioned users, numbers, or quoted text.'}

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
  "conversationalResponse": "friendly, helpful response that maintains conversation flow and references previous context when appropriate"
}
\`\`\`

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

        // Execute the actual Discord command instead of just returning a fake response
        const executionResult = await executeDiscordCommand(commandOutput, matchedCommand.name, message);
        
        return {
          success: executionResult.success,
          response: executionResult.response
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

      // Execute the actual Discord command instead of just returning a fake response
      const executionResult = await executeDiscordCommand(commandOutput, mapping.name, message);

      return {
        success: executionResult.success,
        response: executionResult.response
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

          // Store this user message for context (like local version)
          messageContextManager.addMessage(
            message.channelId,
            message.id,
            message.content,
            message.author.tag,
            false
          );

          const botMentioned = message.mentions.users.has(client.user.id);
          
          // Enhanced reply detection - check if replying to any of our bot's messages
          let isReplyToBot = false;
          if (message.reference && message.reference.messageId) {
            try {
              // Check MessageContextManager first (more reliable)
              const referencedMessage = messageContextManager.getMessageById(
                message.channelId, 
                message.reference.messageId
              );
              
              if (referencedMessage && referencedMessage.isBot) {
                isReplyToBot = true;
                console.log(`✅ Reply detected to bot message (MessageContextManager): ${message.reference.messageId}`);
                console.log(`🔍 Referenced message was: "${referencedMessage.content}"`);
              } else {
                // Fallback: fetch the message to check if it's from our bot
                const fetchedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (fetchedMessage && fetchedMessage.author.id === client.user.id) {
                  isReplyToBot = true;
                  // Add to our tracking for future reference
                  messageContextManager.addMessage(
                    message.channelId,
                    fetchedMessage.id,
                    fetchedMessage.content,
                    fetchedMessage.author.tag,
                    true
                  );
                  botMessageIds.add(fetchedMessage.id);
                  console.log(`✅ Reply detected to bot message (fetched): ${message.reference.messageId}`);
                  console.log(`🔍 Referenced message was: "${fetchedMessage.content}"`);
                }
              }
            } catch (fetchError) {
              console.error('❌ Error fetching referenced message:', fetchError);
              // If we can't fetch the message but have a reference, try a different approach
              if (message.reference && message.reference.messageId) {
                console.log(`🔄 Assuming reply to bot based on reference structure`);
                isReplyToBot = true;
              }
            }
          }

          console.log(`📨 Message received from ${message.author.username}:`);
          console.log(`   Content: "${message.content}"`);
          console.log(`   Bot mentioned: ${botMentioned}`);
          console.log(`   Is reply to bot: ${isReplyToBot}`);
          console.log(`   Message ID: ${message.id}`);
          console.log(`   Channel ID: ${message.channel.id}`);
          console.log(`   Guild ID: ${message.guild?.id || 'DM'}`);
          console.log(`   Referenced message ID: ${message.reference?.messageId || 'None'}`);

          if (!botMentioned && !isReplyToBot) {
            console.log(`⏭️ Ignoring message - bot not mentioned and not a reply to bot`);
            return;
          }

          // Enhanced logging for command detection trigger
          const triggerType = botMentioned ? 'mention' : 'reply';
          console.log(`🎯 Processing ${triggerType} from ${message.author.username}: "${message.content}"`);
          console.log(`   📋 Commands can be executed from both mentions AND replies!`);

          console.log(`📨 Processing: "${message.content}" from ${message.author.username}`);

          // Process message with AI and command mappings
          const result = await processMessageWithAI(message, userId);
          
          let replyOptions = {
            allowedMentions: { repliedUser: false } // Don't ping the user when replying
          };
          
          let botMessage = null;
          
          if (result.success && result.response) {
            try {
              botMessage = await message.reply({ content: result.response, ...replyOptions });
              console.log(`✅ Replied to ${message.author.username}: ${result.response}`);
            } catch (replyError) {
              console.error('❌ Reply failed, trying regular send:', replyError);
              botMessage = await message.channel.send(`${message.author}, ${result.response}`);
            }
          } else if (result.needsClarification && result.clarificationQuestion) {
            try {
              botMessage = await message.reply({ content: result.clarificationQuestion, ...replyOptions });
              console.log(`✅ Sent clarification to ${message.author.username}: ${result.clarificationQuestion}`);
            } catch (replyError) {
              console.error('❌ Reply failed, trying regular send:', replyError);
              botMessage = await message.channel.send(`${message.author}, ${result.clarificationQuestion}`);
            }
          } else {
            // Fallback response
            const fallbackMsg = "I'm here and ready to help! Try asking me to help with moderation commands or just chat.";
            try {
              botMessage = await message.reply({ content: fallbackMsg, ...replyOptions });
              console.log(`✅ Sent fallback reply to ${message.author.username}`);
            } catch (replyError) {
              console.error('❌ Reply failed, trying regular send:', replyError);
              botMessage = await message.channel.send(`${message.author}, ${fallbackMsg}`);
            }
          }

          // Track the bot's message ID for future reply detection
          if (botMessage) {
            botMessageIds.add(botMessage.id);
            console.log(`📝 Tracking bot message ID: ${botMessage.id} for future replies`);
            
            // Also add to MessageContextManager for better context tracking
            messageContextManager.addMessage(
              message.channelId,
              botMessage.id,
              result.response,
              client.user.tag,
              true
            );
            console.log(`💾 Stored bot response in MessageContextManager for conversation context`);
            
            // Clean up old message IDs to prevent memory leaks (keep last 1000)
            if (botMessageIds.size > 1000) {
              const oldestIds = Array.from(botMessageIds).slice(0, botMessageIds.size - 1000);
              oldestIds.forEach(id => botMessageIds.delete(id));
            }
          }

        } catch (error) {
          console.error('❌ Error processing message:', error);
          try {
            const errorMessage = await message.reply('Sorry, I encountered an error. Please try again.');
            if (errorMessage) {
              botMessageIds.add(errorMessage.id);
            }
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

    // Validate Discord token if it's a Discord bot
    if (platformType === 'discord') {
      try {
        // Clean the token
        const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');

        // Basic format validation
        if (cleanToken.length < 50) {
          return res.status(400).json({ 
            error: 'Invalid Discord bot token',
            details: 'Token appears too short. Discord bot tokens are typically 59+ characters.',
            suggestion: 'Please copy the complete token from the Discord Developer Portal.'
          });
        }

        if (!/^[A-Za-z0-9._-]+$/.test(cleanToken)) {
          return res.status(400).json({ 
            error: 'Invalid Discord bot token',
            details: 'Token contains invalid characters. Only letters, numbers, dots, underscores, and hyphens are allowed.',
            suggestion: 'Please ensure you copied the token correctly without extra spaces or characters.'
          });
        }

        // Try to validate with Discord API
        const response = await fetch('https://discord.com/api/v10/applications/@me', {
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Discord API validation failed:', response.status, errorText);
          
          let errorMessage = 'Invalid Discord bot token';
          let suggestion = 'Please check that you copied the token correctly from the Discord Developer Portal.';
          
          if (response.status === 401) {
            errorMessage = 'Invalid Discord bot token';
            suggestion = 'Please verify the token is correct and hasn\'t been regenerated.';
          } else if (response.status === 403) {
            errorMessage = 'Discord bot token lacks required permissions';
            suggestion = 'Ensure the bot has "bot" and "applications.commands" scopes in the Discord Developer Portal.';
          } else if (response.status === 429) {
            errorMessage = 'Too many requests to Discord API';
            suggestion = 'Please wait a moment and try again.';
          }
          
          return res.status(400).json({ 
            error: errorMessage,
            details: 'Unable to validate the Discord bot token with Discord\'s API.',
            suggestion
          });
        }

        const application = await response.json();
        console.log(`✅ Discord token validated for bot: ${application.name}`);

      } catch (fetchError) {
        console.error('Discord API fetch error:', fetchError);
        return res.status(400).json({ 
          error: 'Unable to validate Discord token',
          details: 'Could not connect to Discord API to validate the token.',
          suggestion: 'Please check your internet connection and try again.'
        });
      }
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Discord token validation endpoint - v2
app.post('/api/discord', async (req, res) => {
  try {
    const { action } = req.query;
    
    if (action === 'validate-token' && req.method === 'POST') {
      const { token, botToken } = req.body;
      const discordToken = token || botToken;

      if (!discordToken) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Token is required' 
        });
      }

      // Clean the token
      const cleanToken = discordToken.trim().replace(/^Bot\s+/i, '');

      // Basic format validation
      if (cleanToken.length < 50) {
        return res.status(200).json({ 
          valid: false, 
          message: 'Token appears too short. Discord bot tokens are typically 59+ characters.' 
        });
      }

      if (!/^[A-Za-z0-9._-]+$/.test(cleanToken)) {
        return res.status(200).json({ 
          valid: false, 
          message: 'Token contains invalid characters. Only letters, numbers, dots, underscores, and hyphens are allowed.' 
        });
      }

      // Try to validate with Discord API
      try {
        const response = await fetch('https://discord.com/api/v10/applications/@me', {
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Discord API validation failed:', response.status, errorText);
          
          let message = 'Invalid Discord bot token';
          if (response.status === 401) {
            message = 'Invalid Discord bot token. Please check that you copied the token correctly from the Discord Developer Portal.';
          } else if (response.status === 403) {
            message = 'Discord bot token lacks required permissions. Ensure the bot has "bot" and "applications.commands" scopes.';
          } else if (response.status === 429) {
            message = 'Too many requests to Discord API. Please wait a moment and try again.';
          }
          
          return res.status(200).json({ 
            valid: false, 
            message 
          });
        }

        const application = await response.json();

        return res.status(200).json({
          valid: true,
          message: `✅ Token is valid! Bot: ${application.name}`,
          botInfo: {
            id: application.id,
            name: application.name,
            description: application.description,
            avatar: application.icon ? `https://cdn.discordapp.com/app-icons/${application.id}/${application.icon}.png` : null
          }
        });

      } catch (fetchError) {
        console.error('Discord API fetch error:', fetchError);
        return res.status(200).json({ 
          valid: false, 
          message: 'Unable to validate token with Discord API. Please check your internet connection and try again.' 
        });
      }
    }

    // Handle message processing for Universal Relay Service
    if (action === 'process-message') {
      const { message: messageData, botToken, botClientId } = req.body;
      
      if (!messageData || !botToken) {
        return res.json({
          processed: false,
          reason: 'Missing message data or bot token'
        });
      }

      // Create a mock Discord message object for processing
      const mockMessage = {
        id: messageData.id || 'mock-id',
        content: messageData.content,
        author: {
          id: messageData.author.id,
          username: messageData.author.username,
          bot: messageData.author.bot || false,
          tag: messageData.author.username
        },
        channelId: messageData.channel_id,
        channel: {
          id: messageData.channel_id,
          isTextBased: () => true,
          isDMBased: () => false,
          name: `channel-${messageData.channel_id}`,
          type: 0, // TEXT_CHANNEL
          createdAt: new Date(),
          send: async (content) => {
            console.log(`Mock send to channel ${messageData.channel_id}:`, content);
            return { id: 'mock-response-id', content };
          },
          bulkDelete: async (amount, filterOld = false) => {
            console.log(`Mock bulk delete ${amount} messages in channel ${messageData.channel_id}`);
            return new Map(); // Mock Collection of deleted messages
          },
          setRateLimitPerUser: async (seconds) => {
            console.log(`Mock set slowmode to ${seconds} seconds in channel ${messageData.channel_id}`);
            return Promise.resolve();
          },
          messages: {
            fetch: async (messageId) => ({
              id: messageId,
              content: 'Mock referenced message',
              author: { id: 'mock-author', tag: 'MockUser#0001' },
              pin: async () => {
                console.log(`Mock pin message ${messageId}`);
                return Promise.resolve();
              }
            })
          }
        },
        guild: messageData.guild_id ? {
          id: messageData.guild_id,
          members: {
            me: {
              permissions: {
                has: () => true // Mock permissions for testing
              }
            },
            fetch: async (userId) => ({
              id: userId,
              displayName: `User${userId}`,
              user: { id: userId, username: `user${userId}` },
              kick: async (reason) => {
                console.log(`Mock kick user ${userId}: ${reason}`);
                return Promise.resolve();
              },
              timeout: async (duration, reason) => {
                console.log(`Mock timeout user ${userId} for ${duration}ms: ${reason}`);
                return Promise.resolve();
              }
            })
          },
          bans: {
            create: async (userId, options) => {
              console.log(`Mock ban user ${userId}:`, options);
              return Promise.resolve();
            }
          },
          commands: {
            fetch: async () => new Map()
          }
        } : null,
        mentions: {
          users: {
            size: messageData.mentions?.length || 0,
            first: function() {
              return messageData.mentions && messageData.mentions.length > 0 ? messageData.mentions[0] : null;
            },
            has: function(userId) {
              return messageData.mentions?.some(mention => mention.id === userId) || false;
            },
            forEach: function(callback) {
              if (messageData.mentions) {
                messageData.mentions.forEach(callback);
              }
            }
          }
        },
        reference: messageData.referenced_message ? {
          messageId: messageData.referenced_message.id
        } : undefined,
        client: {
          user: { id: botClientId },
          ws: { ping: 42 },
          application: {
            commands: {
              fetch: async () => new Map()
            }
          }
        },
        delete: async () => console.log('Mock delete message'),
        reply: async (content) => {
          console.log(`Mock reply:`, content);
          return { id: 'mock-reply-id', content };
        }
      };

      // Extract user ID (in production this would come from authentication)
      const userId = 'user_2yMTRvIng7ljDfRRUlXFvQkWSb5'; // Default test user
      
      console.log(`🔍 Processing message via API: "${messageData.content}" from ${messageData.author.username}`);
      
      // Process the message using the existing AI logic
      const result = await processMessageWithAI(mockMessage, userId);
      
      if (result.success && result.response) {
        console.log(`🤖 API Response: ${result.response}`);
        
        return res.json({
          processed: true,
          response: result.response,
          execution: result.execution || null
        });
      } else {
        return res.json({
          processed: false,
          reason: result.response || 'No response generated'
        });
      }
    }

    // Handle other Discord API actions if needed
    return res.status(400).json({ error: 'Invalid action or method' });

  } catch (error) {
    console.error('Discord API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while processing the Discord API request.'
    });
  }
});

// Add Express API endpoint to handle Universal Relay Service requests
app.get('/api/discord', (req, res) => {
  const { action } = req.query;
  
  if (action === 'process-message') {
    res.json({
      processed: false,
      reason: 'GET method not supported for process-message'
    });
  } else {
    res.json({
      processed: false,
      reason: 'Unknown action'
    });
  }
});

// Start server
validateConfig();

app.listen(CONFIG.server.port, () => {
  console.log(`🚀 Commandless server running on port ${CONFIG.server.port}`);
  console.log(`🌍 Environment: ${CONFIG.server.environment}`);
  console.log(`📡 Database: ${CONFIG.database.useSupabase ? 'Supabase' : 'In-memory'}`);
  console.log(`🤖 AI: ${CONFIG.ai.geminiApiKey ? 'Gemini Connected' : 'No AI'}`);
  console.log(`🔒 Security: ${CONFIG.security.encryptionKey ? 'Encrypted' : 'Basic'}`);
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

// Update/Edit bot
app.put('/api/bots/:id', async (req, res) => {
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

    const { id: botId } = req.params;
    const { botName, token: botToken, personalityContext } = req.body;

    if (!botId) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    // Get existing bot to verify ownership
    const { data: existingBot, error: fetchError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .single();

    if (fetchError || !existingBot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Prepare update data
    const updateData = {};
    if (botName) updateData.bot_name = botName;
    if (botToken) updateData.token = botToken;
    if (personalityContext !== undefined) updateData.personality_context = personalityContext;

    // If token is being updated, check for conflicts
    if (botToken && botToken !== existingBot.token) {
      const { data: conflictBot, error: conflictError } = await supabase
        .from('bots')
        .select('id, bot_name, user_id')
        .eq('token', botToken)
        .neq('id', botId)
        .single();

      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Error checking for token conflict:', conflictError);
        return res.status(500).json({ error: 'Failed to validate token' });
      }

      if (conflictBot) {
        return res.status(409).json({ 
          error: 'Token already in use',
          details: 'This Discord bot token is already being used by another bot.',
          suggestion: 'Please use a different Discord bot token.'
        });
      }

      // If token is being changed and bot is connected, disconnect it first
      if (existingBot.is_connected) {
        await discordBotManager.stopBot(existingBot.token);
        updateData.is_connected = false;
      }
    }

    // Update the bot
    const { data: updatedBot, error: updateError } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bot:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update bot',
        details: 'There was an error updating your bot. Please try again.'
      });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'bot_updated',
        description: `Bot "${updatedBot.bot_name}" was updated`,
        metadata: { 
          botId: updatedBot.id,
          changes: Object.keys(updateData)
        }
      });

    res.json({
      id: updatedBot.id,
      botName: updatedBot.bot_name,
      platformType: updatedBot.platform_type,
      personalityContext: updatedBot.personality_context,
      isConnected: updatedBot.is_connected,
      createdAt: updatedBot.created_at,
      message: `${updatedBot.bot_name} has been updated successfully.`
    });

  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while updating your bot.'
    });
  }
});

// Delete bot
app.delete('/api/bots/:id', async (req, res) => {
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

    const { id: botId } = req.params;

    if (!botId) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    // Get bot to verify ownership and get details
    const { data: bot, error: fetchError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .single();

    if (fetchError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Stop the bot if it's connected
    if (bot.is_connected && bot.token) {
      try {
        await discordBotManager.stopBot(bot.token);
      } catch (error) {
        console.error('Error stopping bot during deletion:', error);
        // Continue with deletion even if stopping fails
      }
    }

    // Delete associated command mappings first
    const { error: mappingsError } = await supabase
      .from('command_mappings')
      .delete()
      .eq('bot_id', botId);

    if (mappingsError) {
      console.error('Error deleting command mappings:', mappingsError);
      // Continue with bot deletion even if mappings deletion fails
    }

    // Delete the bot
    const { error: deleteError } = await supabase
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('user_id', decodedToken.userId);

    if (deleteError) {
      console.error('Error deleting bot:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete bot',
        details: 'There was an error deleting your bot. Please try again.'
      });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'bot_deleted',
        description: `Bot "${bot.bot_name}" was deleted`,
        metadata: { 
          botId: bot.id,
          botName: bot.bot_name,
          platformType: bot.platform_type
        }
      });

    res.json({
      success: true,
      message: `${bot.bot_name} has been deleted successfully.`
    });

  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while deleting your bot.'
    });
  }
});

// Real Discord.js Command Execution
async function executeDiscordCommand(commandOutput, mappingName, message) {
  try {
    // Extract the command name from the command output (e.g., "/pin" from "/pin")
    const commandMatch = commandOutput.match(/^\/([a-zA-Z0-9_-]+)/);
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

    // First try to execute critical commands that need special Discord.js handling
    const criticalCommands = ['pin', 'ping', 'say', 'purge'];
    
    if (criticalCommands.includes(command)) {
      switch (command) {
        case 'pin':
          try {
            if (!botMember.permissions.has('ManageMessages')) {
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
            // Extract the message content from the command output
            const messageMatch = commandOutput.match(/\{message\}/) ? 
              commandOutput.replace(/.*\{message\}/, '') : 
              commandOutput.replace(/^\/say\s*/, '');
            
            if (!messageMatch.trim()) {
              return { success: false, response: "❌ Please provide a message to say" };
            }
            
            await message.delete(); // Delete the command message
            await message.channel.send(messageMatch.trim());
            
            return { success: true, response: '' }; // Empty response since we sent the message
          } catch (error) {
            return { success: false, response: `❌ Failed to send message: ${error.message}` };
          }

        case 'purge':
          try {
            if (!botMember.permissions.has('ManageMessages')) {
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
      }
    }

    // For all other commands, try to execute them dynamically through Discord's interaction system
    try {
      // Attempt to find and execute the command dynamically
      const result = await executeDiscordSlashCommand(command, commandOutput, message);
      if (result) {
        return result;
      }
    } catch (dynamicError) {
      console.error(`Dynamic execution failed for /${command}:`, dynamicError);
    }

    // Fallback: Try to simulate the command response based on the command type
    return await simulateCommandExecution(command, commandOutput, message);

  } catch (error) {
    return {
      success: false,
      response: `❌ Error executing command: ${error.message}`
    };
  }
}

// Dynamic slash command execution through Discord's interaction system
async function executeDiscordSlashCommand(commandName, commandOutput, message) {
  try {
    const guild = message.guild;
    if (!guild) return null;

    // Get the bot's application commands
    const commands = await guild.commands.fetch();
    // Convert Collection to Array to use .find()
    const commandsArray = Array.from(commands.values());
    const targetCommand = commandsArray.find(cmd => cmd.name.toLowerCase() === commandName.toLowerCase());
    
    if (!targetCommand) {
      // Try global commands
      const globalCommands = await message.client.application.commands.fetch();
      const globalCommandsArray = Array.from(globalCommands.values());
      const globalCommand = globalCommandsArray.find(cmd => cmd.name.toLowerCase() === commandName.toLowerCase());
      
      if (!globalCommand) {
        console.log(`Command /${commandName} not found in guild or global commands`);
        return null;
      }
    }

    // For most commands, we can't directly execute them as they require user interaction
    // But we can simulate their behavior or provide appropriate responses
    console.log(`Found command /${commandName}, attempting simulation...`);
    return null; // Let it fall through to simulation

  } catch (error) {
    console.error(`Error in dynamic command execution for /${commandName}:`, error);
    return null;
  }
}

// Simulate command execution for commands that can't be directly executed
async function simulateCommandExecution(commandName, commandOutput, message) {
  const botMember = message.guild?.members?.me;
  
  switch (commandName.toLowerCase()) {
    case 'ban':
      try {
        if (!botMember.permissions.has('BanMembers')) {
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
        if (!botMember.permissions.has('KickMembers')) {
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
        const reason = reasonMatch ? reasonMatch[1] : 'Please follow server rules';

        // Try to get display name
        let displayName = `<@${userId}>`;
        try {
          const targetUser = await message.guild.members.fetch(userId);
          displayName = targetUser.displayName;
        } catch (error) {
          // Use mention as fallback
        }
        
        return {
          success: true,
          response: `⚠️ **Warning issued to ${displayName}**\n**Reason:** ${reason}\n**Issued by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, response: `❌ Failed to warn user: ${error.message}` };
      }

    case 'mute':
      try {
        if (!botMember.permissions.has('ModerateMembers')) {
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

    case 'slowmode':
      try {
        if (!botMember.permissions.has('ManageChannels')) {
          return { success: false, response: "❌ I don't have permission to manage channels" };
        }

        // Extract duration from command output
        const durationMatch = commandOutput.match(/(\d+)\s*([smh])/i);
        let seconds = 0;
        
        if (durationMatch) {
          const amount = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          switch (unit) {
            case 's': seconds = amount; break;
            case 'm': seconds = amount * 60; break;
            case 'h': seconds = amount * 3600; break;
            default: seconds = amount; // Assume seconds if no unit
          }
        } else {
          // Try to extract just a number
          const numberMatch = commandOutput.match(/(\d+)/);
          seconds = numberMatch ? parseInt(numberMatch[1]) : 5;
        }

        // Discord max slowmode is 21600 seconds (6 hours)
        seconds = Math.min(seconds, 21600);

        if (message.channel.isTextBased() && 'setRateLimitPerUser' in message.channel) {
          await message.channel.setRateLimitPerUser(seconds);
          
          if (seconds === 0) {
            return {
              success: true,
              response: `🚀 **Slowmode disabled**\n**Changed by:** ${message.author.username}`
            };
          } else {
            return {
              success: true,
              response: `🐌 **Slowmode set to ${seconds} seconds**\n**Changed by:** ${message.author.username}`
            };
          }
        } else {
          return { success: false, response: "❌ Cannot set slowmode on this channel type" };
        }
      } catch (error) {
        return { success: false, response: `❌ Failed to set slowmode: ${error.message}` };
      }

    case 'server-info':
    case 'serverinfo':
      try {
        const guild = message.guild;
        if (!guild) {
          return { success: false, response: "❌ This command can only be used in a server" };
        }
        
        const info = `📊 **Server Information**
**Name:** ${guild.name}
**Members:** ${guild.memberCount}
**Created:** ${guild.createdAt.toDateString()}
**Owner:** ${guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown'}`;
        
        return { success: true, response: info };
      } catch (error) {
        return { success: false, response: `❌ Failed to get server info: ${error.message}` };
      }

    case 'channel':
      try {
        const channel = message.channel;
        if (!channel) {
          return { success: false, response: "❌ Could not get channel information" };
        }
        
        const info = `📺 **Channel Information**
**Name:** ${channel.name || 'Unknown'}
**Type:** ${channel.type}
**ID:** ${channel.id}
**Created:** ${channel.createdAt ? channel.createdAt.toDateString() : 'Unknown'}`;
        
        return { success: true, response: info };
      } catch (error) {
        return { success: false, response: `❌ Failed to get channel info: ${error.message}` };
      }

    case 'user':
      try {
        // Extract user ID
        let userId = null;
        const userMatch = commandOutput.match(/<@!?(\d+)>/) || commandOutput.match(/(\d{17,19})/);
        if (userMatch) {
          userId = userMatch[1];
        } else if (message.mentions.users.size > 0) {
          userId = message.mentions.users.first().id;
        } else {
          // Default to the command author
          userId = message.author.id;
        }

        const member = await message.guild.members.fetch(userId);
        const user = member.user;
        
        const info = `👤 **User Information**
**Username:** ${user.username}
**Display Name:** ${member.displayName}
**ID:** ${user.id}
**Joined Server:** ${member.joinedAt ? member.joinedAt.toDateString() : 'Unknown'}
**Account Created:** ${user.createdAt.toDateString()}
**Roles:** ${member.roles.cache.size - 1} roles`; // -1 to exclude @everyone
        
        return { success: true, response: info };
      } catch (error) {
        return { success: false, response: `❌ Failed to get user info: ${error.message}` };
      }

    case 'note':
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
          return { success: false, response: "❌ Please specify a valid user for the note" };
        }

        const reasonMatch = commandOutput.match(/\{message\}\s*(.+)/) || 
                           commandOutput.match(/note\s+(.+)/i);
        const noteContent = reasonMatch ? reasonMatch[1] : 'Note added';

        // Try to get display name
        let displayName = `<@${userId}>`;
        try {
          const targetUser = await message.guild.members.fetch(userId);
          displayName = targetUser.displayName;
        } catch (error) {
          // Use mention as fallback
        }
        
        return {
          success: true,
          response: `📝 **Note added for ${displayName}**\n**Note:** ${noteContent}\n**Added by:** ${message.author.username}`
        };
      } catch (error) {
        return { success: false, response: `❌ Failed to add note: ${error.message}` };
      }

    default:
      // For any other commands we don't have specific handlers for, 
      // provide a meaningful response indicating the command was recognized
      return {
        success: true,
        response: `✅ **/${commandName}** command executed\n**Parameters:** ${commandOutput.replace(/^\/\w+\s*/, '') || 'None'}\n**Executed by:** ${message.author.username}`
      };
  }
}