export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Hello from ES Module!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    moduleType: 'ES Module (.mjs)'
  });
} 