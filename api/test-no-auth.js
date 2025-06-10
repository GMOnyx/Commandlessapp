const { createClient } = require('@supabase/supabase-js');

require('dotenv/config');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test database connection by getting counts
    const results = await Promise.allSettled([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('bots').select('id', { count: 'exact', head: true }),
      supabase.from('command_mappings').select('id', { count: 'exact', head: true }),
      supabase.from('activities').select('id', { count: 'exact', head: true })
    ]);

    const counts = {
      users: results[0].status === 'fulfilled' ? results[0].value.count : 'error',
      bots: results[1].status === 'fulfilled' ? results[1].value.count : 'error',
      command_mappings: results[2].status === 'fulfilled' ? results[2].value.count : 'error',
      activities: results[3].status === 'fulfilled' ? results[3].value.count : 'error'
    };

    // Get sample data (first record from each table)
    const sampleData = await Promise.allSettled([
      supabase.from('users').select('id, username').limit(1),
      supabase.from('bots').select('id, user_id, bot_name').limit(1),
      supabase.from('command_mappings').select('id, user_id, name').limit(1),
      supabase.from('activities').select('id, user_id, activity_type').limit(1)
    ]);

    return res.status(200).json({
      status: 'Database test successful',
      tableCounts: counts,
      sampleData: {
        users: sampleData[0].status === 'fulfilled' ? sampleData[0].value.data : null,
        bots: sampleData[1].status === 'fulfilled' ? sampleData[1].value.data : null,
        command_mappings: sampleData[2].status === 'fulfilled' ? sampleData[2].value.data : null,
        activities: sampleData[3].status === 'fulfilled' ? sampleData[3].value.data : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Test API Error]:', error);
    return res.status(500).json({ 
      error: 'Database test failed',
      details: error.message
    });
  }
}; 