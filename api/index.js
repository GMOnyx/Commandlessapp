export default function handler(req, res) {
  // This will handle API routes only
  // Static files are now served directly by Vercel
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // For now, return a simple API response
  res.status(200).json({
    message: 'API is working!',
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
} 