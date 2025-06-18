import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSampleData } from "./setupSampleData";
import { initSupabase } from "./supabase";
import { resetData } from "./resetData";
import { validateEncryptionSetup } from "./utils/encryption";
import { validateGeminiConfig } from "./gemini/client";
import { getConfig } from "./config/production";

const app = express();

// Load dynamic configuration
const config = getConfig();

// CORS Configuration - Use dynamic allowed origins
app.use(cors({
  origin: config.server.allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Add request logging for debugging
app.use((req, res, next) => {
  if (config.features.enableDebugLogging) {
    log(`${req.method} ${req.path}`, 'debug');
  }
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.server.environment,
    port: config.server.port
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Commandless API', 
    environment: config.server.environment,
    timestamp: new Date().toISOString()
  });
});

(async () => {
  // Validate security configuration
  log('🔒 Validating security configuration...', 'info');
  validateEncryptionSetup();
  validateGeminiConfig();
  
  // Initialize Supabase if enabled
  if (config.database.useSupabase) {
    try {
      await initSupabase();
    } catch (error) {
      log(`Error initializing Supabase: ${(error as Error).message}. Continuing without Supabase.`, 'error');
    }
  } else {
    log('Supabase disabled (USE_SUPABASE is not set to true)', 'info');
  }
  
  // Reset all data if requested
  if (config.features.resetData) {
    log('Resetting all application data...', 'info');
    await resetData();
    log('Data reset complete.', 'info');
  }
  
  // Setup sample data for demo purposes
  if (!config.features.skipSampleData) {
    await setupSampleData();
  } else {
    log('Skipping sample data setup (SKIP_SAMPLE_DATA=true)', 'info');
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite in development or serve static files in production
  if (config.server.environment === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use dynamic port and host from configuration
  server.listen({
    port: config.server.port,
    host: config.server.host,
    reusePort: true,
  }, () => {
    log(`🚀 Commandless server running on ${config.server.host}:${config.server.port}`);
    log(`🌍 Environment: ${config.server.environment}`);
    log(`📡 Database: ${config.database.useSupabase ? 'Supabase' : 'In-memory'}`);
    log(`🔒 Security: ${config.security.encryptionKey ? 'Encrypted' : 'Basic'}`);
  });
})();
