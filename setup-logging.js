import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function setupLogging() {
  console.log('🚀 Setting up debug logging table...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Since we can't execute raw SQL directly, let's try to create the table by checking if it exists
    console.log('🔍 Checking if debug_logs table exists...');
    
    const { error: checkError } = await supabase
      .from('debug_logs')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('📝 debug_logs table does not exist. Please create it manually in Supabase SQL Editor:');
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy and paste this SQL into your Supabase SQL Editor:

CREATE TABLE debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debug_logs_timestamp ON debug_logs(timestamp DESC);
CREATE INDEX idx_debug_logs_level ON debug_logs(level);
CREATE INDEX idx_debug_logs_category ON debug_logs(category);

ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role" ON debug_logs FOR ALL USING (true);

GRANT SELECT ON debug_logs TO authenticated;
GRANT ALL ON debug_logs TO service_role;

INSERT INTO debug_logs (level, category, message, metadata)
VALUES ('info', 'INIT', 'Debug logging table created manually', 
        json_build_object('version', '1.0', 'setup_time', NOW())::jsonb);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After creating the table, run this script again to test it.
      `);
      return;
    } else if (checkError) {
      console.error('❌ Error checking table:', checkError);
      return;
    } else {
      console.log('✅ debug_logs table already exists!');
    }
    
    // Test the logging by inserting a test log
    console.log('🧪 Testing log insertion...');
    const { error: testError } = await supabase
      .from('debug_logs')
      .insert({
        level: 'info',
        category: 'SETUP',
        message: 'Test log from setup script',
        metadata: { test: true, timestamp: new Date().toISOString() }
      });
    
    if (testError) {
      console.error('❌ Failed to insert test log:', testError);
    } else {
      console.log('✅ Test log inserted successfully!');
    }
    
    // Check if logs can be retrieved
    console.log('📖 Testing log retrieval...');
    const { data: logs, error: selectError } = await supabase
      .from('debug_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (selectError) {
      console.error('❌ Failed to read logs:', selectError);
    } else {
      console.log('✅ Successfully read logs:', logs?.length || 0, 'entries found');
      if (logs && logs.length > 0) {
        console.log('📋 Latest log entry:');
        console.log('   Timestamp:', logs[0].timestamp);
        console.log('   Level:', logs[0].level);
        console.log('   Category:', logs[0].category);
        console.log('   Message:', logs[0].message);
      }
    }
    
    console.log('\n🎉 Debug logging setup verification completed!');
    console.log('📱 You can now view logs at: https://www.commandless.app/api/logs');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupLogging(); 