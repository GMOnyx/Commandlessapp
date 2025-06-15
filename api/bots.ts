import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserFromToken(token: string) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    const sessionToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    if (sessionToken && sessionToken.sub) {
      return { 
        id: sessionToken.sub,
        clerkUserId: sessionToken.sub 
      };
    }
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🚀 Bots API handler called');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Environment check:');
  console.log('- CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);
  console.log('- SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
  console.log('- SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Starting authentication...');
    
    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header');
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    console.log('Token extracted, length:', token.length);
    
    const user = await getUserFromToken(token);
    console.log('User from token:', user);
    
    if (!user) {
      console.log('❌ Invalid token or user verification failed');
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('✅ User authenticated:', user.id);

    if (req.method === 'GET') {
      console.log('📝 Processing GET request for user:', user.id);
      
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      try {
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('❌ Supabase connection test failed:', testError);
          return res.status(500).json({ error: 'Database connection failed', details: testError.message });
        }
        console.log('✅ Supabase connection successful');
      } catch (err) {
        console.error('❌ Supabase connection exception:', err);
        return res.status(500).json({ error: 'Database connection exception', details: err.message });
      }
      
      // First, ensure the user exists in our database
      console.log('Checking if user exists in database...');
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (userError) {
        console.error('❌ User check error:', userError);
        return res.status(500).json({ error: 'User verification failed', details: userError.message });
      }

      if (!existingUser) {
        console.log('Creating new user record for:', user.id);
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            username: user.id,
            name: user.id,
            role: 'user'
          });
        if (createError) {
          console.error('❌ Failed to create user:', createError);
          return res.status(500).json({ error: 'Failed to create user record', details: createError.message });
        }
        console.log('✅ User created successfully');
      }

      // Get real bot connections from Supabase
      console.log('Fetching bots from database...');
      const { data: bots, error } = await supabase
        .from('bots')
        .select(`
          id,
          platform_type,
          bot_name,
          client_id,
          personality_context,
          is_connected,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch bot connections', details: error.message });
      }

      console.log('✅ Found bots:', bots?.length || 0);

      // Transform to match frontend expectations
      const connections = bots?.map(bot => ({
        id: bot.id,
        name: bot.bot_name,
        type: bot.platform_type,
        isConnected: bot.is_connected,
        clientId: bot.client_id,
        personalityContext: bot.personality_context,
        createdAt: bot.created_at
      })) || [];
      
      console.log('✅ Returning connections:', connections.length);
      return res.status(200).json(connections);
    }

    if (req.method === 'POST') {
      // Handle new bot connection
      const { name, type, token: botToken, clientId, personalityContext } = req.body;
      
      // Basic validation
      if (!name || !type || !botToken) {
        return res.status(400).json({ error: 'Missing required fields: name, type, and token' });
      }

      // Validate bot token – non-blocking. We still save the record; we just mark isConnected accordingly.
      let isConnected = false;
      try {
        if (type === 'discord') {
          const resp = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
              Authorization: `Bot ${botToken}`,
              'User-Agent': 'commandless/1.0 (+https://commandless.app)'
            }
          });
          if (resp.ok) {
            isConnected = true;
          } else {
            console.warn('Discord token validation failed – status', resp.status);
          }
        } else if (type === 'telegram') {
          const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const data = await resp.json();
          if (data.ok) {
            isConnected = true;
          } else {
            console.warn('Telegram token validation failed', data);
          }
        }
      } catch (err) {
        console.warn('Token validation network error (ignored):', err);
      }

      // Insert new bot connection into database
      const { data: newBot, error: insertError } = await supabase
        .from('bots')
        .insert({
          user_id: user.id,
          platform_type: type,
          bot_name: name,
          token: botToken, // Store encrypted in production
          client_id: clientId,
          personality_context: personalityContext,
          is_connected: isConnected,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save bot connection' });
      }

      // Log activity
      await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          activity_type: 'bot_connected',
          description: `Connected ${type} bot: ${name}`,
          metadata: { botId: newBot.id, botType: type }
        });

      // Return the created bot
      const responseBot = {
        id: newBot.id,
        name: newBot.bot_name,
        type: newBot.platform_type,
        isConnected: newBot.is_connected,
        clientId: newBot.client_id,
        personalityContext: newBot.personality_context,
        createdAt: newBot.created_at
      };

      return res.status(201).json(responseBot);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ Bot connections API error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 