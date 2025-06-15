# Commandless - Conversational AI Bot Platform

Transform your Discord and Telegram bots from clunky slash commands to natural conversational AI.

## 🚀 Quick Deployment (Vercel + Sevalla)

### Frontend (Vercel)
1. Connect this repository to Vercel
2. Set environment variables:
   ```
   VITE_API_URL=https://your-backend.sevalla.app
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_key
   ```
3. Deploy - Vercel will automatically run `npm run vercel-build`

### Backend (Sevalla)
1. Connect this repository to Sevalla Application Hosting
2. Set build command: `docker build -t app .`
3. Set environment variables:
   ```
   CLERK_SECRET_KEY=sk_live_your_secret
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   ENCRYPTION_KEY=your_32_char_key
   GEMINI_API_KEY=your_gemini_key
   USE_SUPABASE=true
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```
4. Deploy

## 🏗️ Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.sample .env
# Edit .env with your values

# Start development server
npm run dev
```

## 🔧 Environment Variables

### Frontend (VITE_*)
- `VITE_API_URL` - Backend API URL
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk public key

### Backend
- `CLERK_SECRET_KEY` - Clerk secret key (must match frontend)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `ENCRYPTION_KEY` - 32-character encryption key
- `GEMINI_API_KEY` - Google Gemini API key
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

## 📚 Features

- **Natural Language Processing** - Convert user messages to bot commands
- **Multi-Platform Support** - Discord and Telegram bots
- **AI-Powered Intent Recognition** - Powered by Google Gemini
- **Real-time Command Mapping** - Visual command builder
- **Secure Authentication** - Clerk-based auth system

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **AI**: Google Gemini
- **Deployment**: Vercel (Frontend) + Sevalla (Backend)

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

## Security Configuration

### Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database Configuration
USE_SUPABASE=true
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Authentication
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
JWT_SECRET=your_jwt_secret_for_fallback_auth

# 🔒 Security & Encryption (REQUIRED for Production)
ENCRYPTION_KEY=your_32_character_encryption_key_here
# Generate with: openssl rand -hex 32

# AI/NLP Integration
GEMINI_API_KEY=your_google_gemini_api_key

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

## Supabase Setup

The app can use either in-memory storage or Supabase. To use Supabase:

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
SUPABASE_URL=<production_supabase_url>
SUPABASE_ANON_KEY=<production_supabase_key>
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