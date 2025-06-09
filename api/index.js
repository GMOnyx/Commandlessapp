import 'dotenv/config';

// Helper function to parse request body
async function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET') {
      resolve({});
      return;
    }
    
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Log the request for debugging
  console.log(`[API] ${req.method} ${req.url}`);
  
  // Parse request body for POST requests
  const body = await parseBody(req);
  console.log('[API] Request body:', body);
  
  // TEMPORARILY SKIP AUTHENTICATION TO TEST
  // TODO: Re-enable authentication once we confirm this fixes the issue
  
  // Handle various Discord token validation endpoints
  if (req.method === 'POST' && (
    req.url === '/api/discord/validate-token' ||
    req.url === '/api/bots/validate' ||
    req.url === '/api/validate-token' ||
    req.url.includes('validate')
  )) {
    console.log('[API] Validating Discord token (accepting all tokens for testing)');
    return res.status(200).json({ 
      valid: true, 
      botName: body.botName || 'Test Bot',
      message: 'Token is valid' 
    });
  }
  
  // Handle bot creation
  if (req.method === 'POST' && req.url === '/api/bots') {
    console.log('[API] Creating new bot', body);
    // Return a mock successful bot creation
    const mockBot = {
      id: 'bot_' + Date.now(),
      userId: 'user_123',
      platformType: body.platformType || 'discord',
      botName: body.botName || 'Test Bot',
      token: body.token || '',
      isConnected: false,
      createdAt: new Date().toISOString()
    };
    return res.status(201).json(mockBot);
  }
  
  // Handle bot connection
  if (req.method === 'POST' && req.url.startsWith('/api/bots/') && req.url.endsWith('/connect')) {
    console.log('[API] Connecting bot');
    return res.status(200).json({ success: true, message: 'Bot connected successfully' });
  }
  
  // Handle bot disconnection  
  if (req.method === 'POST' && req.url.startsWith('/api/bots/') && req.url.endsWith('/disconnect')) {
    console.log('[API] Disconnecting bot');
    return res.status(200).json({ success: true, message: 'Bot disconnected successfully' });
  }
  
  // Return empty arrays for dashboard endpoints
  if (req.url === '/api/bots') {
    console.log('[API] Returning empty bots array');
    return res.status(200).json([]);
  }
  
  if (req.url === '/api/mappings') {
    console.log('[API] Returning empty mappings array');
    return res.status(200).json([]);
  }
  
  if (req.url === '/api/activities') {
    console.log('[API] Returning empty activities array');
    return res.status(200).json([]);
  }
  
  // Default response
  console.log(`[API] Unknown endpoint: ${req.url}`);
  return res.status(404).json({
    error: 'Endpoint not found',
    url: req.url,
    method: req.method
  });
} 