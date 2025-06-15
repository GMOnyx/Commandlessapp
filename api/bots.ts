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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (req.method === 'GET') {
      console.log('Getting bots for user:', user.id);
      
      // First, ensure the user exists in our database
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (userError && userError.code === 'PGRST116') {
        // User doesn't exist, create them
        console.log('Creating new user record for:', user.id);
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            username: user.id, // Use Clerk ID as username for now
            name: user.id, // Use Clerk ID as name for now
            role: 'user'
          });
        
        if (createError) {
          console.error('Failed to create user:', createError);
          return res.status(500).json({ error: 'Failed to create user record' });
        }
      }

      // Get real bot connections from Supabase
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
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch bot connections' });
      }

      console.log('Found bots:', bots?.length || 0);

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
      
      return res.status(200).json(connections);
    }

    if (req.method === 'POST') {
      // Handle new bot connection
      const { name, type, token: botToken, clientId, personalityContext } = req.body;
      
      // Basic validation
      if (!name || !type || !botToken) {
        return res.status(400).json({ error: 'Missing required fields: name, type, and token' });
      }

      // Validate bot token by making a test API call
      let isConnected = false;
      try {
        if (type === 'discord') {
          // Test Discord bot token
          const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
              'Authorization': `Bot ${botToken}`,
            },
          });
          
          if (response.ok) {
            isConnected = true;
          } else {
            return res.status(400).json({ error: 'Invalid Discord bot token' });
          }
        } else if (type === 'telegram') {
          // Test Telegram bot token
          const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const data = await response.json();
          
          if (data.ok) {
            isConnected = true;
          } else {
            return res.status(400).json({ error: 'Invalid Telegram bot token' });
          }
        } else {
          return res.status(400).json({ error: 'Unsupported bot type' });
        }
      } catch (error) {
        console.error('Bot token validation error:', error);
        return res.status(400).json({ error: 'Failed to validate bot token' });
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
    console.error('Bot connections API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 