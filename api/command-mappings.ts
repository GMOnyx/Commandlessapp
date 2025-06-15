import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';

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
      // Return mock command mappings
      const mappings = [
        {
          id: '1',
          botId: '1',
          intent: 'ban_user',
          command: '/ban',
          description: 'Ban a user from the server',
          parameters: ['user', 'reason'],
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          botId: '1',
          intent: 'kick_user',
          command: '/kick',
          description: 'Kick a user from the server',
          parameters: ['user', 'reason'],
          createdAt: new Date().toISOString()
        }
      ];
      
      return res.status(200).json(mappings);
    }

    if (req.method === 'POST') {
      // Handle new command mapping
      const { botId, intent, command, description, parameters } = req.body;
      
      if (!botId || !intent || !command) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newMapping = {
        id: Date.now().toString(),
        botId,
        intent,
        command,
        description: description || '',
        parameters: parameters || [],
        createdAt: new Date().toISOString()
      };

      return res.status(201).json(newMapping);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Command mappings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 