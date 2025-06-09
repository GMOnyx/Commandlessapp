import 'dotenv/config';
import express from 'express';

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Import and register the real routes
let routesInitialized = false;

async function initializeRoutes() {
  if (routesInitialized) return;
  
  try {
    // Import the real registerRoutes function from the built server
    const { registerRoutes } = await import('../dist/index.js');
    if (registerRoutes) {
      await registerRoutes(app);
      routesInitialized = true;
      console.log('[API] Real server routes initialized successfully');
    } else {
      throw new Error('registerRoutes function not found');
    }
  } catch (error) {
    console.error('[API] Failed to initialize real routes:', error);
    // Set up basic fallback endpoints
    app.get('/api/bots', (req, res) => {
      res.status(500).json({ error: 'Server routes not available', message: error.message });
    });
    app.get('/api/mappings', (req, res) => {
      res.status(500).json({ error: 'Server routes not available', message: error.message });
    });
    app.get('/api/activities', (req, res) => {
      res.status(500).json({ error: 'Server routes not available', message: error.message });
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

  // Initialize routes on first request
  await initializeRoutes();
  
  // Handle the request through the real Express app
  return new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
} 