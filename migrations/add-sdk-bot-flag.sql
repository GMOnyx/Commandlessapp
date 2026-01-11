-- Add connection_mode field to explicitly track SDK vs Token bots
ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS connection_mode TEXT DEFAULT 'sdk' CHECK (connection_mode IN ('sdk', 'token'));

-- Set connection_mode based on existing token data
UPDATE bots
SET connection_mode = CASE 
  WHEN token IS NULL OR token = '' OR LENGTH(token) < 50 THEN 'sdk'
  ELSE 'token'
END
WHERE connection_mode IS NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_bots_connection_mode ON bots(connection_mode);

-- Comment
COMMENT ON COLUMN bots.connection_mode IS 'SDK bots use relay client, Token bots use hosted runner';

