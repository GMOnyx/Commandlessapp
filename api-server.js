import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://www.commandless.app', 'https://commandless.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Railway API is running!',
    timestamp: new Date().toISOString(),
    platform: 'Railway'
  });
});

// Basic endpoints to start
app.get('/status', (req, res) => {
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
  res.json([]);
});

app.get('/mappings', (req, res) => {
  res.json([]);
});

app.get('/activities', (req, res) => {
  res.json([]);
});

// Catch all for testing
app.use('*', (req, res) => {
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
}); 