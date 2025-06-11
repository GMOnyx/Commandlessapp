-- Create debug_logs table for persistent logging
CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying by timestamp
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON debug_logs(timestamp DESC);

-- Create index for efficient querying by level
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level);

-- Create index for efficient querying by category
CREATE INDEX IF NOT EXISTS idx_debug_logs_category ON debug_logs(category);

-- Create a function to automatically clean up old logs (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_debug_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM debug_logs 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  INSERT INTO debug_logs (level, category, message, metadata)
  VALUES ('info', 'CLEANUP', 'Automatic log cleanup completed', 
          json_build_object('deleted_count', deleted_count)::jsonb);
          
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Set up RLS (Row Level Security) if needed
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for service role
CREATE POLICY IF NOT EXISTS "Allow all operations for service role" ON debug_logs
  FOR ALL USING (true);

-- Grant permissions to authenticated users (if needed for reading logs)
GRANT SELECT ON debug_logs TO authenticated;
GRANT ALL ON debug_logs TO service_role;

-- Insert initial log entry
INSERT INTO debug_logs (level, category, message, metadata)
VALUES ('info', 'INIT', 'Debug logging table created successfully', 
        json_build_object('version', '1.0', 'created_at', NOW())::jsonb); 