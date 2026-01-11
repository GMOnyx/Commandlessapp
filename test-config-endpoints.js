#!/usr/bin/env node
/**
 * Test script for bot configuration endpoints
 * Usage: node test-config-endpoints.js [railway-url]
 * 
 * Examples:
 *   node test-config-endpoints.js https://your-app.up.railway.app
 *   node test-config-endpoints.js http://localhost:5001
 */

// Always use production Railway URL (no need for env var)
const BASE_URL = process.argv[2] || 'https://commandless-app-production.up.railway.app';
const API_KEY = process.env.COMMANDLESS_API_KEY;
const JWT_TOKEN = process.env.JWT_TOKEN || 'your_jwt_token_here';
const BOT_ID = process.env.BOT_ID || '87'; // Default from your env vars

if (!API_KEY) {
  console.error('❌ Error: COMMANDLESS_API_KEY environment variable is required');
  console.log('');
  console.log('Usage:');
  console.log('  export COMMANDLESS_API_KEY="ck_xxx:cs_xxx"');
  console.log('  export BOT_ID="87"');
  console.log('  node test-config-endpoints.js');
  process.exit(1);
}

console.log('🧪 Testing Bot Configuration Endpoints\n');
console.log(`📍 Base URL: ${BASE_URL}`);
console.log(`🤖 Bot ID: ${BOT_ID}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);
console.log('');

// Test 1: SDK fetches config (via API key)
async function testSdkConfigFetch() {
  console.log('📡 Test 1: SDK Config Fetch (GET /v1/relay/config)');
  
  try {
    const url = `${BASE_URL}/v1/relay/config?botId=${BOT_ID}`;
    console.log(`   Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': API_KEY,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`   Version: ${data.version}`);
      console.log(`   Enabled: ${data.enabled}`);
      console.log(`   Channel Mode: ${data.channelMode}`);
      console.log(`   Free Rate Limit: ${data.freeRateLimit}/hr`);
      console.log(`   Premium Rate Limit: ${data.premiumRateLimit}/hr`);
    } else {
      console.log(`❌ Failed: ${response.status}`);
      console.log(`   Error: ${data.error || JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
    console.log(`   Is the server running at ${BASE_URL}?`);
  }
  console.log('---\n');
}

// Test 2: Dashboard fetches config (via JWT)
async function testDashboardConfigFetch() {
  console.log('🖥️  Test 2: Dashboard Config Fetch (GET /api/bots/:id/config)');
  
  if (JWT_TOKEN === 'your_jwt_token_here') {
    console.log('⏭️  Skipped: No JWT token provided (not needed for SDK testing)');
    console.log('---\n');
    return;
  }
  
  try {
    const url = `${BASE_URL}/api/bots/${BOT_ID}/config`;
    console.log(`   Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`   Config ID: ${data.id}`);
      console.log(`   Version: ${data.version}`);
      console.log(`   Channel Mode: ${data.channelMode}`);
      console.log(`   Permission Mode: ${data.permissionMode}`);
    } else {
      console.log(`❌ Failed: ${response.status}`);
      console.log(`   Error: ${data.error || JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
  }
  console.log('---\n');
}

// Test 3: Dashboard updates config (via JWT)
async function testDashboardConfigUpdate() {
  console.log('✏️  Test 3: Dashboard Config Update (PUT /api/bots/:id/config)');
  
  if (JWT_TOKEN === 'your_jwt_token_here') {
    console.log('⏭️  Skipped: No JWT token provided (not needed for SDK testing)');
    console.log('---\n');
    return;
  }
  
  const updates = {
    channelMode: 'whitelist',
    enabledChannels: ['123456789', '987654321'],
    freeRateLimit: 5,
    premiumRateLimit: 25,
  };
  
  try {
    const url = `${BASE_URL}/api/bots/${BOT_ID}/config`;
    console.log(`   Updating: ${url}`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log(`   New Version: ${data.version}`);
      console.log('   Changes:', Object.keys(updates).join(', '));
    } else {
      console.log(`❌ Failed: ${response.status}`);
      console.log(`   Error: ${data.error || JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
  }
  console.log('---\n');
}

// Test 4: SDK fetches updated config
async function testSdkConfigFetchWithVersion() {
  console.log('🔄 Test 4: SDK Config Fetch with Version (cache check)');
  
  try {
    // First fetch to get version
    console.log(`   Fetching current version...`);
    const response1 = await fetch(`${BASE_URL}/v1/relay/config?botId=${BOT_ID}`, {
      headers: { 'x-api-key': API_KEY },
    });
    
    if (!response1.ok) {
      const data = await response1.json();
      console.log(`❌ Failed: ${response1.status} - ${data.error}`);
      console.log('---\n');
      return;
    }
    
    const data1 = await response1.json();
    console.log(`   Current version: ${data1.version}`);
    
    // Second fetch with version (should return upToDate if no changes)
    console.log(`   Checking if version ${data1.version} is up to date...`);
    const response2 = await fetch(`${BASE_URL}/v1/relay/config?botId=${BOT_ID}&version=${data1.version}`, {
      headers: { 'x-api-key': API_KEY },
    });
    const data2 = await response2.json();
    
    if (data2.upToDate) {
      console.log('✅ Cache working! SDK is up to date (no full config returned)');
    } else {
      console.log(`✅ New config version available: ${data2.version}`);
      console.log(`   SDK would update from v${data1.version} to v${data2.version}`);
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
  }
  console.log('---\n');
}

// Run all tests
async function runTests() {
  // Check connectivity first
  console.log('🔌 Checking server connectivity...');
  try {
    const response = await fetch(`${BASE_URL}/api/bots`, {
      headers: { 'x-api-key': API_KEY },
    });
    if (response.status === 401) {
      console.log('✅ Server is reachable (got expected 401 Unauthorized)\n');
    } else {
      console.log(`✅ Server is reachable (status: ${response.status})\n`);
    }
  } catch (error) {
    console.log(`❌ Cannot reach server at ${BASE_URL}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    console.log('💡 Tips:');
    console.log('   1. Deploy to Railway: railway up');
    console.log('   2. Or start local server: npm run dev (in another terminal)');
    console.log('   3. Then run: node test-config-endpoints.js https://your-app.up.railway.app\n');
    return;
  }
  
  
  await testSdkConfigFetch();
  await testDashboardConfigFetch();
  await testDashboardConfigUpdate();
  await testSdkConfigFetchWithVersion();
  
  console.log('✨ All tests complete!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   • Phase 1 backend is working!');
  console.log('   • Ready to move to Phase 2 (SDK config cache)');
}

runTests().catch(console.error);

