# Universal Discord Relay Service Setup

This service manages ALL your Discord bots in one place, eliminating the need for individual deployments.

## 🎯 What This Solves

- ❌ **Before**: "Manual Deployment Required" for each bot
- ✅ **After**: All bots work immediately when connected

## 🧪 Local Testing (Recommended First Step)

### 1. Install Dependencies
```bash
npm install discord.js @supabase/supabase-js node-fetch express dotenv
```

### 2. Create Environment File
Create `.env` file with your credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
COMMANDLESS_API_URL=https://commandless.app
```

### 3. Test Locally
```bash
node test-universal-relay.js
```

This will:
- ✅ Connect to your Supabase database
- ✅ Load all connected Discord bots
- ✅ Start Discord.js clients for each bot
- ✅ Test basic responses (`ping`, `hello`, `test`)
- ✅ Forward complex messages to your API

### 4. Test in Discord
Once running, test with:
- `@your_bot ping` - Should respond immediately
- `@your_bot hello` - Should greet you
- `@your_bot ban @user for spam` - Should process with AI

## 🚀 Production Deployment (Railway)

### Option A: Automated Deployment
```bash
./deploy-relay.sh
```

### Option B: Manual Deployment

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create Project**:
   ```bash
   railway create commandless-universal-relay
   ```

3. **Set Environment Variables**:
   ```bash
   railway env set SUPABASE_URL="your_url"
   railway env set SUPABASE_ANON_KEY="your_key"
   railway env set COMMANDLESS_API_URL="https://commandless.app"
   railway env set NODE_ENV="production"
   ```

4. **Deploy**:
   ```bash
   cp universal-relay-service.js relay-deploy/
   cp package.relay.json relay-deploy/package.json
   cp railway.relay.toml relay-deploy/railway.toml
   cd relay-deploy
   railway deploy
   ```

## 📊 Monitoring

### Health Check
Your deployed service will have health endpoints:
- `https://your-service.railway.app/health` - Basic health
- `https://your-service.railway.app/status` - Detailed bot status

### Railway Dashboard
- View logs: `railway logs`
- Monitor performance
- Check active connections

## 🔄 How It Works

1. **Service starts** → Connects to Supabase
2. **Loads all bots** → Where `is_connected = true`
3. **Creates Discord clients** → One per bot
4. **Listens for mentions** → When users mention any bot
5. **Forwards to API** → Your existing `/api/discord?action=process-message`
6. **Bot responds** → With AI-processed response
7. **Periodic sync** → Checks for new/removed bots every 30s

## 🎉 User Experience

**Before (Manual Deployment)**:
```
User adds bot → "Manual Deployment Required" → User confused → Abandons
```

**After (Universal Relay)**:
```
User adds bot → Bot immediately works → User happy → Retention ✅
```

## 🛠️ Troubleshooting

### Bot Not Responding
1. Check Railway logs: `railway logs`
2. Verify bot is `is_connected=true` in database
3. Check bot has necessary Discord permissions
4. Test health endpoint

### API Errors
1. Verify `COMMANDLESS_API_URL` is correct
2. Check your main app is deployed and working
3. Test API endpoint directly

### Discord Connection Issues
1. Verify bot tokens are valid
2. Check Discord API status
3. Ensure bot has `MESSAGE_CONTENT` intent enabled

## 📈 Scaling

This service can handle:
- ✅ Hundreds of bots simultaneously
- ✅ Thousands of messages per minute
- ✅ Multiple servers per bot
- ✅ Automatic failover and restarts

Railway's infrastructure scales automatically based on usage.

## 🔐 Security

- ✅ Bot tokens stored securely in your database
- ✅ Only loads `is_connected=true` bots
- ✅ Environment variables for sensitive config
- ✅ HTTPS-only communication with your API 