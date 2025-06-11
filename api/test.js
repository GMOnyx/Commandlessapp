module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`[TEST] ${req.method} ${req.url}`);

  try {
    return res.status(200).json({
      message: 'Test endpoint working',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      }
    });
  } catch (error) {
    console.error('[TEST ERROR]', error);
    return res.status(500).json({
      error: 'Test endpoint failed',
      message: error.message
    });
  }
}; 