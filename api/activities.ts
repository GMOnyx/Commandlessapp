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
      console.log('Getting activities for user:', user.id);
      
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
            username: user.id,
            name: user.id,
            role: 'user'
          });
        
        if (createError) {
          console.error('Failed to create user:', createError);
          return res.status(500).json({ error: 'Failed to create user record' });
        }
      }

      // Get real activities from Supabase
      const { data: activities, error } = await supabase
        .from('activities')
        .select(`
          id,
          activity_type,
          description,
          metadata,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to most recent 50 activities

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Failed to fetch activities' });
      }

      console.log('Found activities:', activities?.length || 0);

      // Transform to match frontend expectations
      const activityFeed = activities?.map(activity => ({
        id: activity.id,
        activityType: activity.activity_type,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.created_at
      })) || [];
      
      return res.status(200).json(activityFeed);
    }

    if (req.method === 'POST') {
      // Handle new activity log
      const { activityType, description, metadata } = req.body;
      
      // Basic validation
      if (!activityType || !description) {
        return res.status(400).json({ 
          error: 'Missing required fields: activityType and description' 
        });
      }

      // Insert new activity into database
      const { data: newActivity, error: insertError } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          activity_type: activityType,
          description,
          metadata: metadata || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return res.status(500).json({ error: 'Failed to save activity' });
      }

      // Return the created activity
      const responseActivity = {
        id: newActivity.id,
        activityType: newActivity.activity_type,
        description: newActivity.description,
        metadata: newActivity.metadata,
        createdAt: newActivity.created_at
      };

      return res.status(201).json(responseActivity);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Activities API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 