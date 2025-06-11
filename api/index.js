const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

require('dotenv/config');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Convert Clerk user ID to UUID format for database compatibility
function clerkUserIdToUuid(clerkUserId) {
  // Create a deterministic UUID from the Clerk user ID using SHA-256
  const hash = crypto.createHash('sha256').update(clerkUserId).digest('hex');
  
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuid = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join('-');
  
  console.log(`[UUID] Converted Clerk ID ${clerkUserId} to UUID ${uuid}`);
  return uuid;
}

// Helper function to get user from any token (simplified for demo)
async function getUserFromToken(authHeader) {
  console.log('[AUTH] Processing auth header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'none');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] No Bearer token found');
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    console.log('[AUTH] Token length:', token.length);
    
    // For demo purposes, extract user ID from JWT-like token
    if (token.includes('.')) {
      console.log('[AUTH] JWT-like token detected, parsing...');
      // It's a JWT-like token, extract payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('[AUTH] JWT payload parsed:', { 
            sub: payload.sub, 
            exp: payload.exp ? new Date(payload.exp * 1000) : 'no exp',
            iss: payload.iss 
          });
          
          if (payload.sub) {
            // Convert Clerk user ID to UUID for database
            const dbUserId = clerkUserIdToUuid(payload.sub);
            return { 
              id: dbUserId, // UUID for database
              clerkId: payload.sub // Original Clerk ID for reference
            };
          } else {
            console.log('[AUTH] No sub claim in JWT');
            return null;
          }
        } catch (e) {
          console.log('[AUTH] JWT parsing failed:', e.message);
          return null;
        }
      }
    }
    
    // For any other token, return null (unauthorized)
    console.log('[AUTH] Not a valid JWT format');
    return null;
  } catch (error) {
    console.error('[AUTH] Error decoding token:', error);
    return null;
  }
}

// Helper to check if tables exist and their schema
async function checkDatabaseSetup() {
  try {
    // Try to query each table to see if it exists and get schema info
    const tableChecks = await Promise.allSettled([
      supabase.from('users').select('id').limit(1),
      supabase.from('bots').select('id, user_id').limit(1),
      supabase.from('command_mappings').select('id, user_id').limit(1),
      supabase.from('activities').select('id, user_id').limit(1)
    ]);

    const results = {
      users: tableChecks[0].status === 'fulfilled',
      bots: tableChecks[1].status === 'fulfilled',
      command_mappings: tableChecks[2].status === 'fulfilled',
      activities: tableChecks[3].status === 'fulfilled'
    };

    const allTablesExist = Object.values(results).every(exists => exists);
    
    // Try to get sample data to understand schema
    let schemaInfo = {};
    if (results.users) {
      const { data: sampleUser } = await supabase.from('users').select('id').limit(1);
      schemaInfo.userIdType = sampleUser && sampleUser[0] ? typeof sampleUser[0].id : 'unknown';
    }
    
    return {
      allTablesExist,
      tableStatus: results,
      schemaInfo
    };
  } catch (error) {
    return {
      allTablesExist: false,
      error: error.message
    };
  }
}

// Helper to find or create user
async function ensureUserExists(user) {
  if (!user || !user.id) {
    throw new Error('No user ID provided');
  }

  try {
    // Try to find existing user using UUID
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingUser) {
      console.log('[USER] Found existing user:', existingUser.id);
      return existingUser;
    }

    console.log('[USER] User not found, creating new user for UUID:', user.id, 'Clerk ID:', user.clerkId);
    // If user doesn't exist, create them
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: user.id, // UUID format
        username: user.clerkId || `user_${user.id.slice(-8)}`, // Store original Clerk ID or fallback
        password: 'clerk_managed',
        name: 'User',
        role: 'user'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log('[USER] Created new user:', newUser.id);
    return newUser;
  } catch (error) {
    throw new Error(`User management failed: ${error.message}`);
  }
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
  console.log(`[API] Headers:`, {
    authorization: req.headers.authorization ? `Bearer ${req.headers.authorization.substring(7, 20)}...` : 'none',
    contentType: req.headers['content-type'],
    origin: req.headers.origin
  });

  // Ensure database is configured
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Database connection not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.',
      code: 'MISSING_ENV_VARS'
    });
  }

  try {
    // Check database setup
    const dbSetup = await checkDatabaseSetup();
    
    if (!dbSetup.allTablesExist) {
      return res.status(500).json({
        error: 'Database not set up',
        message: 'Database tables are missing. Please create the required tables in your Supabase database.',
        details: 'Run the SQL from setup-database.sql in your Supabase SQL Editor',
        tableStatus: dbSetup.tableStatus,
        code: 'DB_TABLES_MISSING'
      });
    }

    // Get authenticated user for protected endpoints
    const user = await getUserFromToken(req.headers.authorization);
    
    // API Status endpoint for debugging
    if (req.url === '/api/status' && req.method === 'GET') {
      return res.status(200).json({
        status: 'API is working',
        database: dbSetup,
        authentication: {
          hasAuthHeader: !!req.headers.authorization,
          userAuthenticated: !!user,
          userId: user?.id || null
        },
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
          hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
          hasGeminiKey: !!process.env.GEMINI_API_KEY
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Endpoints that require authentication
    if (req.url === '/api/bots' && req.method === 'GET') {
      if (!user || !user.id) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Valid authorization token required',
          hint: 'Please log in with Clerk to access this resource',
          debug: {
            hasAuthHeader: !!req.headers.authorization,
            authHeaderFormat: req.headers.authorization ? 'Bearer token' : 'none',
            tokenParsed: !!user
          }
        });
      }

      try {
        // Ensure user exists in database
        await ensureUserExists(user);
        
        const { data: bots, error } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            error: 'Database query failed',
            message: 'Could not fetch bots from database',
            details: error.message,
            code: 'DB_QUERY_ERROR'
          });
        }

        console.log(`[API] Found ${bots.length} bots for user ${user.id}`);

        // Transform snake_case to camelCase for frontend
        const transformedBots = (bots || []).map(bot => ({
          id: bot.id,
          userId: bot.user_id,
          platformType: bot.platform_type,
          botName: bot.bot_name,
          token: bot.token ? '[HIDDEN]' : null, // Don't expose tokens
          clientId: bot.client_id,
          personalityContext: bot.personality_context,
          isConnected: bot.is_connected,
          createdAt: bot.created_at
        }));

        return res.status(200).json(transformedBots);
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
          error: 'Unexpected error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    if (req.url === '/api/mappings' && req.method === 'GET') {
      if (!user || !user.id) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Valid authorization token required',
          hint: 'Please log in with Clerk to access this resource',
          debug: {
            hasAuthHeader: !!req.headers.authorization,
            authHeaderFormat: req.headers.authorization ? 'Bearer token' : 'none',
            tokenParsed: !!user
          }
        });
      }

      try {
        // Ensure user exists in database
        await ensureUserExists(user);

        const { data: mappings, error } = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            error: 'Database query failed',
            message: 'Could not fetch command mappings from database',
            details: error.message,
            code: 'DB_QUERY_ERROR'
          });
        }

        console.log(`[API] Found ${mappings.length} command mappings for user ${user.id}`);

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
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
          error: 'Unexpected error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    if (req.url === '/api/activities' && req.method === 'GET') {
      if (!user || !user.id) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Valid authorization token required',
          hint: 'Please log in with Clerk to access this resource',
          debug: {
            hasAuthHeader: !!req.headers.authorization,
            authHeaderFormat: req.headers.authorization ? 'Bearer token' : 'none',
            tokenParsed: !!user
          }
        });
      }

      try {
        // Ensure user exists in database
        await ensureUserExists(user);

        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        const { data: activities, error } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            error: 'Database query failed',
            message: 'Could not fetch activities from database',
            details: error.message,
            code: 'DB_QUERY_ERROR'
          });
        }

        console.log(`[API] Found ${activities.length} activities for user ${user.id}`);

        const transformedActivities = (activities || []).map(activity => ({
          id: activity.id,
          userId: activity.user_id,
          activityType: activity.activity_type,
          description: activity.description,
          metadata: activity.metadata,
          createdAt: activity.created_at
        }));

        return res.status(200).json(transformedActivities);
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
          error: 'Unexpected error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Default response for unknown endpoints
    return res.status(404).json({
      error: 'Endpoint not found',
      url: req.url,
      method: req.method,
      availableEndpoints: ['/api/status', '/api/bots', '/api/mappings', '/api/activities']
    });

  } catch (error) {
    console.error('[API Error]:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}; 