export default function handler(req, res) {
  try {
    // Basic test response
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      message: 'Serverless function is working!',
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
      nodeVersion: process.version
    });
  } catch (error) {
    res.status(500).json({
      error: 'Handler failed',
      message: error.message,
      stack: error.stack
    });
  }
} 