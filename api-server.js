import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting API server...');
console.log('📍 Port:', PORT);
console.log('📍 NODE_ENV:', process.env.NODE_ENV);
console.log('📍 Railway PORT:', process.env.PORT);

// Middleware
app.use(cors({
  origin: ['https://www.commandless.app', 'https://commandless.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('💚 Health check requested');
  res.json({
    status: 'ok',
    message: 'Railway API is running!',
    timestamp: new Date().toISOString(),
    platform: 'Railway',
    port: PORT,
    nodeEnv: process.env.NODE_ENV
  });
});

// Basic endpoints to start
app.get('/status', (req, res) => {
  console.log('📊 Status requested');
  res.json({
    status: 'API running on Railway',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY
    }
  });
});

app.get('/bots', (req, res) => {
  console.log('🤖 Bots endpoint requested');
  res.json([]);
});

app.get('/mappings', (req, res) => {
  console.log('🗺️ Mappings endpoint requested');
  res.json([]);
});

app.get('/activities', (req, res) => {
  console.log('📈 Activities endpoint requested');
  res.json([]);
});

// Catch all for testing
app.use('*', (req, res) => {
  console.log(`❌ Unknown endpoint: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    url: req.originalUrl,
    method: req.method,
    availableEndpoints: ['/health', '/status', '/bots', '/mappings', '/activities']
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 External URL: https://commandlessapp-production.up.railway.app`);
}); 