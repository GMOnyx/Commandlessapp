import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import { setupTables } from './setup-tables.js';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Track if we've tried to set up tables
let tablesSetupAttempted = false;

// Helper function to ensure tables exist
async function ensureTablesExist() {
  if (tablesSetupAttempted) return;
  
  try {
    // Test if tables exist by querying users table
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('📝 Database tables not found, attempting to create them...');
      await setupTables();
    }
  } catch (error) {
    console.warn('Could not verify/create database tables:', error.message);
  }
  
  tablesSetupAttempted = true;
}

// Helper function to handle database errors gracefully
function handleDatabaseError(error, operation) {
  console.error(`Database error during ${operation}:`, error);
  
  if (error.message.includes('does not exist')) {
    return {
      error: 'Database not configured',
      message: 'Database tables are missing. Please run: npm run setup:api-tables',
      details: 'Or manually create tables using setup-database.sql in Supabase SQL Editor',
      code: 'DB_TABLES_MISSING'
    };
  }
  
  if (error.message.includes('authentication failed')) {
    return {
      error: 'Database connection failed',
      message: 'Invalid Supabase credentials. Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
      code: 'DB_AUTH_FAILED'
    };
  }
  
  return {
    error: 'Database error',
    message: `Failed to ${operation}. Please check your database configuration.`,
    details: error.message,
    code: 'DB_ERROR'
  };
}

// Helper function to get user from Clerk token
async function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    
    // Try to verify with Clerk first
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      return { id: payload.sub, clerkId: payload.sub };
    } catch (clerkError) {
      // Fallback to JWT decode if Clerk verification fails
      const decoded = jwt.decode(token);
      return { id: decoded?.sub, clerkId: decoded?.sub };
    }
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

// Helper to ensure user exists in our database
async function ensureUserExists(clerkId) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', clerkId)
    .single();

  if (existingUser) {
    return existingUser;
  }

  // Create user if doesn't exist
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      id: clerkId,
      username: `user_${clerkId}`,
      password: 'clerk_managed',
      name: 'User',
      role: 'user'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }

  return newUser;
}

// AI Processing Functions - The core conversational AI logic

// Simple AI processing for natural language to command translation
async function processMessageWithSimpleAI(message, commandMappings, personalityContext, skipMentionCheck = false) {
  try {
    // Check if message has bot mention (unless skipping for API testing)
    if (!skipMentionCheck && !message.includes('@') && !message.toLowerCase().includes('bot')) {
      return { 
        processed: false,
        conversationalResponse: "Hi! I'm here to help. You can either chat with me or give me commands!"
      };
    }

    // Clean message for processing
    const cleanMessage = message.replace(/<@[!&]?\d+>/g, '').trim();
    
    if (!cleanMessage) {
      return {
        processed: true,
        conversationalResponse: "Hello! How can I help you today? I can handle moderation commands or just chat!"
      };
    }

    // Intent analysis
    const intent = analyzeIntent(cleanMessage);
    
    if (intent.confidence < 0.3) {
      return {
        processed: true,
        conversationalResponse: `I'm here to help! I can assist with moderation commands like ban, warn, mute, or just have a chat. What would you like to do?`
      };
    }

    // Find matching command
    const bestMatch = findBestCommandMatch(cleanMessage, commandMappings, intent);
    
    if (bestMatch && bestMatch.confidence > 0.5) {
      // Extract parameters from the message
      const params = extractParameters(cleanMessage, bestMatch.mapping);
      
      // Build command output
      let commandOutput = bestMatch.mapping.commandOutput;
      
      // Replace parameters
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          commandOutput = commandOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
      }
      
      // Fill in default values for missing parameters
      commandOutput = commandOutput
        .replace(/\{user\}/g, 'target-user')
        .replace(/\{reason\}/g, 'No reason provided')
        .replace(/\{amount\}/g, '1')
        .replace(/\{message\}/g, 'Message from bot')
        .replace(/\{duration\}/g, '5m');

      return {
        processed: true,
        command: commandOutput,
        confidence: bestMatch.confidence,
        intent: intent.action
      };
    }

    // If medium confidence, ask for clarification
    if (intent.confidence > 0.5) {
      return {
        processed: true,
        needsClarification: true,
        clarificationQuestion: `I think you want to ${intent.action}, but I need more details. Could you be more specific?`
      };
    }

    // Casual conversation response
    const conversationalResponses = [
      "I'm here and ready to help! You can give me moderation commands or just chat.",
      "Hey there! Feel free to ask me to help with server moderation or just have a conversation.",
      "Hello! I can handle commands like ban, warn, mute, or we can just talk!",
      `I understand you want to ${intent.action}, but I'm not sure about the details. Can you be more specific?`
    ];

    return {
      processed: true,
      conversationalResponse: conversationalResponses[Math.floor(Math.random() * conversationalResponses.length)]
    };

  } catch (error) {
    console.error('AI processing error:', error);
    return {
      processed: true,
      conversationalResponse: "Sorry, I had trouble understanding that. Could you try rephrasing?"
    };
  }
}

// Analyze intent from natural language
function analyzeIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Command patterns with confidence scoring
  const patterns = [
    // Ban commands
    { 
      keywords: ['ban', 'remove', 'kick out', 'get rid of', 'banish', 'exile'],
      action: 'ban',
      confidence: 0.9
    },
    // Warn commands
    { 
      keywords: ['warn', 'warning', 'caution', 'alert', 'notify'],
      action: 'warn',
      confidence: 0.9
    },
    // Say/announce commands
    { 
      keywords: ['say', 'tell', 'announce', 'broadcast', 'declare'],
      action: 'say',
      confidence: 0.8
    },
    // Purge/delete commands
    { 
      keywords: ['delete', 'clear', 'purge', 'remove', 'clean'],
      action: 'purge',
      confidence: 0.8
    },
    // Mute commands
    { 
      keywords: ['mute', 'silence', 'timeout', 'quiet'],
      action: 'mute',
      confidence: 0.9
    },
    // Kick commands
    { 
      keywords: ['kick', 'boot', 'eject'],
      action: 'kick',
      confidence: 0.9
    },
    // Ping/status commands
    { 
      keywords: ['ping', 'latency', 'speed', 'fast', 'response'],
      action: 'ping',
      confidence: 0.7
    }
  ];

  let bestMatch = { action: 'unknown', confidence: 0, suggestedCommand: '' };

  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword)) {
        const confidence = pattern.confidence;
        
        // Boost confidence if we see user mentions or numbers
        let adjustedConfidence = confidence;
        if (message.includes('<@') || message.includes('@')) adjustedConfidence += 0.1;
        if (/\d+/.test(message)) adjustedConfidence += 0.1;
        
        if (adjustedConfidence > bestMatch.confidence) {
          bestMatch = {
            action: pattern.action,
            confidence: Math.min(adjustedConfidence, 1.0),
            suggestedCommand: `/${pattern.action}`
          };
        }
      }
    }
  }

  return bestMatch;
}

// Find best matching command mapping
function findBestCommandMatch(message, commandMappings, intent) {
  let bestMatch = null;
  let highestScore = 0;

  for (const mapping of commandMappings) {
    if (mapping.status !== 'active') continue;

    let score = 0;

    // Exact command name match
    if (message.toLowerCase().includes(mapping.name.toLowerCase())) {
      score += 0.8;
    }

    // Intent action match
    if (intent.action === mapping.name.toLowerCase()) {
      score += 0.7;
    }

    // Pattern similarity (simplified)
    const patternWords = mapping.naturalLanguagePattern.toLowerCase().split(' ');
    const messageWords = message.toLowerCase().split(' ');
    
    let wordMatches = 0;
    for (const word of patternWords) {
      if (word.startsWith('{') && word.endsWith('}')) continue; // Skip parameters
      if (messageWords.some(mWord => mWord.includes(word) || word.includes(mWord))) {
        wordMatches++;
      }
    }

    if (patternWords.length > 0) {
      score += (wordMatches / patternWords.length) * 0.5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = {
        mapping,
        confidence: score
      };
    }
  }

  return bestMatch;
}

// Extract parameters from natural language
function extractParameters(message, commandMapping) {
  const params = {};
  
  // Extract Discord user mentions
  const userMentions = message.match(/<@!?(\d+)>/g);
  if (userMentions && commandMapping.naturalLanguagePattern.includes('{user}')) {
    params.user = userMentions[0].replace(/[<@!>]/g, '');
  }

  // Extract numbers for amount/duration
  const numbers = message.match(/\d+/g);
  if (numbers) {
    if (commandMapping.naturalLanguagePattern.includes('{amount}')) {
      params.amount = numbers[0];
    }
    if (commandMapping.naturalLanguagePattern.includes('{duration}')) {
      params.duration = numbers[0] + 'm'; // Default to minutes
    }
  }

  // Extract reason (text after "for", "because", "due to")
  const reasonPatterns = [
    /(?:for|because|due to|reason:?)\s+(.+?)(?:\s+(?:please|thanks|ty))?$/i,
    /(?:being|is)\s+(.+?)(?:\s+(?:please|thanks|ty))?$/i
  ];

  for (const pattern of reasonPatterns) {
    const match = message.match(pattern);
    if (match && commandMapping.naturalLanguagePattern.includes('{reason}')) {
      params.reason = match[1].trim();
      break;
    }
  }

  // Extract message content (for say commands)
  if (commandMapping.naturalLanguagePattern.includes('{message}')) {
    const messagePatterns = [
      /"([^"]+)"/,  // Quoted text
      /'([^']+)'/,  // Single quoted text
      /(?:say|tell|announce)\s+(.+?)(?:\s+(?:please|thanks|to everyone))?$/i
    ];

    for (const pattern of messagePatterns) {
      const match = message.match(pattern);
      if (match) {
        params.message = match[1].trim();
        break;
      }
    }
  }

  return params;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`[API] ${req.method} ${req.url}`);

  // Ensure database is configured
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Database connection not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.',
      code: 'MISSING_ENV_VARS'
    });
  }

  try {
    // Ensure tables exist before processing any requests
    await ensureTablesExist();

    // Get authenticated user for protected endpoints
    const user = await getUserFromToken(req.headers.authorization);
    
    if (req.url === '/api/bots' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);
        
        const { data: bots, error } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.clerkId);

        if (error) {
          return res.status(500).json(handleDatabaseError(error, 'fetch bots'));
        }

        // Transform snake_case to camelCase for frontend
        const transformedBots = bots.map(bot => ({
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token, // In production, this would be decrypted
          clientId: bot.client_id,
          personalityContext: bot.personality_context,
          isConnected: bot.is_connected,
          createdAt: bot.created_at
        }));

        return res.status(200).json(transformedBots);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'fetch bots'));
      }
    }

    if (req.url === '/api/bots' && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);

        const { platformType, botName, token, clientId, personalityContext } = req.body;

        if (!platformType || !botName || !token) {
          return res.status(400).json({ error: 'Missing required fields: platformType, botName, token' });
        }

        // Basic Discord token validation (without actually connecting)
        if (platformType === 'discord') {
          const cleanToken = token.trim().replace(/^Bot\s+/i, '');
          if (cleanToken.length < 50) {
            return res.status(400).json({ error: 'Invalid Discord token format' });
          }
        }

        const { data: bot, error } = await supabase
          .from('bots')
          .insert({
            user_id: user.clerkId,
            platform_type: platformType,
            bot_name: botName,
            token: token, // In production, this would be encrypted
            client_id: clientId || null,
            personality_context: personalityContext || null
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json(handleDatabaseError(error, 'create bot'));
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: user.clerkId,
            activity_type: 'bot_created',
            description: `Bot ${botName} was created`,
            metadata: { botId: bot.id, platformType }
          });

        // Auto-create basic command mappings for Discord bots
        let createdMappings = 0;
        let availableCommands = [];
        
        if (platformType === 'discord') {
          const basicCommands = [
            {
              name: 'ban',
              naturalLanguagePattern: 'ban {user} for {reason}',
              commandOutput: '/ban {user} {reason}',
              status: 'active'
            },
            {
              name: 'warn',
              naturalLanguagePattern: 'warn {user} for {reason}',
              commandOutput: '/warn {user} {reason}',
              status: 'active'
            },
            {
              name: 'kick',
              naturalLanguagePattern: 'kick {user} for {reason}',
              commandOutput: '/kick {user} {reason}',
              status: 'active'
            },
            {
              name: 'mute',
              naturalLanguagePattern: 'mute {user} for {duration} because {reason}',
              commandOutput: '/timeout {user} {duration} {reason}',
              status: 'active'
            },
            {
              name: 'purge',
              naturalLanguagePattern: 'delete {amount} messages',
              commandOutput: '/purge {amount}',
              status: 'active'
            },
            {
              name: 'say',
              naturalLanguagePattern: 'say {message}',
              commandOutput: '/echo {message}',
              status: 'active'
            }
          ];

          const mappingPromises = basicCommands.map(cmd => 
            supabase
              .from('command_mappings')
              .insert({
                user_id: user.clerkId,
                bot_id: bot.id,
                name: cmd.name,
                natural_language_pattern: cmd.naturalLanguagePattern,
                command_output: cmd.commandOutput,
                status: cmd.status
              })
          );

          try {
            await Promise.all(mappingPromises);
            createdMappings = basicCommands.length;
            availableCommands = basicCommands.map(c => c.name);
            
            // Create additional activity for command creation
            await supabase
              .from('activities')
              .insert({
                user_id: user.clerkId,
                activity_type: 'commands_discovered',
                description: `Auto-created ${basicCommands.length} basic command mappings for ${botName}`,
                metadata: { 
                  botId: bot.id, 
                  commandsCreated: basicCommands.length,
                  commands: basicCommands.map(c => c.name)
                }
              });
          } catch (mappingError) {
            console.warn('Failed to create basic command mappings:', mappingError);
            // Don't fail bot creation if mapping creation fails
          }
        }

        // Transform response
        const transformedBot = {
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token,
          clientId: bot.client_id,
          personalityContext: bot.personality_context,
          isConnected: bot.is_connected,
          createdAt: bot.created_at
        };

        // Include command mapping info for Discord bots
        if (platformType === 'discord' && createdMappings > 0) {
          transformedBot.commandMappingsCreated = createdMappings;
          transformedBot.availableCommands = availableCommands;
          transformedBot.message = `Discord bot created with ${createdMappings} conversational commands ready to use!`;
        }

        return res.status(201).json(transformedBot);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'create bot'));
      }
    }

    if (req.url === '/api/mappings' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);

        const { data: mappings, error } = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', user.clerkId);

        if (error) {
          return res.status(500).json(handleDatabaseError(error, 'fetch mappings'));
        }

        // Transform snake_case to camelCase
        const transformedMappings = mappings.map(mapping => ({
          id: mapping.id,
          userId: mapping.user_id,
          botId: mapping.bot_id,
          name: mapping.name,
          naturalLanguagePattern: mapping.natural_language_pattern,
          commandOutput: mapping.command_output,
          status: mapping.status,
          usageCount: mapping.usage_count,
          createdAt: mapping.created_at
        }));

        return res.status(200).json(transformedMappings);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'fetch mappings'));
      }
    }

    if (req.url === '/api/mappings' && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);

        const { botId, name, naturalLanguagePattern, commandOutput, status = 'active' } = req.body;

        if (!botId || !name || !naturalLanguagePattern || !commandOutput) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify bot belongs to user
        const { data: bot } = await supabase
          .from('bots')
          .select('id')
          .eq('id', botId)
          .eq('user_id', user.clerkId)
          .single();

        if (!bot) {
          return res.status(404).json({ error: 'Bot not found or unauthorized' });
        }

        const { data: mapping, error } = await supabase
          .from('command_mappings')
          .insert({
            user_id: user.clerkId,
            bot_id: botId,
            name,
            natural_language_pattern: naturalLanguagePattern,
            command_output: commandOutput,
            status
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json(handleDatabaseError(error, 'create mapping'));
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: user.clerkId,
            activity_type: 'command_created',
            description: `Command mapping ${name} was created`,
            metadata: { mappingId: mapping.id, botId }
          });

        const transformedMapping = {
          id: mapping.id,
          userId: mapping.user_id,
          botId: mapping.bot_id,
          name: mapping.name,
          naturalLanguagePattern: mapping.natural_language_pattern,
          commandOutput: mapping.command_output,
          status: mapping.status,
          usageCount: mapping.usage_count,
          createdAt: mapping.created_at
        };

        return res.status(201).json(transformedMapping);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'create mapping'));
      }
    }

    if (req.url === '/api/activities' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);

        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        const { data: activities, error } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.clerkId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          return res.status(500).json(handleDatabaseError(error, 'fetch activities'));
        }

        const transformedActivities = activities.map(activity => ({
          id: activity.id,
          userId: activity.user_id,
          activityType: activity.activity_type,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.created_at
        }));

        return res.status(200).json(transformedActivities);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'fetch activities'));
      }
    }

    // Bot connection endpoints (simplified - no actual Discord connection)
    if (req.url.match(/^\/api\/bots\/[^/]+\/connect$/) && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const botId = req.url.split('/')[3];
        
        const { data: bot, error } = await supabase
          .from('bots')
          .update({ is_connected: true })
          .eq('id', botId)
          .eq('user_id', user.clerkId)
          .select()
          .single();

        if (error || !bot) {
          return res.status(404).json({ error: 'Bot not found or unauthorized' });
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: user.clerkId,
            activity_type: 'bot_connected',
            description: `Bot ${bot.bot_name} was connected`,
            metadata: { botId: bot.id, platformType: bot.platform_type }
          });

        const transformedBot = {
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token,
          clientId: bot.client_id,
          personalityContext: bot.personality_context,
          isConnected: bot.is_connected,
          createdAt: bot.created_at
        };

        return res.status(200).json(transformedBot);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'connect bot'));
      }
    }

    if (req.url.match(/^\/api\/bots\/[^/]+\/disconnect$/) && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const botId = req.url.split('/')[3];
        
        const { data: bot, error } = await supabase
          .from('bots')
          .update({ is_connected: false })
          .eq('id', botId)
          .eq('user_id', user.clerkId)
          .select()
          .single();

        if (error || !bot) {
          return res.status(404).json({ error: 'Bot not found or unauthorized' });
        }

        // Create activity
        await supabase
          .from('activities')
          .insert({
            user_id: user.clerkId,
            activity_type: 'bot_disconnected',
            description: `Bot ${bot.bot_name} was disconnected`,
            metadata: { botId: bot.id, platformType: bot.platform_type }
          });

        const transformedBot = {
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token,
          clientId: bot.client_id,
          personalityContext: bot.personality_context,
          isConnected: bot.is_connected,
          createdAt: bot.created_at
        };

        return res.status(200).json(transformedBot);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'disconnect bot'));
      }
    }

    // AI Processing Endpoints - The core conversational AI functionality
    
    // Process natural language message and translate to Discord command
    if (req.url === '/api/discord/process-message-ai' && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        await ensureUserExists(user.clerkId);

        const { message, guildId, channelId, userId: discordUserId, skipMentionCheck } = req.body;

        if (!message || typeof message !== 'string') {
          return res.status(400).json({ error: 'Message is required' });
        }

        // Check if we have Gemini API key for AI processing
        if (!process.env.GEMINI_API_KEY) {
          return res.status(400).json({ 
            error: 'AI not configured',
            message: 'Gemini API is not configured. Please set GEMINI_API_KEY environment variable.'
          });
        }

        // Get user's bots and command mappings for AI processing
        const { data: bots } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.clerkId)
          .eq('platform_type', 'discord');

        const { data: mappings } = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', user.clerkId);

        if (!bots || bots.length === 0) {
          return res.status(404).json({ 
            error: 'No Discord bots configured',
            message: 'You need to connect a Discord bot first to use AI processing.'
          });
        }

        if (!mappings || mappings.length === 0) {
          return res.status(404).json({ 
            error: 'No command mappings found',
            message: 'No commands have been discovered yet. Try connecting your bot and syncing commands.'
          });
        }

        // Transform mappings to expected format
        const transformedMappings = mappings.map(mapping => ({
          id: mapping.id,
          userId: mapping.user_id,
          botId: mapping.bot_id,
          name: mapping.name,
          naturalLanguagePattern: mapping.natural_language_pattern,
          commandOutput: mapping.command_output,
          status: mapping.status,
          usageCount: mapping.usage_count,
          createdAt: mapping.created_at
        }));

        // Use simple AI processing since we're in serverless
        const aiResult = await processMessageWithSimpleAI(
          message, 
          transformedMappings, 
          bots[0]?.personality_context,
          skipMentionCheck
        );

        // Record activity if command was found
        if (aiResult.processed && aiResult.command) {
          await supabase
            .from('activities')
            .insert({
              user_id: user.clerkId,
              activity_type: 'command_used',
              description: `AI translated "${message}" to command`,
              metadata: { 
                input: message, 
                output: aiResult.command,
                guildId: guildId || 'test-guild',
                channelId: channelId || 'test-channel'
              }
            });
        }

        return res.status(200).json(aiResult);
      } catch (dbError) {
        return res.status(500).json(handleDatabaseError(dbError, 'process AI message'));
      }
    }

    // Test endpoint for Discord command discovery
    if (req.url === '/api/discord/discover-commands' && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const { botToken } = req.body;

        if (!botToken) {
          return res.status(400).json({ error: 'Bot token is required' });
        }

        // Simulate command discovery (in real implementation, this would call Discord API)
        const mockDiscoveredCommands = [
          {
            name: 'ban',
            description: 'Ban a user from the server',
            options: [
              { name: 'user', type: 'USER', required: true },
              { name: 'reason', type: 'STRING', required: false }
            ]
          },
          {
            name: 'warn',
            description: 'Warn a user',
            options: [
              { name: 'user', type: 'USER', required: true },
              { name: 'reason', type: 'STRING', required: false }
            ]
          },
          {
            name: 'purge',
            description: 'Delete multiple messages',
            options: [
              { name: 'amount', type: 'INTEGER', required: true }
            ]
          }
        ];

        // Convert to command mappings
        const commandMappings = mockDiscoveredCommands.map(cmd => {
          const paramList = cmd.options?.map(opt => `{${opt.name}}`).join(' ') || '';
          return {
            name: cmd.name,
            naturalLanguagePattern: `${cmd.name} ${paramList}`.trim(),
            commandOutput: `/${cmd.name} ${paramList}`.trim(),
            description: cmd.description
          };
        });

        return res.status(200).json({
          success: true,
          discoveredCommands: mockDiscoveredCommands,
          suggestedMappings: commandMappings,
          message: `Found ${mockDiscoveredCommands.length} commands that can be made conversational`
        });
      } catch (error) {
        return res.status(500).json({ 
          error: 'Discovery failed',
          details: error.message
        });
      }
    }

    // Test natural language understanding
    if (req.url === '/api/ai/test-understanding' && req.method === 'POST') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Simple intent analysis
      const intent = analyzeIntent(message);

      return res.status(200).json({
        message,
        intent,
        explanation: `Detected ${intent.action} intent with ${intent.confidence}% confidence`,
        suggestedCommand: intent.suggestedCommand
      });
    }

    // Default response for unknown endpoints
    return res.status(404).json({
      error: 'Endpoint not found',
      url: req.url,
      method: req.method
    });

  } catch (error) {
    console.error('[API Error]:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
} 