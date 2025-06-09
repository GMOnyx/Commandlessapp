import 'dotenv/config';

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
  
  // TEMPORARILY SKIP AUTHENTICATION TO TEST
  // TODO: Re-enable authentication once we confirm this fixes the issue
  
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