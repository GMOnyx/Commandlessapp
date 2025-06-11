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
app.get('/api/status', (req, res) => {
  console.log('📊 API Status requested');
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

app.get('/api/bots', (req, res) => {
  console.log('🤖 API Bots endpoint requested');
  res.json([]);
});

app.get('/api/mappings', (req, res) => {
  console.log('🗺️ API Mappings endpoint requested');
  res.json([]);
});

app.get('/api/activities', (req, res) => {
  console.log('📈 API Activities endpoint requested');
  res.json([]);
});

// Client logs endpoint (for frontend debugging)
app.post('/api/client-logs', (req, res) => {
  console.log('📝 Client log received:', req.body);
  res.json({ status: 'logged' });
});

// Token validation endpoint  
app.post('/api/discord/validate-token', (req, res) => {
  console.log('🔍 Discord Token validation requested');
  const { token, platform } = req.body;
  
  if (!token) {
    return res.status(400).json({ 
      valid: false, 
      error: 'Token is required' 
    });
  }
  
  // For now, just do basic validation
  if (token.length < 50) {
    return res.status(400).json({ 
      valid: false, 
      error: 'Token appears to be too short' 
    });
  }
  
  // TODO: Add real Discord/Telegram token validation
  res.json({ 
    valid: true, 
    botName: 'Bot Name Placeholder',
    botId: '123456789'
  });
});

// Bot connection endpoints
app.post('/api/bots', (req, res) => {
  console.log('🤖 Create bot requested:', req.body);
  const { name, platform, token, clientId, personality } = req.body;
  
  // TODO: Save to database
  const newBot = {
    id: Date.now().toString(),
    name,
    platform,
    token: '***hidden***',
    clientId,
    personality,
    status: 'connected',
    createdAt: new Date().toISOString()
  };
  
  res.json(newBot);
});

// Legacy endpoints without /api prefix (for backward compatibility)
app.get('/status', (req, res) => {
  console.log('📊 Legacy Status requested');
  res.redirect('/api/status');
});

app.get('/bots', (req, res) => {
  console.log('🤖 Legacy Bots requested');
  res.redirect('/api/bots');
});

app.get('/mappings', (req, res) => {
  console.log('🗺️ Legacy Mappings requested');
  res.redirect('/api/mappings');
});

app.get('/activities', (req, res) => {
  console.log('📈 Legacy Activities requested');
  res.redirect('/api/activities');
});

// DEPRECATED - remove later
app.post('/api/validate-token', (req, res) => {
  console.log('⚠️ Deprecated /api/validate-token called');
  res.redirect(308, '/api/discord/validate-token');
});

// Catch all for testing
app.use('*', (req, res) => {
  console.log(`❌ Unknown endpoint: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    url: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/health', 
      '/api/status', 
      '/api/bots', 
      '/api/mappings', 
      '/api/activities',
      '/api/client-logs',
      '/api/discord/validate-token'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 External URL: https://commandlessapp-production.up.railway.app`);
}); 