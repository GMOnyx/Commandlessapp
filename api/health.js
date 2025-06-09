export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const envCheck = {
    nodeVersion: process.version,
    platform: process.platform,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
    timestamp: new Date().toISOString()
  };

  return res.status(200).json({
    status: 'healthy',
    message: 'API is working',
    environment: envCheck,
    url: req.url,
    method: req.method
  });
} 