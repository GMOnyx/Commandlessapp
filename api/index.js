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