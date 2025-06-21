import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to decode JWT and extract user ID
function decodeJWT(token: string): { userId: string } | null {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      // If it's not a JWT, treat it as a direct user ID (for backward compatibility)
      return { userId: token };
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Extract user ID from Clerk JWT payload
    const userId = payload.sub || payload.user_id || payload.id;
    
    if (!userId) {
      console.error('No user ID found in JWT payload:', payload);
      return null;
    }
    
    return { userId };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    // Fallback: treat the token as a direct user ID
    return { userId: token };
  }
}

export default async function handler(req: any, res: any) {
  // Universal CORS headers - accept custom domain or any Vercel URL
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && (
    origin === 'https://www.commandless.app' ||
    origin === 'https://commandless.app' ||
    origin === 'http://localhost:5173' ||
    origin.endsWith('.vercel.app')
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = decodeJWT(token);
  
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const userId = decodedToken.userId;

  try {
    // Ensure user exists in database (auto-create if needed)
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('User check error:', userError);
      return res.status(500).json({ error: 'User verification failed' });
    }

    if (!existingUser) {
      console.log('Creating new user record for:', userId);
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          username: userId,
          name: userId,
          role: 'user'
        });
      if (createError) {
        console.error('Failed to create user:', createError);
        return res.status(500).json({ error: 'Failed to create user record' });
      }
    }

    if (req.method === 'GET') {
      // Get all activities for the user
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { data: activities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        userId: activity.user_id,
        activityType: activity.activity_type,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.created_at
      }));

      return res.status(200).json(formattedActivities);
    }

    if (req.method === 'POST') {
      // Create new activity
      const { activityType, description, metadata } = req.body;
      
      if (!activityType || !description) {
        return res.status(400).json({ error: 'Missing required fields: activityType, description' });
      }

      const { data: newActivity, error } = await supabase
        .from('activities')
        .insert({
          user_id: userId,
          activity_type: activityType,
          description: description,
          metadata: metadata || {}
        })
        .select('*')
        .single();

      if (error) throw error;

      const formattedActivity = {
        id: newActivity.id,
        userId: newActivity.user_id,
        activityType: newActivity.activity_type,
        description: newActivity.description,
        metadata: newActivity.metadata,
        createdAt: newActivity.created_at
      };

      return res.status(201).json(formattedActivity);
    }

    return res.status(400).json({ error: 'Invalid request method' });

  } catch (error) {
    console.error('Activities API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 