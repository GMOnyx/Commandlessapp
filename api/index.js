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

// Comprehensive logging system
async function logToDatabase(level, category, message, metadata = {}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      message,
      metadata: JSON.stringify(metadata),
      created_at: timestamp
    };
    
    // Try to insert into logs table, create table if it doesn't exist
    const { error } = await supabase
      .from('debug_logs')
      .insert(logEntry);
    
    if (error && error.code === '42P01') {
      // Table doesn't exist, create it
      console.log('[LOG] Creating debug_logs table...');
      // We'll create it manually since we can't execute DDL from here
    }
    
    // Always log to console as backup
    console.log(`[${level.toUpperCase()}] [${category}] ${message}`, metadata);
  } catch (error) {
    console.error('[LOG ERROR]', error);
    console.log(`[${level.toUpperCase()}] [${category}] ${message}`, metadata);
  }
}

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
  
  logToDatabase('info', 'AUTH', `Converted Clerk ID to UUID`, { clerkUserId, uuid });
  return uuid;
}

// Helper function to get user from any token (simplified for demo)
async function getUserFromToken(authHeader) {
  logToDatabase('info', 'AUTH', 'Processing auth header', { 
    hasAuthHeader: !!authHeader,
    authHeaderPreview: authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'none'
  });
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logToDatabase('warn', 'AUTH', 'No Bearer token found');
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    logToDatabase('info', 'AUTH', 'Token extracted', { tokenLength: token.length });
    
    // For demo purposes, extract user ID from JWT-like token
    if (token.includes('.')) {
      logToDatabase('info', 'AUTH', 'JWT-like token detected, parsing...');
      // It's a JWT-like token, extract payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          logToDatabase('info', 'AUTH', 'JWT payload parsed', { 
            sub: payload.sub, 
            exp: payload.exp ? new Date(payload.exp * 1000) : 'no exp',
            iss: payload.iss 
          });
          
          if (payload.sub) {
            // Convert Clerk user ID to UUID for database
            const dbUserId = clerkUserIdToUuid(payload.sub);
            const user = { 
              id: dbUserId, // UUID for database
              clerkId: payload.sub // Original Clerk ID for reference
            };
            logToDatabase('info', 'AUTH', 'User authentication successful', user);
            return user;
          } else {
            logToDatabase('warn', 'AUTH', 'No sub claim in JWT');
            return null;
          }
        } catch (e) {
          logToDatabase('error', 'AUTH', 'JWT parsing failed', { error: e.message });
          return null;
        }
      }
    }
    
    // For any other token, return null (unauthorized)
    logToDatabase('warn', 'AUTH', 'Not a valid JWT format');
    return null;
  } catch (error) {
    logToDatabase('error', 'AUTH', 'Error decoding token', { error: error.message });
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

    // If user doesn't exist, create them
    console.log('[USER] User not found, creating new user for UUID:', user.id, 'Clerk ID:', user.clerkId);
    
    // Use upsert to handle race conditions
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .upsert({
        id: user.id, // UUID format
        username: user.clerkId || `user_${user.id.slice(-8)}`, // Store original Clerk ID or fallback
        password: 'clerk_managed',
        name: 'User',
        role: 'user'
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (createError) {
      // If it's a duplicate key error, try to fetch the existing user
      if (createError.code === '23505' || createError.message.includes('duplicate key')) {
        console.log('[USER] Duplicate key detected, fetching existing user');
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (existingUser) {
          return existingUser;
        }
      }
      
      console.error('Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log('[USER] Created new user:', newUser.id);
    return newUser;
  } catch (error) {
    throw new Error(`User management failed: ${error.message}`);
  }
}

// Main handler function
module.exports = async (req, res) => {
  const { method, url } = req;
  const startTime = Date.now();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Log all incoming requests
  await logToDatabase('info', 'REQUEST', `${method} ${url}`, {
    method,
    url,
    headers: req.headers,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  });

  try {
    // Logs viewer endpoint
    if (method === 'GET' && url === '/api/logs') {
      await logToDatabase('info', 'LOGS', 'Logs viewer accessed');
      
      try {
        // Get recent logs
        const { data: logs, error } = await supabase
          .from('debug_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) {
          await logToDatabase('error', 'LOGS', 'Failed to fetch logs', { error: error.message });
          
          // Return HTML page even if DB fails
          return res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Commandless Debug Logs</title>
              <style>
                body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
                .error { color: #ff6b6b; }
                .warn { color: #ffd93d; }
                .info { color: #74c0fc; }
                .debug { color: #b197fc; }
                .log-entry { margin: 10px 0; padding: 10px; border-left: 3px solid #555; background: #2a2a2a; }
                .timestamp { color: #888; }
                .category { font-weight: bold; }
                pre { background: #333; padding: 10px; overflow-x: auto; }
              </style>
            </head>
            <body>
              <h1>Commandless Debug Logs</h1>
              <div class="error">Failed to load logs from database: ${error.message}</div>
              <p>Check console logs or database directly.</p>
            </body>
            </html>
          `);
        }

        // Create HTML page with logs
        const logsHtml = logs?.map(log => {
          const metadata = log.metadata ? JSON.parse(log.metadata) : {};
          return `
            <div class="log-entry ${log.level}">
              <span class="timestamp">${log.timestamp}</span>
              <span class="category">[${log.category}]</span>
              <span class="level">[${log.level.toUpperCase()}]</span>
              <span class="message">${log.message}</span>
              ${Object.keys(metadata).length > 0 ? `<pre>${JSON.stringify(metadata, null, 2)}</pre>` : ''}
            </div>
          `;
        }).join('') || '<p>No logs found</p>';

        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Commandless Debug Logs</title>
            <style>
              body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
              .error { color: #ff6b6b; }
              .warn { color: #ffd93d; }
              .info { color: #74c0fc; }
              .debug { color: #b197fc; }
              .log-entry { margin: 10px 0; padding: 10px; border-left: 3px solid #555; background: #2a2a2a; }
              .timestamp { color: #888; }
              .category { font-weight: bold; }
              .message { margin-left: 10px; }
              pre { background: #333; padding: 10px; overflow-x: auto; margin-top: 10px; }
              .controls { margin: 20px 0; }
              button { background: #4c6ef5; color: white; border: none; padding: 10px 20px; cursor: pointer; margin-right: 10px; }
              button:hover { background: #364fc7; }
            </style>
            <script>
              function refreshLogs() {
                window.location.reload();
              }
              function clearLogs() {
                if (confirm('Clear all logs?')) {
                  fetch('/api/logs', { method: 'DELETE' })
                    .then(() => window.location.reload());
                }
              }
            </script>
          </head>
          <body>
            <h1>Commandless Debug Logs</h1>
            <div class="controls">
              <button onclick="refreshLogs()">Refresh</button>
              <button onclick="clearLogs()">Clear Logs</button>
              <span style="margin-left: 20px;">Total logs: ${logs?.length || 0}</span>
            </div>
            ${logsHtml}
          </body>
          </html>
        `);
      } catch (error) {
        await logToDatabase('error', 'LOGS', 'Logs viewer error', { error: error.message });
        return res.status(500).json({ error: 'Failed to load logs' });
      }
    }

    // Clear logs endpoint
    if (method === 'DELETE' && url === '/api/logs') {
      await logToDatabase('info', 'LOGS', 'Clearing logs');
      
      try {
        const { error } = await supabase
          .from('debug_logs')
          .delete()
          .neq('id', 'impossible'); // Delete all
          
        if (error) {
          await logToDatabase('error', 'LOGS', 'Failed to clear logs', { error: error.message });
          return res.status(500).json({ error: 'Failed to clear logs' });
        }
        
        await logToDatabase('info', 'LOGS', 'Logs cleared successfully');
        return res.status(200).json({ message: 'Logs cleared' });
      } catch (error) {
        await logToDatabase('error', 'LOGS', 'Error clearing logs', { error: error.message });
        return res.status(500).json({ error: 'Failed to clear logs' });
      }
    }

    // Client logs endpoint (for frontend logging)
    if (url === '/api/client-logs' && method === 'POST') {
      try {
        const logData = req.body;
        await logToDatabase('client', logData.category || 'FRONTEND', logData.message || 'Client log', {
          frontend_data: logData,
          timestamp: logData.timestamp,
          client_url: logData.url,
          user_agent: logData.userAgent
        });
        return res.status(200).json({ logged: true });
      } catch (error) {
        // Don't fail on logging errors
        return res.status(200).json({ logged: false, error: error.message });
      }
    }

    // Ensure debug_logs table exists
    async function ensureDebugLogsTable() {
      try {
        // Try to insert a test log to check if table exists
        const { error } = await supabase
          .from('debug_logs')
          .select('id')
          .limit(1);
        
        if (error && error.code === '42P01') {
          // Table doesn't exist, log this issue
          console.log('[INIT] debug_logs table does not exist - manual creation required');
          await logToDatabase('error', 'INIT', 'debug_logs table missing - requires manual creation in Supabase');
          return false;
        }
        
        await logToDatabase('info', 'INIT', 'debug_logs table is available');
        return true;
      } catch (error) {
        console.log('[INIT] Error checking debug_logs table:', error);
        return false;
      }
    }

    // Initialize logging table check
    await ensureDebugLogsTable();

    // Get user info from auth header
    const user = await getUserFromToken(req.headers.authorization);
    
    if (!user) {
      await logToDatabase('warn', 'AUTH', 'Unauthorized request', { url, method });
    } else {
      await logToDatabase('info', 'AUTH', 'Authenticated request', { userId: user.id, clerkId: user.clerkId, url, method });
    }

    // Health check endpoint
    if (method === 'GET' && url === '/api/health') {
      await logToDatabase('info', 'HEALTH', 'Health check requested');
      return res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    // API Status endpoint for debugging
    if (url === '/api/status' && method === 'GET') {
      await logToDatabase('info', 'STATUS', 'Status endpoint accessed');
      
      const dbSetup = await checkDatabaseSetup();
      const statusData = {
        status: 'API is working',
        database: dbSetup,
        authentication: {
          hasAuthHeader: !!req.headers.authorization,
          user: user ? { id: user.id, clerkId: user.clerkId } : null
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
        },
        timestamp: new Date().toISOString()
      };
      
      await logToDatabase('info', 'STATUS', 'Status response', statusData);
      return res.status(200).json(statusData);
    }

    // Protected endpoints that require authentication
    if (!user) {
      const protectedPaths = ['/api/bots', '/api/commands', '/api/activities'];
      const isProtectedPath = protectedPaths.some(path => url.startsWith(path));
      
      if (isProtectedPath) {
        await logToDatabase('warn', 'AUTH', 'Unauthorized access to protected endpoint', { url, method });
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Valid authentication token required',
          code: 'AUTH_REQUIRED'
        });
      }
    }

    // Discord token validation endpoint
    if (url === '/api/discord/validate-token' && method === 'POST') {
      await logToDatabase('info', 'DISCORD', 'Token validation requested', { userId: user?.id });
      
      try {
        const { token } = req.body || {};
        
        if (!token) {
          await logToDatabase('warn', 'DISCORD', 'No token provided for validation');
          return res.status(400).json({ 
            error: 'Token required',
            message: 'Discord bot token is required',
            code: 'TOKEN_MISSING'
          });
        }

        // Simple validation - just check if it looks like a Discord token
        const isValid = typeof token === 'string' && token.length > 50;
        const response = { 
          valid: isValid, 
          message: isValid ? 'Token format is valid' : 'Invalid token format' 
        };
        
        await logToDatabase('info', 'DISCORD', 'Token validation result', { valid: isValid, tokenLength: token.length });
        return res.status(200).json(response);
      } catch (error) {
        await logToDatabase('error', 'DISCORD', 'Token validation error', { error: error.message });
        return res.status(500).json({ 
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
    }

    // Bot connections endpoints
    if (url === '/api/bots' && method === 'GET') {
      await logToDatabase('info', 'BOTS', 'Fetching bot connections', { userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        const { data: bots, error } = await supabase
          .from('bots')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          await logToDatabase('error', 'BOTS', 'Failed to fetch bots', { error: error.message, userId: user.id });
          return res.status(500).json({ 
            error: 'Failed to fetch bots',
            message: error.message,
            code: 'DB_FETCH_ERROR'
          });
        }

        await logToDatabase('info', 'BOTS', 'Bots fetched successfully', { count: bots?.length || 0, userId: user.id });
        return res.status(200).json(bots || []);
      } catch (error) {
        await logToDatabase('error', 'BOTS', 'Error in GET /bots', { error: error.message, userId: user.id });
        return res.status(500).json({ 
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    if (url === '/api/bots' && method === 'POST') {
      await logToDatabase('info', 'BOTS', 'Creating new bot connection', { userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        const { name, token, description, platformType, botName, clientId, personalityContext } = req.body || {};
        
        // Support both new format (name, token) and old format (botName, platformType, etc.)
        const botData = {
          user_id: user.id,
          bot_name: botName || name,
          platform_type: platformType || 'discord',
          token: token,
          client_id: clientId || null,
          personality_context: personalityContext || description || null,
          is_connected: false,
          created_at: new Date().toISOString()
        };

        if (!botData.bot_name || !botData.token) {
          await logToDatabase('warn', 'BOTS', 'Missing required fields', { 
            hasBotName: !!botData.bot_name, 
            hasToken: !!botData.token 
          });
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'Bot name and token are required',
            code: 'MISSING_FIELDS'
          });
        }

        const { data: newBot, error } = await supabase
          .from('bots')
          .insert(botData)
          .select()
          .single();

        if (error) {
          await logToDatabase('error', 'BOTS', 'Failed to create bot', { 
            error: error.message, 
            botData: { bot_name: botData.bot_name, hasToken: !!botData.token } 
          });
          return res.status(500).json({
            error: 'Failed to create bot',
            message: error.message,
            code: 'DB_INSERT_ERROR'
          });
        }

        await logToDatabase('info', 'BOTS', 'Bot created successfully', { 
          botId: newBot.id, 
          botName: newBot.bot_name 
        });
        return res.status(201).json(newBot);
      } catch (error) {
        await logToDatabase('error', 'BOTS', 'Error in POST /bots', { error: error.message, userId: user.id });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Command mappings endpoints
    if (url === '/api/commands' && method === 'GET') {
      await logToDatabase('info', 'COMMANDS', 'Fetching command mappings', { userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        const { data: commands, error } = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          await logToDatabase('error', 'COMMANDS', 'Failed to fetch commands', { error: error.message, userId: user.id });
          return res.status(500).json({
            error: 'Failed to fetch commands',
            message: error.message,
            code: 'DB_FETCH_ERROR'
          });
        }

        await logToDatabase('info', 'COMMANDS', 'Commands fetched successfully', { count: commands?.length || 0, userId: user.id });
        return res.status(200).json(commands || []);
      } catch (error) {
        await logToDatabase('error', 'COMMANDS', 'Error in GET /commands', { error: error.message, userId: user.id });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    if (url === '/api/commands' && method === 'POST') {
      await logToDatabase('info', 'COMMANDS', 'Creating new command mapping', { userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        const { botId, name, naturalLanguagePattern, commandOutput } = req.body || {};
        
        if (!botId || !name || !naturalLanguagePattern || !commandOutput) {
          await logToDatabase('warn', 'COMMANDS', 'Missing required fields for command creation', { 
            hasBotId: !!botId,
            hasName: !!name,
            hasPattern: !!naturalLanguagePattern,
            hasOutput: !!commandOutput
          });
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'botId, name, naturalLanguagePattern, and commandOutput are required',
            code: 'MISSING_FIELDS'
          });
        }

        const commandData = {
          user_id: user.id,
          bot_id: botId,
          name,
          natural_language_pattern: naturalLanguagePattern,
          command_output: commandOutput,
          status: 'active',
          usage_count: 0,
          created_at: new Date().toISOString()
        };

        const { data: newCommand, error } = await supabase
          .from('command_mappings')
          .insert(commandData)
          .select()
          .single();

        if (error) {
          await logToDatabase('error', 'COMMANDS', 'Failed to create command', { 
            error: error.message, 
            commandData: { name, botId, hasPattern: !!naturalLanguagePattern } 
          });
          return res.status(500).json({
            error: 'Failed to create command',
            message: error.message,
            code: 'DB_INSERT_ERROR'
          });
        }

        await logToDatabase('info', 'COMMANDS', 'Command created successfully', { 
          commandId: newCommand.id, 
          name: newCommand.name,
          botId: newCommand.bot_id
        });
        return res.status(201).json(newCommand);
      } catch (error) {
        await logToDatabase('error', 'COMMANDS', 'Error in POST /commands', { error: error.message, userId: user.id });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Bot connect endpoint
    if (url.match(/^\/api\/bots\/[^\/]+\/connect$/) && method === 'POST') {
      const botId = url.split('/')[3]; // Extract bot ID from URL
      await logToDatabase('info', 'BOTS', 'Bot connect requested', { botId, userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        // Get the bot first to verify ownership
        const { data: bot, error: fetchError } = await supabase
          .from('bots')
          .select('*')
          .eq('id', botId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !bot) {
          await logToDatabase('warn', 'BOTS', 'Bot not found for connect', { botId, userId: user.id, error: fetchError?.message });
          return res.status(404).json({
            error: 'Bot not found',
            message: 'Bot not found or you do not have access to it',
            code: 'BOT_NOT_FOUND'
          });
        }

        // Update bot connection status
        const { data: updatedBot, error: updateError } = await supabase
          .from('bots')
          .update({ 
            is_connected: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', botId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          await logToDatabase('error', 'BOTS', 'Failed to update bot connection status', { 
            botId, 
            userId: user.id, 
            error: updateError.message 
          });
          return res.status(500).json({
            error: 'Failed to connect bot',
            message: updateError.message,
            code: 'DB_UPDATE_ERROR'
          });
        }

        await logToDatabase('info', 'BOTS', 'Bot connected successfully', { 
          botId, 
          botName: bot.bot_name, 
          userId: user.id 
        });

        return res.status(200).json(updatedBot);
      } catch (error) {
        await logToDatabase('error', 'BOTS', 'Error in bot connect', { 
          botId, 
          userId: user.id, 
          error: error.message 
        });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Bot disconnect endpoint
    if (url.match(/^\/api\/bots\/[^\/]+\/disconnect$/) && method === 'POST') {
      const botId = url.split('/')[3]; // Extract bot ID from URL
      await logToDatabase('info', 'BOTS', 'Bot disconnect requested', { botId, userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        // Get the bot first to verify ownership
        const { data: bot, error: fetchError } = await supabase
          .from('bots')
          .select('*')
          .eq('id', botId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !bot) {
          await logToDatabase('warn', 'BOTS', 'Bot not found for disconnect', { botId, userId: user.id, error: fetchError?.message });
          return res.status(404).json({
            error: 'Bot not found',
            message: 'Bot not found or you do not have access to it',
            code: 'BOT_NOT_FOUND'
          });
        }

        // Update bot connection status
        const { data: updatedBot, error: updateError } = await supabase
          .from('bots')
          .update({ 
            is_connected: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', botId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          await logToDatabase('error', 'BOTS', 'Failed to update bot disconnection status', { 
            botId, 
            userId: user.id, 
            error: updateError.message 
          });
          return res.status(500).json({
            error: 'Failed to disconnect bot',
            message: updateError.message,
            code: 'DB_UPDATE_ERROR'
          });
        }

        await logToDatabase('info', 'BOTS', 'Bot disconnected successfully', { 
          botId, 
          botName: bot.bot_name, 
          userId: user.id 
        });

        return res.status(200).json(updatedBot);
      } catch (error) {
        await logToDatabase('error', 'BOTS', 'Error in bot disconnect', { 
          botId, 
          userId: user.id, 
          error: error.message 
        });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Activity data endpoint
    if (url === '/api/activities' && method === 'GET') {
      await logToDatabase('info', 'ACTIVITIES', 'Fetching activity data', { userId: user.id });
      
      try {
        await ensureUserExists(user);
        
        // Mock activity data for now
        const mockActivities = [
          { date: '2024-01-15', count: 12 },
          { date: '2024-01-16', count: 8 },
          { date: '2024-01-17', count: 15 },
          { date: '2024-01-18', count: 6 },
          { date: '2024-01-19', count: 22 }
        ];

        await logToDatabase('info', 'ACTIVITIES', 'Activity data returned (mock)', { count: mockActivities.length, userId: user.id });
        return res.status(200).json(mockActivities);
      } catch (error) {
        await logToDatabase('error', 'ACTIVITIES', 'Error in GET /activities', { error: error.message, userId: user.id });
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    }

    // Default 404 response
    await logToDatabase('warn', 'REQUEST', 'Endpoint not found', { url, method });
    return res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${method} ${url} not found`,
      code: 'ENDPOINT_NOT_FOUND'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    await logToDatabase('error', 'REQUEST', 'Unhandled error in request handler', { 
      error: error.message, 
      stack: error.stack,
      url, 
      method, 
      duration 
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
}; 