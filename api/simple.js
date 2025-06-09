module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`[API] ${req.method} ${req.url}`);

  try {
    if (req.url === '/api/simple' && req.method === 'GET') {
      return res.status(200).json({
        message: 'Simple API working',
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
          hasClerkSecret: !!process.env.CLERK_SECRET_KEY
        }
      });
    }

    if (req.url === '/api/bots' && req.method === 'GET') {
      return res.status(200).json([]);
    }

    if (req.url === '/api/mappings' && req.method === 'GET') {
      return res.status(200).json([]);
    }

    if (req.url === '/api/activities' && req.method === 'GET') {
      return res.status(200).json([]);
    }

    return res.status(404).json({
      error: 'Endpoint not found',
      url: req.url,
      method: req.method
    });

  } catch (error) {
    console.error('[API Error]:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}; 