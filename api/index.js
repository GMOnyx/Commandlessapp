const { createClient } = require('@supabase/supabase-js');

require('dotenv/config');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get user from any token (simplified for demo)
async function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    
    // For demo purposes, just extract a mock user ID from any JWT-like token
    // In production, this would properly verify the Clerk token
    if (token.includes('.')) {
      // It's a JWT-like token, extract payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          return { 
            id: payload.sub || 'demo_user', 
            clerkId: payload.sub || 'demo_user' 
          };
        } catch (e) {
          // If JWT parsing fails, use a demo user
          return { id: 'demo_user', clerkId: 'demo_user' };
        }
      }
    }
    
    // Fallback for any token
    return { id: 'demo_user', clerkId: 'demo_user' };
  } catch (error) {
    console.error('Error decoding token:', error);
    return { id: 'demo_user', clerkId: 'demo_user' };
  }
}

// Helper to check if tables exist
async function checkDatabaseSetup() {
  try {
    // Try to query each table to see if it exists
    const tableChecks = await Promise.allSettled([
      supabase.from('users').select('id').limit(1),
      supabase.from('bots').select('id').limit(1),
      supabase.from('command_mappings').select('id').limit(1),
      supabase.from('activities').select('id').limit(1)
    ]);

    const results = {
      users: tableChecks[0].status === 'fulfilled',
      bots: tableChecks[1].status === 'fulfilled',
      command_mappings: tableChecks[2].status === 'fulfilled',
      activities: tableChecks[3].status === 'fulfilled'
    };

    const allTablesExist = Object.values(results).every(exists => exists);
    
    return {
      allTablesExist,
      tableStatus: results
    };
  } catch (error) {
    return {
      allTablesExist: false,
      error: error.message
    };
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
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
          hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
          hasGeminiKey: !!process.env.GEMINI_API_KEY
        },
        user: user ? { id: user.id } : null,
        timestamp: new Date().toISOString()
      });
    }
    
    // Basic endpoints that return empty arrays for now (since tables exist but might be empty)
    if (req.url === '/api/bots' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const { data: bots, error } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.clerkId);

        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            error: 'Database query failed',
            message: 'Could not fetch bots from database',
            details: error.message,
            code: 'DB_QUERY_ERROR'
          });
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
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
          error: 'Unexpected error',
          details: error.message
        });
      }
    }

    if (req.url === '/api/mappings' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const { data: mappings, error } = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', user.clerkId);

        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            error: 'Database query failed',
            message: 'Could not fetch command mappings from database',
            details: error.message,
            code: 'DB_QUERY_ERROR'
          });
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
      } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
          error: 'Unexpected error',
          details: error.message
        });
      }
    }

    if (req.url === '/api/activities' && req.method === 'GET') {
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        const { data: activities, error } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.clerkId)
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
          details: error.message
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