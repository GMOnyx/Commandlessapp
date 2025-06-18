/**
 * PRODUCTION CONFIGURATION SYSTEM
 * Eliminates ALL hardcoding for production deployment
 */

export interface AppConfig {
  server: {
    port: number;
    host: string;
    environment: string;
    allowedOrigins: string[];
  };
  database: {
    useSupabase: boolean;
    supabaseUrl: string;
    supabaseKey: string;
  };
  auth: {
    clerkSecretKey: string;
    jwtSecret: string;
  };
  ai: {
    geminiApiKey: string;
  };
  security: {
    encryptionKey: string;
  };
  features: {
    skipSampleData: boolean;
    resetData: boolean;
    enableDebugLogging: boolean;
  };
  discord: {
    defaultTestUserId?: string; // For testing only
  };
  deployment: {
    railwayUrl?: string;
    vercelUrl?: string;
  };
}

/**
 * Load and validate production configuration
 */
export function loadProductionConfig(): AppConfig {
  const config: AppConfig = {
    server: {
      port: parseInt(process.env.PORT || '5001', 10),
      host: process.env.HOST || '0.0.0.0',
      environment: process.env.NODE_ENV || 'development',
      allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://www.commandless.app,https://commandless.app')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
    },
    database: {
      useSupabase: process.env.USE_SUPABASE === 'true',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    },
    auth: {
      clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
      jwtSecret: process.env.JWT_SECRET || 'your-fallback-secret-key',
    },
    ai: {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
    },
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY || '',
    },
    features: {
      skipSampleData: process.env.SKIP_SAMPLE_DATA === 'true',
      resetData: process.env.RESET_DATA === 'true',
      enableDebugLogging: process.env.DEBUG_LOGGING === 'true',
    },
    discord: {
      defaultTestUserId: process.env.DEFAULT_TEST_USER_ID,
    },
    deployment: {
      railwayUrl: process.env.RAILWAY_URL,
      vercelUrl: process.env.VERCEL_URL,
    },
  };

  // Validate critical production settings
  validateProductionConfig(config);
  
  return config;
}

/**
 * Validate production configuration
 */
function validateProductionConfig(config: AppConfig): void {
  const errors: string[] = [];
  
  // Critical production validations
  if (config.server.environment === 'production') {
    if (!config.security.encryptionKey || config.security.encryptionKey.length < 32) {
      errors.push('ENCRYPTION_KEY must be at least 32 characters in production');
    }
    
    if (!config.auth.clerkSecretKey || !config.auth.clerkSecretKey.startsWith('sk_')) {
      errors.push('Valid CLERK_SECRET_KEY required in production');
    }
    
    if (!config.ai.geminiApiKey || config.ai.geminiApiKey.length < 20) {
      errors.push('Valid GEMINI_API_KEY required in production');
    }
    
    if (config.database.useSupabase && (!config.database.supabaseUrl || !config.database.supabaseKey)) {
      errors.push('SUPABASE_URL and SUPABASE_ANON_KEY required when USE_SUPABASE=true');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ PRODUCTION CONFIG VALIDATION FAILED:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (config.server.environment === 'production') {
      throw new Error('Production configuration invalid. See errors above.');
    } else {
      console.warn('⚠️ Config issues detected (development mode continues)');
    }
  } else {
    console.log('✅ Production configuration validated successfully');
  }
}

/**
 * Get API base URL dynamically
 */
export function getApiBaseUrl(config: AppConfig): string {
  // Production URLs take precedence
  if (config.deployment.railwayUrl) return config.deployment.railwayUrl;
  if (config.deployment.vercelUrl) return config.deployment.vercelUrl;
  
  // Development fallback
  return `http://localhost:${config.server.port}`;
}

/**
 * Get user ID dynamically (never hardcoded)
 */
export function getUserId(requestHeaders: any, config: AppConfig): string | null {
  // Try to extract from Authorization header
  const authHeader = requestHeaders.authorization || requestHeaders.Authorization;
  if (authHeader) {
    // Remove 'Bearer ' prefix if present
    const token = authHeader.replace(/^Bearer\s+/, '');
    if (token && token !== 'undefined' && token !== 'null') {
      return token;
    }
  }
  
  // Fallback to test user only in development
  if (config.server.environment === 'development' && config.discord.defaultTestUserId) {
    console.warn('⚠️ Using default test user ID (development only)');
    return config.discord.defaultTestUserId;
  }
  
  return null;
}

/**
 * Create dynamic test configuration (eliminates hardcoded test values)
 */
export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const baseConfig = loadProductionConfig();
  
  return {
    ...baseConfig,
    server: {
      ...baseConfig.server,
      environment: 'test',
      ...overrides.server,
    },
    discord: {
      defaultTestUserId: `test-user-${Date.now()}`,
      ...overrides.discord,
    },
    ...overrides,
  };
}

// Global config instance
let globalConfig: AppConfig | null = null;

/**
 * Get global configuration (singleton)
 */
export function getConfig(): AppConfig {
  if (!globalConfig) {
    globalConfig = loadProductionConfig();
  }
  return globalConfig;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  globalConfig = null;
} 