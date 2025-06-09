import 'dotenv/config';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // For now, return empty arrays for the dashboard to load
  // This is a temporary fix while we debug the full server integration
  
  if (req.url === '/api/bots') {
    return res.status(200).json([]);
  }
  
  if (req.url === '/api/mappings') {
    return res.status(200).json([]);
  }
  
  if (req.url === '/api/activities') {
    return res.status(200).json([]);
  }
  
  // Default response
  return res.status(200).json({
    message: 'API is working',
    url: req.url,
    method: req.method,
    note: 'Simplified API for dashboard loading'
  });
} 