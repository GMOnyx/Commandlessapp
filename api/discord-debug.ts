import { type VercelRequest, type VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('🔍 DISCORD DEBUG ENDPOINT');
  console.log('📋 Method:', req.method);
  console.log('📋 Query:', req.query);
  console.log('📋 Body:', JSON.stringify(req.body, null, 2));
  console.log('📋 Headers:', req.headers);

  // For Universal Relay Service calls with ?action=process-message
  const { action } = req.query;
  
  if (action === 'process-message') {
    const body = req.body;
    
    // Log the structure we're receiving
    console.log('✅ Received process-message request');
    console.log('📨 Message content:', body.message?.content);
    console.log('🤖 Bot client ID:', body.botClientId);
    console.log('👤 User ID:', body.message?.author?.id);
    
    // Return the expected format for Universal Relay Service
    return res.status(200).json({
      processed: true,
      response: `✅ Debug: Received "${body.message?.content}" from user ${body.message?.author?.username}. API is working!`,
      execution: null
    });
  }

  // For other calls, just return debug info
  return res.status(200).json({
    debug: true,
    method: req.method,
    query: req.query,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body || {}),
    message: 'Discord debug endpoint working'
  });
} 