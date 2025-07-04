import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSampleData } from "./setupSampleData";
import { initSupabase } from "./supabase";
import { resetData } from "./resetData";
import { validateEncryptionSetup } from "./utils/encryption";
import { validateGeminiConfig } from "./gemini/client";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate security configuration
  log('🔒 Validating security configuration...', 'info');
  validateEncryptionSetup();
  validateGeminiConfig();
  
  // Initialize Supabase if enabled
  if (process.env.USE_SUPABASE === 'true') {
    try {
      await initSupabase();
    } catch (error) {
      log(`Error initializing Supabase: ${(error as Error).message}. Continuing without Supabase.`, 'error');
    }
  } else {
    log('Supabase disabled (USE_SUPABASE is not set to true)', 'info');
  }
  
  // Reset all data if requested
  if (process.env.RESET_DATA === 'true') {
    log('Resetting all application data...', 'info');
    await resetData();
    log('Data reset complete.', 'info');
  }
  
  // Setup sample data for demo purposes
  if (process.env.SKIP_SAMPLE_DATA !== 'true') {
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Using port 5001 to avoid conflict with port 5000 which is already in use
  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
