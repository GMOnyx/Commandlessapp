import { type VercelRequest, type VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { botToken } = req.body;
    
    if (!botToken) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Token is required' 
      });
    }

    // Clean the token
    const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');

    // Basic format validation
    if (cleanToken.length < 50) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Token appears too short. Discord bot tokens are typically 59+ characters.' 
      });
    }

    if (!/^[A-Za-z0-9._-]+$/.test(cleanToken)) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Token contains invalid characters. Only letters, numbers, dots, underscores, and hyphens are allowed.' 
      });
    }

    // Try to validate with Discord API
    const response = await fetch('https://discord.com/api/v10/applications/@me', {
      headers: {
        'Authorization': `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let message = 'Invalid Discord bot token';
      if (response.status === 401) {
        message = 'Invalid Discord bot token. Please check that you copied the token correctly from the Discord Developer Portal.';
      } else if (response.status === 403) {
        message = 'Discord bot token lacks required permissions. Ensure the bot has "bot" and "applications.commands" scopes.';
      } else if (response.status === 429) {
        message = 'Too many requests to Discord API. Please wait a moment and try again.';
      }
      
      return res.status(200).json({ 
        valid: false, 
        message 
      });
    }

    const application = await response.json();

    return res.status(200).json({
      valid: true,
      message: `✅ Token is valid! Bot: ${application.name}`,
      botInfo: {
        id: application.id,
        name: application.name,
        description: application.description,
        avatar: application.icon ? `https://cdn.discordapp.com/app-icons/${application.id}/${application.icon}.png` : null
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(200).json({ 
      valid: false, 
      message: 'Error validating token' 
    });
  }
} 