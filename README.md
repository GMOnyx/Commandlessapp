# Commandless App

A modern app for creating voice-controlled commands through natural language patterns with enterprise-grade security.

## Features

- Create natural language commands that map to specific outputs
- Connect with Discord and other platforms
- Track command usage and activity
- Modern UI with dark mode support
- **🔒 Enterprise Security**: Encrypted bot tokens and API keys
- **🛡️ Data Protection**: All sensitive data encrypted at rest

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```
npm install
```

## SDK Quick Start (no Supabase required)

The Commandless SDK does not require Supabase. To add AI to your Discord bot you only need:

1. Install the SDK next to discord.js

```
npm install discord.js @commandless/relay-node
```

2. Add environment variables

```
BOT_TOKEN=your_discord_bot_token
COMMANDLESS_API_KEY=ck_xxx:cs_xxx           # from the dashboard API Keys
COMMANDLESS_SERVICE_URL=https://your-backend.example.com
# Optional
COMMANDLESS_HMAC_SECRET=your_hmac_secret
BOT_ID=123                                   # lock persona to a specific bot row
```

3. Use the AI‑only template (minimal)

```js
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { RelayClient, useDiscordAdapter } from '@commandless/relay-node';

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
]});

const relay = new RelayClient({
  apiKey: process.env.COMMANDLESS_API_KEY,
  baseUrl: process.env.COMMANDLESS_SERVICE_URL,
  hmacSecret: process.env.COMMANDLESS_HMAC_SECRET || undefined,
});

useDiscordAdapter({ client, relay, mentionRequired: true });

client.once('ready', async () => {
  try {
    const id = await relay.registerBot({ platform: 'discord', name: client.user.username, clientId: client.user.id });
    if (id && !relay.botId) relay.botId = id;
  } catch {}
  setInterval(async () => { try { await relay.heartbeat(); } catch {} }, 30_000);
});

client.login(process.env.BOT_TOKEN);
```

For an advanced template that routes AI commands to your own handlers, use the "With Registry" version on the dashboard under SDK / API Keys.

---

## Security Configuration

### Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Authentication
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
JWT_SECRET=your_jwt_secret_for_fallback_auth

# 🔒 Security & Encryption (REQUIRED for Production)
ENCRYPTION_KEY=your_32_character_encryption_key_here
# Generate with: openssl rand -hex 32

# AI/NLP Integration
GEMINI_API_KEY=your_google_gemini_api_key_here

# Development Configuration
NODE_ENV=development
SKIP_SAMPLE_DATA=false
RESET_DATA=false
```

### 🔐 Security Features

- **Bot Token Encryption**: All bot tokens are encrypted using AES-256 before storage
- **API Key Protection**: Gemini API keys are never logged or exposed
- **Secure Logging**: All sensitive data is masked in logs
- **Environment Security**: Comprehensive validation of security configuration

### 🛡️ Production Security Checklist

- [ ] Set strong `ENCRYPTION_KEY` (32 characters minimum)
- [ ] Use environment-specific API keys
- [ ] Enable HTTPS for all connections
- [ ] Regularly rotate encryption keys and API tokens
- [ ] Use secure secrets management (AWS Secrets Manager, etc.)
- [ ] Monitor logs for any potential security issues

### Development

Run the development server:
```
npm run dev
```

## Optional: Supabase (backend database)

The app can run with in-memory storage, Postgres, or Supabase. Supabase is **not required for the SDK**. If you want to use Supabase for the dashboard/backend data:

1. Create a Supabase project at [https://supabase.com](https://supabase.com)

2. Disable Row Level Security (RLS) for development:
   - Go to the Supabase Dashboard
   - Navigate to "Authentication" > "Policies"
   - For each table (users, bots, command_mappings, activities), disable RLS by clicking the toggle switch
   - In a production environment, you would want to create proper RLS policies instead

3. Run the SQL script in `setup-database.sql` in the Supabase SQL Editor to create the necessary tables

4. Create a `.env` file with your configuration (see Security Configuration above)

5. Start the app with `npm run dev`

Database Schema:
- `users`: Stores user information
- `bots`: Stores bot configurations linked to users (tokens encrypted)
- `command_mappings`: Stores command mappings linked to users and bots
- `activities`: Stores user activity logs

## Production Deployment

### Environment Variables for Production

```bash
# Generate secure encryption key
openssl rand -hex 32

# Set in your production environment
ENCRYPTION_KEY=<generated_key>
CLERK_SECRET_KEY=<production_clerk_key>
GEMINI_API_KEY=<production_gemini_key>
SUPABASE_URL=<production_supabase_url>             # optional
SUPABASE_ANON_KEY=<production_supabase_key>        # optional
NODE_ENV=production
```

### Security Best Practices

1. **Never commit secrets**: Use `.env` files locally, environment variables in production
2. **Rotate keys regularly**: Set up automated key rotation for production
3. **Monitor access**: Enable logging and monitoring for all API access
4. **Use HTTPS**: Always encrypt data in transit
5. **Backup encryption keys**: Store encryption keys securely with backup procedures

## License

MIT 