import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Debug endpoint called');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Environment variables check:');
    console.log('- CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);
    console.log('- SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
    console.log('- SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
    console.log('- NODE_ENV:', process.env.NODE_ENV);

    // Test Supabase connection
    let supabaseTest = 'Not tested';
    try {
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
      const { data, error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        supabaseTest = `Error: ${error.message}`;
      } else {
        supabaseTest = 'Success';
      }
    } catch (err) {
      supabaseTest = `Exception: ${err.message}`;
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      hasAuth: !!req.headers.authorization,
      authHeader: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : null,
      environment: {
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        NODE_ENV: process.env.NODE_ENV,
      },
      supabaseTest,
      userAgent: req.headers['user-agent']
    };

    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    return res.status(200).json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack
    });
  }
} 