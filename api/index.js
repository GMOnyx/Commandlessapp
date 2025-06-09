// Import required dependencies
import express from 'express';
import 'dotenv/config';

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Import and set up routes
let routesSetup = false;

async function setupRoutes() {
  if (routesSetup) return;
  
  try {
    // Import the registerRoutes function from the built server
    const { registerRoutes } = await import('../dist/index.js');
    if (registerRoutes) {
      await registerRoutes(app);
      routesSetup = true;
      console.log('[API] Routes registered successfully');
    }
  } catch (error) {
    console.error('[API] Error setting up routes:', error);
    // Fallback to basic API response
    app.get('/api/*', (req, res) => {
      res.status(500).json({ 
        error: 'Server routes not available',
        message: error.message 
      });
    });
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Set up routes on first request
  await setupRoutes();
  
  // Handle the request through Express
  if (routesSetup) {
    return new Promise((resolve) => {
      app(req, res, () => {
        resolve();
      });
    });
  } else {
    // Fallback response if routes couldn't be set up
    return res.status(500).json({
      error: 'API not available',
      message: 'Server routes could not be initialized'
    });
  }
} 