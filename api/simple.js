// Simple API endpoint without any external dependencies
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, url } = req;
  
  console.log(`[SIMPLE] ${method} ${url}`);

  try {
    // Health check
    if (method === 'GET' && url === '/api/simple/health') {
      return res.status(200).json({
        status: 'ok',
        message: 'Simple API is working',
        timestamp: new Date().toISOString()
      });
    }

    // Status endpoint
    if (method === 'GET' && url === '/api/simple/status') {
      return res.status(200).json({
        status: 'Simple API is working',
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          platform: process.platform,
          nodeVersion: process.version
        }
      });
    }

    // Logs viewer endpoint
    if (method === 'GET' && url === '/api/simple/logs') {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Simple Debug Info</title>
          <style>
            body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
            .info { color: #74c0fc; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Simple Debug Info</h1>
          <div class="info">Timestamp: ${new Date().toISOString()}</div>
          <div class="info">Node Version: ${process.version}</div>
          <div class="info">Platform: ${process.platform}</div>
          <div class="info">Environment: ${process.env.NODE_ENV || 'not set'}</div>
          <div class="info">URL: ${url}</div>
          <div class="info">Method: ${method}</div>
        </body>
        </html>
      `);
    }

    // Default response
    return res.status(200).json({
      message: 'Simple API endpoint',
      method,
      url,
      availableEndpoints: [
        '/api/simple/health',
        '/api/simple/status', 
        '/api/simple/logs'
      ]
    });
    
  } catch (error) {
    console.error('[SIMPLE ERROR]', error);
    return res.status(500).json({
      error: 'Simple API error',
      message: error.message
    });
  }
}; 