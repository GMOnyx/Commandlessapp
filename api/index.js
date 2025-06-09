const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('@clerk/backend');
const jwt = require('jsonwebtoken');

require('dotenv/config');

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
      console.log('📝 Database tables not found, they may need to be created manually');
    }
  } catch (error) {
    console.warn('Could not verify database tables:', error.message);
  }
  
  tablesSetupAttempted = true;
}

// Helper function to handle database errors gracefully
function handleDatabaseError(error, operation) {
  console.error(`Database error during ${operation}:`, error);
  
  if (error.message.includes('does not exist')) {
    return {
      error: 'Database not configured',
      message: 'Database tables are missing. Please set up your Supabase database first.',
      details: 'Create tables manually in Supabase SQL Editor using the schema',
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
    if (process.env.CLERK_SECRET_KEY) {
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
    } else {
      // No Clerk secret, just decode
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

module.exports = async function handler(req, res) {
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
    
    // Basic endpoints that return empty arrays for now
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
        const transformedBots = (bots || []).map(bot => ({
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token,
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
        const transformedMappings = (mappings || []).map(mapping => ({
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

        const transformedActivities = (activities || []).map(activity => ({
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
}; 