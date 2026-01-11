-- ============================================================================
-- Commandless Bot Configuration System Migration
-- Created: 2026-01-11
-- Purpose: Add bot configuration tables for channel, role, and command control
-- ============================================================================
-- TABLE 1: bot_configurations
-- Main configuration storage for each bot
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_configurations (
  -- Identity
  id BIGSERIAL PRIMARY KEY,
  bot_id BIGINT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- SECTION 1: CHANNEL CONTROL
  -- Controls which Discord channels the AI processes
  enabled_channels JSONB DEFAULT '[]'::jsonb,
  disabled_channels JSONB DEFAULT '[]'::jsonb,
  channel_mode TEXT DEFAULT 'all' CHECK (channel_mode IN ('all', 'whitelist', 'blacklist')),
  
  -- SECTION 2: USER/ROLE PERMISSIONS
  -- Controls who can use the AI features
  enabled_roles JSONB DEFAULT '[]'::jsonb,
  disabled_roles JSONB DEFAULT '[]'::jsonb,
  enabled_users JSONB DEFAULT '[]'::jsonb,
  disabled_users JSONB DEFAULT '[]'::jsonb,
  permission_mode TEXT DEFAULT 'all' CHECK (permission_mode IN ('all', 'whitelist', 'blacklist', 'premium_only')),
  premium_role_ids JSONB DEFAULT '[]'::jsonb,
  
  -- SECTION 3: COMMAND CONTROL
  -- Controls which command categories are enabled
  enabled_command_categories JSONB DEFAULT '["moderation", "utility", "fun", "economy"]'::jsonb,
  disabled_commands JSONB DEFAULT '[]'::jsonb,
  command_mode TEXT DEFAULT 'all' CHECK (command_mode IN ('all', 'category_based', 'whitelist', 'blacklist')),
  
  -- SECTION 4: TRIGGER SETTINGS
  -- How the bot gets activated
  mention_required BOOLEAN DEFAULT true,
  custom_prefix TEXT DEFAULT NULL,
  trigger_mode TEXT DEFAULT 'mention' CHECK (trigger_mode IN ('mention', 'prefix', 'always')),
  
  -- SECTION 5: RATE LIMITING
  -- Prevent spam and control costs
  free_rate_limit INT DEFAULT 10 CHECK (free_rate_limit >= 0 AND free_rate_limit <= 1000),
  premium_rate_limit INT DEFAULT 50 CHECK (premium_rate_limit >= 0 AND premium_rate_limit <= 1000),
  server_rate_limit INT DEFAULT 100 CHECK (server_rate_limit >= 0 AND server_rate_limit <= 10000),
  
  -- SECTION 6: AI BEHAVIOR
  -- Safety and quality controls
  confidence_threshold DECIMAL(3,2) DEFAULT 0.70 CHECK (confidence_threshold >= 0.0 AND confidence_threshold <= 1.0),
  require_confirmation BOOLEAN DEFAULT false,
  dangerous_commands JSONB DEFAULT '["ban", "kick", "purge", "nuke"]'::jsonb,
  response_style TEXT DEFAULT 'friendly' CHECK (response_style IN ('friendly', 'professional', 'minimal')),
  
  -- SECTION 7: FEATURE FLAGS
  enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one config per bot
  CONSTRAINT unique_bot_config UNIQUE(bot_id)
);

-- Indexes for bot_configurations
CREATE INDEX IF NOT EXISTS idx_bot_config_bot ON bot_configurations(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_config_user ON bot_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_config_enabled ON bot_configurations(enabled) WHERE enabled = true;

-- Comment on table
COMMENT ON TABLE bot_configurations IS 'Stores configuration for bot behavior, permissions, and rate limits';

-- ============================================================================
-- TABLE 2: rate_limit_usage
-- Server-side rate limit tracking for authoritative enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_usage (
  id BIGSERIAL PRIMARY KEY,
  bot_id BIGINT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  discord_guild_id TEXT NOT NULL,
  request_count INT DEFAULT 1 CHECK (request_count >= 0),
  window_start TIMESTAMPTZ NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per user per bot per hour window
  CONSTRAINT unique_rate_limit_window UNIQUE(bot_id, discord_user_id, window_start)
);

-- Indexes for rate_limit_usage
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limit_usage(bot_id, discord_user_id, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limit_usage(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_guild ON rate_limit_usage(discord_guild_id, window_start);

-- Comment on table
COMMENT ON TABLE rate_limit_usage IS 'Tracks API usage per user per hour for rate limiting';

-- ============================================================================
-- TABLE 3: config_versions
-- Tracks configuration version for SDK cache invalidation
-- ============================================================================
CREATE TABLE IF NOT EXISTS config_versions (
  bot_id BIGINT PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  version INT DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for config_versions
CREATE INDEX IF NOT EXISTS idx_config_versions_updated ON config_versions(updated_at);

-- Comment on table
COMMENT ON TABLE config_versions IS 'Tracks config version for SDK cache invalidation';

-- ============================================================================
-- FUNCTION: Auto-increment version on config update
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_config_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO config_versions (bot_id, version, updated_at)
  VALUES (NEW.bot_id, 1, NOW())
  ON CONFLICT (bot_id) 
  DO UPDATE SET 
    version = config_versions.version + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment version on config update
DROP TRIGGER IF EXISTS trigger_increment_config_version ON bot_configurations;
CREATE TRIGGER trigger_increment_config_version
AFTER INSERT OR UPDATE ON bot_configurations
FOR EACH ROW
EXECUTE FUNCTION increment_config_version();

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on config changes
DROP TRIGGER IF EXISTS trigger_update_bot_config_timestamp ON bot_configurations;
CREATE TRIGGER trigger_update_bot_config_timestamp
BEFORE UPDATE ON bot_configurations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Cleanup old rate limit records (run daily via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  -- Delete rate limit records older than 7 days
  DELETE FROM rate_limit_usage 
  WHERE window_start < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE DEFAULT CONFIGS FOR EXISTING BOTS
-- Ensures all existing bots get a default configuration
-- ============================================================================
INSERT INTO bot_configurations (bot_id, user_id)
SELECT 
  b.id AS bot_id,
  b.user_id
FROM bots b
WHERE NOT EXISTS (
  SELECT 1 FROM bot_configurations bc WHERE bc.bot_id = b.id
)
ON CONFLICT (bot_id) DO NOTHING;

-- Initialize config versions for existing bots
INSERT INTO config_versions (bot_id, version, updated_at)
SELECT 
  b.id AS bot_id,
  1 AS version,
  NOW() AS updated_at
FROM bots b
WHERE NOT EXISTS (
  SELECT 1 FROM config_versions cv WHERE cv.bot_id = b.id
)
ON CONFLICT (bot_id) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS (if using RLS - adjust as needed)
-- ============================================================================
-- These grants assume you're using service role key on backend
-- Adjust based on your RLS policies

-- Allow authenticated users to read their own configs
ALTER TABLE bot_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own bot configs
CREATE POLICY "Users can view own bot configs"
ON bot_configurations FOR SELECT
USING (auth.uid()::text = user_id);

-- Policy: Users can update their own bot configs
CREATE POLICY "Users can update own bot configs"
ON bot_configurations FOR UPDATE
USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own bot configs
CREATE POLICY "Users can insert own bot configs"
ON bot_configurations FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Note: Service role (backend) bypasses RLS, so API key auth works fine

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration worked
-- ============================================================================

-- Verify tables exist
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('bot_configurations', 'rate_limit_usage', 'config_versions');
  
  IF table_count = 3 THEN
    RAISE NOTICE '✅ All 3 tables created successfully';
  ELSE
    RAISE EXCEPTION '❌ Only % tables found, expected 3', table_count;
  END IF;
END $$;

-- Verify default configs were created for existing bots
DO $$
DECLARE
  bot_count INT;
  config_count INT;
BEGIN
  SELECT COUNT(*) INTO bot_count FROM bots;
  SELECT COUNT(*) INTO config_count FROM bot_configurations;
  
  RAISE NOTICE '📊 Bots: %, Configs: %', bot_count, config_count;
  
  IF bot_count > 0 AND config_count = 0 THEN
    RAISE WARNING '⚠️  Bots exist but no configs created - check the INSERT statement';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify tables in Supabase Table Editor
-- 2. Test GET /v1/relay/config endpoint
-- 3. Test PUT /api/bots/:id/config endpoint
-- 4. Update SDK to fetch and cache config
-- ============================================================================

