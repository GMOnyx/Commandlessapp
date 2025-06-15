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
      // Return mock data for now - replace with real data later
      const connections = [
        {
          id: '1',
          name: 'My Discord Bot',
          type: 'discord',
          status: 'connected',
          createdAt: new Date().toISOString()
        }
      ];
      
      return res.status(200).json(connections);
    }

    if (req.method === 'POST') {
      // Handle new bot connection
      const { name, type, token: botToken } = req.body;
      
      // Basic validation
      if (!name || !type || !botToken) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create new connection (mock for now)
      const newConnection = {
        id: Date.now().toString(),
        name,
        type,
        status: 'connected',
        createdAt: new Date().toISOString()
      };

      return res.status(201).json(newConnection);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Bot connections API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 