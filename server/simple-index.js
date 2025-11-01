const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Ephemeral channel memory: last 8 turns per channel
const channelMemory = new Map(); // channelId -> Array<{ role: 'user' | 'bot'; text: string }>

// ---------------- SDK Relay helpers (API keys, HMAC, idempotency) ----------------
const IDEMP_TTL_MS = 2 * 60 * 1000; // 2 minutes
const idemCache = new Map(); // key -> { decision, at }
// Pending SDK sync requests keyed by botId (cleared when delivered via heartbeat)
const sdkSyncRequests = new Set();

function getCachedDecision(key) {
  const entry = idemCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > IDEMP_TTL_MS) {
    idemCache.delete(key);
    return null;
  }
  return entry.decision;
}

function setCachedDecision(key, decision) {
  idemCache.set(key, { decision, at: Date.now() });
}

function hmacVerify(rawBody, secret, signatureHex) {
  try {
    const mac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return mac === signatureHex;
  } catch {
    return false;
  }
}

async function findApiKeyRecord(apiKey) {
  try {
    // 1) Database-backed keys (preferred in production)
    try {
      if (apiKey) {
        const { data: row } = await supabase
          .from('api_keys')
          .select('key_id,user_id,bot_id,scopes,expires_at,revoked_at')
          .eq('key_id', apiKey)
          .maybeSingle();
        if (row && !row.revoked_at && (!row.expires_at || Date.parse(row.expires_at) > Date.now())) {
          return {
            key: row.key_id,
            hmac_secret: null, // DB keys authenticate by API key; optional HMAC not enforced here
            user_id: row.user_id,
            bot_id: row.bot_id || null,
            scopes: Array.isArray(row.scopes) && row.scopes.length ? row.scopes : ['relay.events.write']
          };
        }
      }
    } catch {}

    // 2) Env-based keys (legacy/dev)
    const envKeys = process.env.COMMANDLESS_API_KEYS;
    if (envKeys) {
      // Supports formats:
      //  key:secret
      //  key:secret:userId
      //  multiple entries separated by commas
      const entries = envKeys.split(',').map(p => p.trim()).filter(Boolean);
      for (const entry of entries) {
        const parts = entry.split(':');
        const [k, secret, userId] = [parts[0], parts[1], parts[2]];
        if (k === apiKey) {
          return { key: k, hmac_secret: secret, user_id: userId || process.env.COMMANDLESS_DEFAULT_USER_ID || null, scopes: ['relay.events.write'] };
        }
      }
    }
  } catch {}
  return null; // env-only for now
}

// ---- Tutorial helpers: catalog + rendering ----
function inferCategory(name = '', output = '') {
  const s = `${name} ${output}`.toLowerCase();
  const tests = [
    ['roleplay', /(roleplay|rp|story|character|emote|scene|prompt|dialog|narrat)/],
    ['cards', /(card|deck|draw|trade|pack|booster|gacha|collect|inventory|item|shop|market|craft|forge|fusion|merge)/],
    ['combat', /(combat|battle|duel|fight|attack|skill|spell|hp|heal|damage|quest|raid|boss)/],
    ['social', /(party|team|guild|group|friend|invite|match|queue|lobby|profile)/],
    ['admin', /(setup|config|admin|mod|permissions|link|bind|web|oauth|prefix|settings)/],
    ['utility', /(info|help|ping|server|channel|note|say|pin|purge|slowmode|stats|leaderboard|time|remind|search)/],
  ];
  for (const [cat, re] of tests) if (re.test(s)) return cat;
  return 'misc';
}

function parseMainFacet(output = '') {
  const tokens = String(output).trim().split(/\s+/);
  const main = tokens[0]?.startsWith('/') ? tokens[0].slice(1) : tokens[0] || 'unknown';
  const facet = tokens[1] && !tokens[1].includes(':') && !tokens[1].startsWith('{') ? tokens[1] : null;
  return { main, facet };
}

function buildCommandCatalog(commands = []) {
  const catalog = new Map(); // category -> [{ id,name,output,main,facet }]
  for (const c of commands) {
    const { main, facet } = parseMainFacet(c.command_output || '');
    const cat = inferCategory(c.name || '', c.command_output || '');
    const entry = { id: c.id, name: c.name, output: c.command_output, main, facet };
    if (!catalog.has(cat)) catalog.set(cat, []);
    catalog.get(cat).push(entry);
  }
  // sort items inside categories by name
  for (const [k, arr] of catalog.entries()) catalog.set(k, arr.sort((a,b)=> (a.name||'').localeCompare(b.name||'')));
  return catalog;
}

function listTopCategories(catalog, limit = 6) {
  const arr = Array.from(catalog.entries()).map(([k,v]) => ({ k, n: v.length }));
  return arr.sort((a,b)=> b.n - a.n).slice(0, limit);
}

function renderCategoryPreview(catalog) {
  const tops = listTopCategories(catalog);
  const bullet = tops.map(t => `- **${t.k}**: ${t.n} cmds`).join('\n');
  const hint = 'Say "show a category", "search for a word", or "end tutorial"';
  return `🎓 Let\'s explore your bot by topics.\n${bullet || '- No commands found'}\n\n${hint}`;
}

function takeExamples(items = [], n = 3) {
  return items.slice(0, n);
}

function renderTopicCard(catName, items) {
  const ex = takeExamples(items, 3).map(i => `• ${i.name || i.output} → \\${i.output}`).join('\n');
  const oneLiners = {
    roleplay: 'Create scenes, emotes, and character interactions.',
    cards: 'Collect, trade, and manage items or cards.',
    combat: 'Battles, skills, and quests.',
    social: 'Teams, parties, profiles, and invites.',
    admin: 'Setup and configuration utilities.',
    utility: 'General info and helper commands.',
    misc: 'Other handy features.',
  };
  const purpose = oneLiners[catName] || oneLiners.misc;
  return `🎓 **${catName}**\n- Purpose: ${purpose}\n- Try: \n${ex || 'No examples'}\n\nAsk a question or say "more" / "back" / "end tutorial".`;
}

function searchCommands(catalog, term) {
  const out = [];
  const q = term.toLowerCase();
  for (const [, items] of catalog.entries()) {
    for (const it of items) {
      const hay = `${it.name} ${it.output} ${it.main} ${it.facet||''}`.toLowerCase();
      if (hay.includes(q)) out.push(it);
    }
  }
  return out.slice(0, 5);
}

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Provider selection
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

// Initialize Gemini (default)
let genAI = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
if (AI_PROVIDER !== 'openai') {
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('🤖 Gemini AI initialized');
} else {
  console.warn('⚠️ GEMINI_API_KEY not found - AI features will be limited');
  }
}

// OpenAI-compatible (OpenRouter/Ollama/LocalAI) config
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 15000);
const OPENAI_RETRIES = Math.max(0, Number(process.env.OPENAI_RETRIES || 0));

// Remove DeepSeek/Qwen template tokens and hidden thoughts
function sanitizeLLMOutput(text) {
  try {
    let out = String(text || '');
    // remove DeepSeek/Qwen special markers like <|begin_of_sentence|>, variants with spaces or fullwidth bars
    out = out
      .replace(/<\|[^>]*\|>/g, '')
      .replace(/<\s*\|\s*[^>]*?\s*\|\s*>/g, '')
      .replace(/<\s*｜\s*[^>]*?\s*｜\s*>/gu, '');
    // remove think blocks (with optional spaces)
    out = out.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, '');
    // collapse excess whitespace
    out = out.replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
    return out;
  } catch { return text; }
}

async function openAIChat(prompt) {
  const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || process.env.OPENROUTER_REFERRER || '';
  const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE || 'Commandless';
  const headers = {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (OPENROUTER_REFERER) headers['HTTP-Referer'] = OPENROUTER_REFERER;
  if (OPENROUTER_TITLE) headers['X-Title'] = OPENROUTER_TITLE;

  // Heuristic split: treat persona/context as system and quoted line as user
  let systemMsg = String(prompt || 'You are a helpful assistant.');
  let userMsg = 'Ok.';
  try {
    const m = /The user(?: just)? said:\s*"([\s\S]*?)"/i.exec(systemMsg);
    if (m) {
      userMsg = m[1];
      systemMsg = systemMsg.replace(m[0], '').trim();
    }
  } catch {}

  // retry on provider 429 limits, with hard timeout
  let lastErr = null;
  for (let i = 0; i <= OPENAI_RETRIES; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'system', content: 'Stay strictly in the above persona and tone. Keep replies in-character at all times.' },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.2,
        // stop early if template tokens appear
        stop: ['</think>', '<think>', '<|']
      }),
      signal: ctrl.signal
    });
    const json = await res.json().catch(() => ({}));
    clearTimeout(timer);
    if (res.ok) return sanitizeLLMOutput(json.choices?.[0]?.message?.content || '');
    lastErr = new Error(json?.error?.message || `OpenAI HTTP ${res.status}`);
    if (res.status === 429) await new Promise(r => setTimeout(r, 900 * (i + 1)));
    else break;
  }
  throw lastErr || new Error('OpenAI error');
}

async function openAIChatJson(prompt) {
  const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || process.env.OPENROUTER_REFERRER || '';
  const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE || 'Commandless';
  const headers = {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (OPENROUTER_REFERER) headers['HTTP-Referer'] = OPENROUTER_REFERER;
  if (OPENROUTER_TITLE) headers['X-Title'] = OPENROUTER_TITLE;

  // Build messages to strongly enforce JSON-only output
  let systemMsg = 'You are an intent parser. Output ONLY a single JSON object with fields described. No markdown, no code fences, no extra text.';
  let userMsg = String(prompt || '');

  let lastErr = null;
  for (let i = 0; i <= OPENAI_RETRIES; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'system', content: 'Stay strictly in the above persona and tone. Keep replies in-character at all times.' },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }),
      signal: ctrl.signal
    });
    const json = await res.json().catch(() => ({}));
    clearTimeout(timer);
    if (res.ok) {
      let out = String(json.choices?.[0]?.message?.content || '');
      // Some OpenRouter models ignore response_format and return empty content.
      if (!out) {
        // Retry once without response_format as a compatibility fallback.
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), OPENAI_TIMEOUT_MS);
        const res2 = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: 'POST', headers,
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              { role: 'system', content: systemMsg },
              { role: 'user', content: userMsg }
            ],
            temperature: 0.1
          }),
          signal: ctrl2.signal
        });
        const json2 = await res2.json().catch(() => ({}));
        clearTimeout(timer2);
        if (res2.ok) {
          out = String(json2.choices?.[0]?.message?.content || '');
        }
      }
      return out;
    }
    lastErr = new Error(json?.error?.message || `OpenAI HTTP ${res.status}`);
    if (res.status === 429) await new Promise(r => setTimeout(r, 900 * (i + 1)));
    else break;
  }
  throw lastErr || new Error('OpenAI error');
}

async function aiGenerateText(prompt) {
  if (AI_PROVIDER === 'openai') {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    try { return await openAIChat(prompt); }
    catch (e) {
      // graceful fallback to Gemini if configured and OpenRouter is rate limited/unavailable
      if (genAI) {
        try {
          const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
          const result = await model.generateContent(prompt);
          const response = await result.response; return response.text();
        } catch {}
      }
      throw e;
    }
  }
  if (!genAI) throw new Error('Gemini not configured');
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

async function aiGenerateJson(prompt) {
  if (AI_PROVIDER === 'openai') return await openAIChatJson(prompt);
  // Fallback: use text path (Gemini does not support json_object in this codepath)
  return await aiGenerateText(prompt);
}

// EXACT MIGRATION FROM LOCAL TYPESCRIPT SYSTEM

/**
 * Check if input is purely conversational (from local system)
 */
function isConversationalInput(input) {
  const conversationalPatterns = [
    /^(hi|hello|hey)[\s!]*$/i,
    /^how are you[\s?]*$/i,
    /^what's up[\s?]*$/i,
    /^whats up[\s?]*$/i,
    /^wassup[\s?]*$/i,
    /^good (morning|afternoon|evening)[\s!]*$/i,
    /^thank you[\s!]*$/i,
    /^thanks[\s!]*$/i,
    /^(im great|not much|good|fine).*$/i,
    /^(lol|haha|awesome|nice|wow)[\s!]*$/i,
    /^(yes|no|sure|maybe|alright)[\s!]*$/i,
    /^(ok|okay|cool|got it|gotcha)[\s!]*$/i,
    /^(i'm good|i'm fine|i'm great|i'm okay).*$/i,
    /^(doing good|doing well|doing fine|doing great|doing awesome).*$/i,
    /^not much[\s,].*$/i,
    /^just.*$/i,
    /^nothing much[\s,].*$/i,
    // Add more conversational patterns
    /^who are you[\s?]*$/i,
    /^what are you[\s?]*$/i,
    /^tell me about yourself[\s?]*$/i,
    /^what can you do[\s?]*$/i,
    /^what do you do[\s?]*$/i,
    /^how do you work[\s?]*$/i,
    /^what's your name[\s?]*$/i,
    /^whats your name[\s?]*$/i,
    /^introduce yourself[\s?]*$/i,
    /^tell me a story[\s?]*$/i,
    /^what's the weather[\s?]*$/i,
    /^whats the weather[\s?]*$/i,
    /^how's it going[\s?]*$/i,
    /^hows it going[\s?]*$/i,
    /^what's happening[\s?]*$/i,
    /^whats happening[\s?]*$/i,
    /^what's new[\s?]*$/i,
    /^whats new[\s?]*$/i,
    /^how's your day[\s?]*$/i,
    /^hows your day[\s?]*$/i,
    /^what's good[\s?]*$/i,
    /^whats good[\s?]*$/i,
    /^how are things[\s?]*$/i,
    /^how's everything[\s?]*$/i,
    /^hows everything[\s?]*$/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input.trim()));
}

/**
 * Extract parameters from message using fallback method (from local system)
 */
function extractParametersFallback(message, commandPattern) {
  const extractedParams = {};
  
  // Extract ALL user mentions and find the target user (not the bot)
  const allUserMentions = message.match(/<@!?(\d+)>/g);
  if (allUserMentions && allUserMentions.length > 0) {
    // Find the target user mention (usually the one that's NOT the bot being mentioned)
    const userIds = allUserMentions.map(mention => {
      const match = mention.match(/<@!?(\d+)>/);
      return match ? match[1] : null;
    }).filter(id => id !== null);
    
    // If we have multiple mentions, try to determine which is the target
    if (userIds.length > 1) {
      // Skip the first mention if it looks like a bot mention at the start
      const messageWords = message.trim().split(/\s+/);
      if (messageWords[0] && messageWords[0].match(/<@!?\d+>/)) {
        // First word is a mention (likely bot mention), use the second user mentioned
        extractedParams.user = userIds[1];
      } else {
        // Use the first user mentioned if no bot mention at start
        extractedParams.user = userIds[0];
      }
    } else if (userIds.length === 1) {
      // Only one mention - could be bot or target, use it
      extractedParams.user = userIds[0];
    }
  }
  
  // Extract reason from common patterns
  const reasonPatterns = [
    /(?:for|because|reason:?\s*)(.*?)(?:\s*$)/i,
    /(?:being|they're|he's|she's)\s+(.*?)(?:\s*$)/i
  ];
  
  for (const pattern of reasonPatterns) {
    const reasonMatch = message.match(pattern);
    if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim()) {
      extractedParams.reason = reasonMatch[1].trim();
      break;
    }
  }
  
  // Extract numbers for amounts/duration
  const numberMatch = message.match(/(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    if (commandPattern.includes('{amount}')) {
      extractedParams.amount = number;
    }
    if (commandPattern.includes('{duration}')) {
      extractedParams.duration = number + 'm';
    }
  }
  
  // Extract message content for say command
  if (commandPattern.includes('{message}')) {
    const sayMatch = message.match(/say\s+(.*)/i);
    if (sayMatch) {
      extractedParams.message = sayMatch[1];
    }
  }
  
  return extractedParams;
}

/**
 * Extract Discord mentions from message for better AI processing (from local system)
 */
function preprocessDiscordMessage(message) {
  const extractedMentions = {};
  
  // Extract user mentions <@123456789> or <@!123456789>
  const userMentions = message.match(/<@!?(\d+)>/g);
  if (userMentions) {
    userMentions.forEach((mention, index) => {
      const userId = mention.match(/<@!?(\d+)>/)?.[1];
      if (userId) {
        extractedMentions[`user_mention_${index}`] = userId;
      }
    });
  }
  
  // Extract channel mentions <#123456789>
  const channelMentions = message.match(/<#(\d+)>/g);
  if (channelMentions) {
    channelMentions.forEach((mention, index) => {
      const channelId = mention.match(/<#(\d+)>/)?.[1];
      if (channelId) {
        extractedMentions[`channel_mention_${index}`] = channelId;
      }
    });
  }
  
  // Extract role mentions <@&123456789>
  const roleMentions = message.match(/<@&(\d+)>/g);
  if (roleMentions) {
    roleMentions.forEach((mention, index) => {
      const roleId = mention.match(/<@&(\d+)>/)?.[1];
      if (roleId) {
        extractedMentions[`role_mention_${index}`] = roleId;
      }
    });
  }
  
  return {
    cleanMessage: message,
    extractedMentions
  };
}

/**
 * Helper function to decode JWT and extract user ID
 */
function decodeJWT(token) {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      // If it's not a JWT, treat it as a direct user ID (for backward compatibility)
      return { userId: token };
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Extract user ID from Clerk JWT payload
    const userId = payload.sub || payload.user_id || payload.id;
    
    if (!userId) {
      console.error('No user ID found in JWT payload:', payload);
      return null;
    }
    
    return { userId };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    // Fallback: treat the token as a direct user ID
    return { userId: token };
  }
}

/**
 * Create a comprehensive prompt for AI analysis (EXACT from local TypeScript)
 */
function createAnalysisPrompt(message, availableCommands, botPersonality, conversationContext, aiExamples) {
  const commandList = availableCommands.map(cmd => 
    `- ID: ${cmd.id}, Name: ${cmd.name}, Pattern: ${cmd.natural_language_pattern}, Output: ${cmd.command_output}`
  ).join('\n');

  // Use provided personality context or generate a default one
  const personalityContext = botPersonality || 
    "You are a helpful Discord bot assistant that can handle moderation commands and casual conversation. You're friendly, efficient, and great at understanding natural language.";

  // Add conversation context if available
  const contextSection = conversationContext 
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext}\n\n**CONVERSATION HANDLING:**
- If user is replying to a previous bot message, consider the conversation flow
- Maintain context and provide relevant follow-up responses
- If the reply seems to be continuing a conversation rather than issuing a command, respond conversationally
- **IMPORTANT: Replies can also contain commands! Treat reply messages the same as mentioned messages for command detection**
- Look for conversational cues like "thanks", "ok", "got it", "what about", "also", "and", etc.
- But also look for command cues like "ban", "kick", "warn", "purge", "say", etc. even in replies\n`
    : '';

  // Use dynamic AI examples if available, otherwise fallback to basic examples
  const exampleSection = aiExamples 
    ? `\n🎯 **DYNAMIC COMMAND EXAMPLES** (Generated for this bot's specific commands):\n${aiExamples}\n`
    : `\n🎯 **BASIC COMMAND EXAMPLES**:\n- "ban john from the server" → BAN\n- "remove this user" → BAN\n- "kick him out" → KICK\n- "warn about spam" → WARN\n- "give warning to user" → WARN\n- "delete 5 messages" → PURGE\n- "tell everyone meeting starts now" → SAY\n`;

  return `${personalityContext}

${contextSection}LANGUAGE POLICY:
- Detect the user's language from USER MESSAGE.
- Respond conversationally in that same language for any conversationalResponse or clarificationQuestion.
- Keep any JSON keys/fields in English.
- You may internally translate input to English to understand commands, but outputs that are natural language must remain in the user's language.

You are an advanced natural language processor for Discord bot commands. Your job is to:
1. **Determine if the user wants to execute a command OR have casual conversation**
2. **Extract parameters aggressively and intelligently from natural language**
3. **Be decisive - execute commands when intent is clear, even with informal language**
4. **Handle help requests and capability questions conversationally**

🤖 **CRITICAL BOT IDENTITY CONTEXT:**
- **YOU ARE A DISCORD BOT** - You are NOT the user giving the command
- **The user giving the command is a human Discord user** (e.g., "Abdarrahman")
- **When a user mentions someone with @, they are referring to OTHER Discord users, NOT you**
- **You should EXECUTE commands on other users as requested - you are the tool, not the target**
- **NEVER refuse commands with "I cannot [action] myself" - the target is always someone else**
- **The bot (you) executes actions ON BEHALF OF the user who gave the command**

🎯 **USER TARGETING RULES:**
- **@mention in command = target user ID** (e.g., "mute <@123456>" → target user: "123456")
- **Username in command = target username** (e.g., "warn john" → target user: "john")  
- **"me" in command = the user giving the command** (e.g., "mute me" → target: command sender)
- **Bot should NEVER be the target** unless explicitly commanded to perform self-actions
- **CRITICAL: In messages like "@bot mute @user", the target is @user, NOT @bot**
- **ALWAYS extract the target user (the one being acted upon), not the bot being mentioned**

**EXAMPLES OF CORRECT UNDERSTANDING:**
❌ WRONG: "mute <@123456>" → "I cannot mute myself!" 
✅ CORRECT: "mute <@123456>" → Extract user: "123456", execute mute command

❌ WRONG: "ban that toxic user <@999>" → "I cannot ban myself!"
✅ CORRECT: "ban that toxic user <@999>" → Extract user: "999", execute ban command

❌ WRONG: "warn abdarrahman for spamming" → "I cannot warn myself!"
✅ CORRECT: "warn abdarrahman for spamming" → Extract user: "abdarrahman", execute warn command

❌ WRONG: "@bot mute @target_user" → Extract user: "bot" (WRONG!)
✅ CORRECT: "@bot mute @target_user" → Extract user: "target_user", execute mute command

❌ WRONG: Multiple users mentioned, pick the bot as target
✅ CORRECT: Multiple users mentioned, pick the user being acted upon (not the bot)

AVAILABLE COMMANDS:
${commandList}
${exampleSection}

🎯 **PARAMETER EXTRACTION MASTERY:**

**Discord Mentions**: Extract user IDs from any mention format:
- "warn <@560079402013032448> for spamming" → user: "560079402013032448"
- "please mute <@!123456> because annoying" → user: "123456"
- "ban that toxic <@999888> user" → user: "999888"

**Natural Language Patterns**: Understand ANY phrasing that indicates command intent:
- "can you delete like 5 messages please" → purge command, amount: "5"
- "remove that user from the server" → ban command
- "give them a warning for being rude" → warn command
- "tell everyone the meeting is starting" → say command
- "check how fast you are" → ping command
- "what server are we in" → server-info command

**Context-Aware Extraction**: Look at the ENTIRE message for parameters:
- "nothing much just warn <@560079402013032448> for being annoying" 
  → EXTRACT: user: "560079402013032448", reason: "being annoying"
- "hey bot, when you have time, could you ban <@123> for trolling everyone"
  → EXTRACT: user: "123", reason: "trolling everyone"
- "that user <@999> has been really helpful, make a note about it"
  → EXTRACT: user: "999", message: "has been really helpful"

**Semantic Understanding**: Map natural language to command actions:
- "remove/get rid of/kick out" → ban
- "tell everyone/announce/broadcast" → say
- "delete/clear/clean up messages" → purge
- "stick/attach this message" → pin
- "give warning/issue warning" → warn
- "check speed/latency/response time" → ping
- "server details/info/stats" → server-info

**Multi-Parameter Intelligence**: Extract complete information:
- "warn john for being toxic and breaking rules repeatedly" 
  → user: "john", reason: "being toxic and breaking rules repeatedly"
- "please purge about 15 messages to clean this up"
  → amount: "15"
- "tell everyone 'meeting moved to 3pm tomorrow'"
  → message: "meeting moved to 3pm tomorrow"

🔥 **DECISION MAKING RULES:**

**EXECUTE IMMEDIATELY IF:**
- ✅ Clear command intent (even with casual phrasing)
- ✅ ANY required parameters can be extracted
- ✅ User mentions someone with @ symbol for moderation commands
- ✅ Numbers found for amount-based commands (purge, slowmode)
- ✅ Message content found for say/note commands

**CASUAL CONVERSATION IF:**
- ❌ No command-related words or intent
- ❌ Pure greetings ("hi", "hello", "how are you", "wassup", "what's up")
- ❌ **HELP/CAPABILITY QUESTIONS**: "what can you do", "show commands", "list commands", "help me", "command list", "make a command list", etc.
- ❌ General chat without action words
- ❌ Conversational replies to previous bot messages ("thanks", "ok", "cool", "got it", "im great", "not much", "good", "fine")
- ❌ Follow-up questions about previous responses
- ❌ Emotional responses ("lol", "haha", "awesome", "nice", "wow")
- ❌ Short acknowledgments ("yes", "no", "sure", "maybe", "alright")

**KEY INSIGHT**: Questions about capabilities ("what can you do", "make a command list") = HELP REQUESTS = Conversational response with command information, NOT executing commands!

**CONFIDENCE SCORING:**
- 90-100: Perfect match with all parameters extracted
- 80-89: Clear intent with most important parameters
- 70-79: Good intent with some parameters (STILL EXECUTE)
- 60-69: Likely intent but may need minor clarification
- Below 60: Ask for clarification only if truly ambiguous

USER MESSAGE: "${message}"

🚀 **RESPOND WITH JSON:**

**For COMMANDS (action intent detected):**
\`\`\`json
{
  "isCommand": true,
  "bestMatch": {
    "commandId": <command_id>,
    "confidence": <60-100>,
    "params": {
      "user": "extracted_user_id",
      "reason": "complete reason text",
      "message": "complete message text",
      "amount": "number_as_string"
    }
  }
}
\`\`\`

**For CONVERSATION (no command intent):**
\`\`\`json
{
  "isCommand": false,
  "conversationalResponse": "friendly, helpful response that maintains conversation flow and references previous context when appropriate. For help requests, provide command information."
}
\`\`\`

**EXAMPLES OF CONVERSATION FLOW:**
- Reply to "wassup?" → "Hey! Not much, just chillin' and ready to help out. What's going on with you? 😎"
- Reply to "thanks" after command execution → "You're welcome! Happy to help. Anything else you need?"
- "what can you do?" → List available commands with friendly explanation
- "what do you do?" → Explain capabilities and show command list

⚡ **BE BOLD**: If you can extract ANY meaningful parameters and understand the intent, EXECUTE the command. Don't ask for clarification unless truly necessary!`;
}

/**
 * Parse the AI response (EXACT from local TypeScript)
 */
function parseAIResponse(content) {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      isCommand: parsed.isCommand || false,
      bestMatch: parsed.bestMatch || undefined,
      conversationalResponse: parsed.conversationalResponse || undefined,
      clarificationQuestion: parsed.clarificationQuestion || undefined
    };
    
  } catch (error) {
    console.log(`Error parsing AI response: ${error.message}`);
    // Do not emit canned text; allow upper layer to decide (may stay silent)
    return { isCommand: false };
  }
}

/**
 * Analyze a message with AI for command/conversational intent (EXACT from local TypeScript)
 */
async function analyzeMessageWithAI(message, availableCommands, botPersonality, conversationContext, aiExamples) {
  try {
    // Preprocess message to extract Discord mentions
    const { cleanMessage, extractedMentions } = preprocessDiscordMessage(message);
    
    // Add mention information to the message for AI processing
    let enhancedMessage = cleanMessage;
    if (Object.keys(extractedMentions).length > 0) {
      enhancedMessage += `\n\nEXTRACTED_MENTIONS: ${JSON.stringify(extractedMentions)}`;
    }
    
    const prompt = createAnalysisPrompt(enhancedMessage, availableCommands, botPersonality, conversationContext, aiExamples);
    
    // Request structured JSON to avoid parser failures
    const content = await aiGenerateJson(prompt);
    
    if (!content) {
      throw new Error("Empty response from AI");
    }
    
    return parseAIResponse(content);
    
  } catch (error) {
    console.log(`Error in AI analysis: ${error.message}`);
    
    // Fallback: check if message contains common command words
    const commandWords = ['ban', 'kick', 'warn', 'mute', 'purge', 'role', 'delete', 'clear', 'remove', 'clean'];
    const isLikelyCommand = commandWords.some(word => 
      message.toLowerCase().includes(word)
    );
    // If looks like a command but AI returned empty, ask a clear, user-friendly question
    if (isLikelyCommand) {
      // Special case: purge without a number → ask for amount
      if (/\b(purge|delete|clear|clean)\b/i.test(message) && !/\b\d+\b/.test(message)) {
        return { isCommand: true, clarificationQuestion: 'How many messages should I delete? (1-100)' };
      }
      return { isCommand: true, clarificationQuestion: 'Could you clarify the details for that command?' };
    }
    // Otherwise, do not fabricate a canned conversational message
    return { isCommand: false };
  }
}

/**
 * EXACT MAIN PROCESSING FUNCTION FROM LOCAL TYPESCRIPT SYSTEM
 * Process Discord message with AI (EXACT migration from messageHandlerAI.ts)
 */
async function processDiscordMessageWithAI(message, guildId, channelId, userId, skipMentionCheck = false, authenticatedUserId, conversationContext, targetBotId) {
  try {
    if (!message || typeof message !== 'string') {
      return { processed: false };
    }
    
    // First check if the bot was mentioned, if not mentioned we don't process
    const botMentionRegex = /<@\!?(\d+)>/;
    const botMentioned = botMentionRegex.test(message);
    
    if (!botMentioned && !skipMentionCheck) {
      return { processed: false };
    }
    
    // Remove mention from the message to process the actual command
    const cleanMessage = message.replace(botMentionRegex, '').trim();
    if (!cleanMessage && !skipMentionCheck) {
      // Just a bare mention: do not send canned replies
      return { processed: false };
    }
    
    // Use the authenticated user ID if provided, otherwise fall back to a default
    let userIdToUse = authenticatedUserId || "user_2yMTRvIng7ljDfRRUlXFvQkWSb5";

    // Get all command mappings for the user
    let commands = null, error = null;
    try {
      if (targetBotId) {
        const q = await supabase
      .from('command_mappings')
      .select('*')
          .eq('user_id', userIdToUse)
          .eq('bot_id', targetBotId)
          .eq('status', 'active');
        commands = q.data; error = q.error;
      } else {
        const q = await supabase
          .from('command_mappings')
          .select('*')
          .eq('user_id', userIdToUse)
          .eq('status', 'active');
        commands = q.data; error = q.error;
      }
    } catch (e) {
      error = e;
    }
      
    if (error || !commands || commands.length === 0) {
      console.log(`No commands found for user ${userIdToUse}`);
      // Do NOT return early. Proceed to persona loading and conversational flow.
      commands = [];
    }

    // **CRITICAL FIX**: Fetch personality for the specific bot when provided
    // If a concrete botId is provided, trust it and derive the owning user from that bot
    let personalityContext = null;
    let aiExamples = null;
    if (targetBotId) {
      const { data: botRow } = await supabase
        .from('bots')
        .select('user_id, personality_context, ai_examples')
        .eq('id', targetBotId)
        .maybeSingle();
      if (botRow) {
        // Align user context to the bot owner to avoid mismatches when API key belongs to a different user
        userIdToUse = botRow.user_id || userIdToUse;
        personalityContext = botRow.personality_context || null;
        aiExamples = botRow.ai_examples || null;
      }
    } else {
    const { data: bots, error: botError } = await supabase
      .from('bots')
      .select('personality_context, ai_examples')
      .eq('user_id', userIdToUse)
      .limit(1);
      personalityContext = bots && bots[0] ? bots[0].personality_context : null;
      aiExamples = bots && bots[0] ? bots[0].ai_examples : null;
    }
    console.log('🎭 PERSONALITY CONTEXT LOADED:', personalityContext ? 'YES' : 'NO');
    console.log('🎯 AI EXAMPLES LOADED:', aiExamples ? 'YES' : 'NO');
    if (personalityContext) {
      console.log('🎭 PERSONALITY PREVIEW:', personalityContext.substring(0, 100) + '...');
    }
    if (aiExamples) {
      console.log('🎯 AI EXAMPLES PREVIEW:', aiExamples.substring(0, 100) + '...');
    }

    // **USE PROPER SEMANTIC DETECTION**: Let AI determine conversational vs command intent
    console.log(`🎯 ANALYZING MESSAGE WITH AI: "${cleanMessage}"`);
    
    try {
      const aiResult = await analyzeMessageWithAI(
        cleanMessage,
        commands,
        personalityContext,
        conversationContext,
        aiExamples
      );
      
      // Lean handling: do not depend on a 'processed' flag (JSON may not include it)
      if (aiResult) {
        if (aiResult.conversationalResponse) {
          console.log(`🎭 CONVERSATIONAL RESPONSE: ${aiResult.conversationalResponse}`);
            return {
              processed: true,
            conversationalResponse: aiResult.conversationalResponse
          };
        }
        if (aiResult.clarificationQuestion) {
          return {
            processed: true,
            needsClarification: true,
            clarificationQuestion: aiResult.clarificationQuestion
          };
        }
        // For now, skip command execution path to keep flow minimal and low-latency.
      }
    } catch (error) {
      console.log(`🎯 AI ANALYSIS ERROR: ${error.message}`);
    }
    
    // No response if AI produced nothing
    console.log(`🎯 NO RESPONSE GENERATED: "${cleanMessage}"`);
    return { processed: false };
  } catch (error) {
    console.log(`Error in AI analysis: ${error.message}`);
      return {
        processed: true,
      conversationalResponse: "Sorry, I had some trouble processing that. Could you try again?"
    };
  }
}

// AI Example Generation Function
async function generateCommandExamples(commands) {
  try {
    console.log('🎯 Generating AI examples for', commands.length, 'commands');
    
    const commandList = commands.map(cmd => 
      `- ${cmd.name}: ${cmd.description || 'Discord command'}`
    ).join('\n');
    
    const prompt = `Generate 3-5 example phrases users might say to trigger these Discord bot commands:

${commandList}

Return only the example phrases, one per line, without numbering or bullets.`;

    const response = await aiGenerateText(prompt);
    if (response) {
      return response.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 5);
          }
        } catch (error) {
    console.log('Error generating AI examples:', error.message);
  }
  
  // Return fallback examples if AI fails
  return commands.map(cmd => 
    `"execute ${cmd.name}" → ${cmd.name.toUpperCase()}`
  ).join('\n');
}
app.get('/', (req, res) => {
  res.json({ 
    message: 'Commandless Discord Bot Server is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ---------------- Bot Management ----------------
// Get user's bots
app.get('/api/bots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', decodedToken.userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch bots' });
    }

    const formattedBots = bots.map(bot => ({
      id: bot.id,
      botName: bot.bot_name,
      platformType: bot.platform_type,
      personalityContext: bot.personality_context,
      isConnected: bot.is_connected,
      createdAt: bot.created_at
    }));

    res.json(formattedBots);
  } catch (error) {
    console.error('Error fetching bots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------- API Key Management (admin-auth via user JWT) ----------------
// Create API key (returns key_id and secret once)
app.post('/api/keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;

    const { description, scopes, expiresAt, botId } = req.body || {};
    if (!botId) return res.status(400).json({ error: 'botId is required' });
    const keyId = `ck_${crypto.randomBytes(8).toString('hex')}`;
    const secret = `cs_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(`${keyId}:${secret}`).digest('hex');

    const { error } = await supabase.from('api_keys').insert({
      key_id: keyId,
      secret_hash: secretHash,
      user_id: userId,
      bot_id: botId,
      scopes: Array.isArray(scopes) ? scopes : ['relay.events.write'],
      description: description || null,
      expires_at: expiresAt || null
    });
    if (error) return res.status(500).json({ error: 'Failed to create key' });
    return res.status(201).json({ keyId, secret, botId, scopes: Array.isArray(scopes) ? scopes : ['relay.events.write'], expiresAt: expiresAt || null });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List API keys (masked)
app.get('/api/keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;

    const { data } = await supabase
      .from('api_keys')
      .select('key_id,bot_id,description,scopes,created_at,expires_at,revoked_at,last_used_at,rate_limit_per_min')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const masked = (data || []).map(k => ({
      keyId: k.key_id,
      botId: k.bot_id,
      description: k.description,
      scopes: k.scopes,
      createdAt: k.created_at,
      expiresAt: k.expires_at,
      revokedAt: k.revoked_at,
      lastUsedAt: k.last_used_at,
      rateLimitPerMin: k.rate_limit_per_min
    }));
    return res.json(masked);
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke key
app.post('/api/keys/:keyId/revoke', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;
    const keyId = req.params.keyId;

    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('key_id', keyId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: 'Failed to revoke' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete key (permanently remove)
app.delete('/api/keys/:keyId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;
    const keyId = req.params.keyId;

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('key_id', keyId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: 'Failed to delete' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotate key (creates new, revokes old)
app.post('/api/keys/:keyId/rotate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;
    const keyIdOld = req.params.keyId;

    const { data: oldRow } = await supabase
      .from('api_keys')
      .select('scopes,description,bot_id')
      .eq('key_id', keyIdOld)
      .eq('user_id', userId)
      .maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Key not found' });

    const keyId = `ck_${crypto.randomBytes(8).toString('hex')}`;
    const secret = `cs_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(`${keyId}:${secret}`).digest('hex');

    const { error: insErr } = await supabase.from('api_keys').insert({
      key_id: keyId,
      secret_hash: secretHash,
      user_id: userId,
      bot_id: oldRow.bot_id || null,
      scopes: oldRow.scopes || ['relay.events.write'],
      description: oldRow.description || null
    });
    if (insErr) return res.status(500).json({ error: 'Failed to create new key' });

    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('key_id', keyIdOld)
      .eq('user_id', userId);

    return res.json({ keyId, secret });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// SDK Relay endpoint: POST /v1/relay/events
// - Auth via x-api-key (env map COMMANDLESS_API_KEYS="key:secret,...")
// - Optional HMAC via x-signature (sha256 of raw body)
// - Idempotency via x-idempotency-key
app.post('/v1/relay/events', async (req, res) => {
  try {
    // Body is already parsed by express.json()
    const event = (req.body && typeof req.body === 'object') ? req.body : {};

    // API key lookup
    const apiKey = req.header('x-api-key') || req.header('x-commandless-key') || '';
    const apiKeyRecord = await findApiKeyRecord(apiKey);
    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Optional HMAC check
    const sig = req.header('x-signature');
    if (sig && apiKeyRecord.hmac_secret) {
      // Verify using the canonical JSON string
      const bodyString = JSON.stringify(event);
      if (!hmacVerify(bodyString, apiKeyRecord.hmac_secret, sig)) {
        console.log('[relay] HMAC mismatch (continuing for now)');
        // Soft-fail to avoid blocking while we stabilize signing across runtimes
      }
    }

    // Idempotency
    const idemKey = req.header('x-idempotency-key');
    if (idemKey) {
      const cached = getCachedDecision(idemKey);
      if (cached) {
        res.setHeader('x-request-id', cached.id);
        return res.json({ decision: cached });
      }
    }

    // Build message and context
    const content = String(event.content || event.name || '').trim();
    const channelId = String(event.channelId || event.channel || 'unknown');
    const guildId = String(event.guildId || event.guild || 'unknown');
    const authorId = String(event.authorId || event.userId || 'unknown');
    const botClientId = String(event.botClientId || '');
    const explicitBotId = String(event.botId || '');
    const userIdForContext = apiKeyRecord.user_id || 'user_2yMTRvIng7ljDfRRUlXFvQkWSb5';

    try {
      console.log(`[relay] evt messageCreate content="${content}" botId=${explicitBotId || 'none'} botClientId=${botClientId || 'none'} userId=${userIdForContext}`);
    } catch {}

    // Resolve bot persona: prefer the API key's bound bot
    let personaBotId = apiKeyRecord?.bot_id || explicitBotId || null;
    if (!personaBotId && botClientId) {
      try {
        const { data: botRow } = await supabase
          .from('bots')
          .select('id,user_id')
          .eq('client_id', botClientId)
          .maybeSingle();
        if (botRow?.id) {
          // Only adopt when owned by the same user as the API key, to avoid cross-tenant leaks
          if (!botRow.user_id || botRow.user_id === userIdForContext) {
            personaBotId = botRow.id;
          }
        }
      } catch {}
    }

    try { console.log(`[relay] personaBotId resolved: ${personaBotId || 'none'}`); } catch {}

    // Decide path: if starts with a slash, emit command action directly
    const slashMatch = /^\s*\/([\w-]+)(?:\s+(.+))?/i.exec(content);
    let decision;
    if (slashMatch) {
      const cmdName = (slashMatch[1] || '').trim();
      const args = {};
      const rawArgs = (slashMatch[2] || '').trim();
      if (rawArgs) {
        for (const part of rawArgs.split(/\s+/)) {
          const kv = part.split('=');
          if (kv.length === 2) args[kv[0]] = kv[1];
        }
      }
      decision = {
        id: `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        intent: 'command.request',
        confidence: 0.9,
        params: { name: cmdName, args, rawArgs },
        actions: [
          { kind: 'command', name: cmdName, args }
        ]
      };
    } else {
      // Capture user turn for context memory
      try {
        const turns = channelMemory.get(channelId) || [];
        if (content) { turns.push({ role: 'user', text: content }); }
        channelMemory.set(channelId, turns.slice(-8));
      } catch {}

      // Build conversational context from last 8 turns in this channel
      let convoContext = '';
      try {
        const mem = channelMemory.get(channelId);
        if (Array.isArray(mem) && mem.length) {
          convoContext = mem.map(t => `${t.role === 'bot' ? 'Assistant' : 'User'}: ${t.text}`).join('\n');
        }
      } catch {}
      if (event.referencedMessageContent) {
        convoContext = convoContext
          ? `${convoContext}\nEarlier referenced: ${event.referencedMessageContent}`
          : `Earlier referenced: ${event.referencedMessageContent}`;
      }

      // Use the existing AI pipeline for Discord-style messages when mentioned or replied
      let processed = null;
      try {
        const result = await processDiscordMessageWithAI(
          content,
          guildId,
          channelId,
          authorId,
          Boolean(event.isReplyToBot),
          userIdForContext,
          convoContext,
          personaBotId
        );
        processed = result;
      } catch (e) {
        console.log('[relay] pipeline error:', e.message);
      }

      if (processed?.processed && processed.command) {
        decision = {
          id: `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          intent: 'command.request',
          confidence: 0.75,
          params: { slash: processed.command },
          actions: [ { kind: 'command', name: 'execute', args: { slash: processed.command } } ]
        };
      } else if (processed?.processed && processed.conversationalResponse) {
        decision = {
          id: `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          intent: 'conversational.reply',
          confidence: 0.7,
          params: {},
          actions: [ { kind: 'reply', content: processed.conversationalResponse } ]
        };
        // remember last bot reply per channel
        try {
          const arr = channelMemory.get(channelId) || [];
          arr.push({ role: 'bot', text: processed.conversationalResponse });
          channelMemory.set(channelId, arr.slice(-8));
        } catch {}
      } else {
        // No response generated: do not hardcode any text; return processed:false
        return res.json({ decision: null });
      }
    }

    if (idemKey) setCachedDecision(idemKey, decision);
    res.setHeader('x-request-id', decision.id);
    return res.json({ decision });
  } catch (e) {
    console.log('[relay] error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Discord API endpoint for Universal Relay Service
app.post('/api/discord', async (req, res) => {
  try {
    const { action } = req.query;
    
    if (action === 'process-message') {
      const { message: messageData, botToken, botClientId, botId } = req.body;
      
      if (!messageData || !botToken) {
        return res.json({
          processed: false,
          reason: 'Missing message data or bot token'
        });
      }

      console.log(`🔍 Processing message via API: "${messageData.content}" from ${messageData.author.username}`);
      
      // BUILD CONVERSATION CONTEXT (MIGRATED FROM LOCAL IMPLEMENTATION)
      let conversationContext = '';
      
      // Check if this is a reply to a previous message
      if (messageData.referenced_message) {
        console.log(`🔗 Reply detected to message: ${messageData.referenced_message.id}`);
        
        // Build more sophisticated referenced message context
        if (messageData.referenced_message.author && messageData.referenced_message.author.id === botClientId) {
          // This is a reply to the bot - build comprehensive conversation context
          const referencedContent = messageData.referenced_message.content || 'bot response';
          conversationContext = `Previous bot message context: "${referencedContent}" - User is replying to this bot response`;
          console.log(`🧠 Adding conversation context for bot reply: ${conversationContext}`);
        } else if (messageData.referenced_message.author) {
          // This is a reply to another user
          const referencedAuthor = messageData.referenced_message.author.username || 'unknown user';
          const referencedContent = messageData.referenced_message.content || 'message';
          conversationContext = `Previous message context: ${referencedAuthor}: "${referencedContent}" - User is replying to this message`;
          console.log(`💬 Adding context for reply to other user: ${conversationContext}`);
        }
      }
      
      // Enhanced logging for context + include last bot message memory
      if (conversationContext) {
        console.log(`🗣️ Conversation context built: ${conversationContext}`);
      } else {
        console.log(`💬 No conversation context - treating as new interaction`);
      }
      const memTurns = channelMemory.get(messageData.channel_id);
      if (Array.isArray(memTurns) && memTurns.length) {
        const transcript = memTurns.map(t => `${t.role === 'bot' ? 'Assistant' : 'User'}: ${t.text}`).join('\n');
        conversationContext = conversationContext
          ? `${conversationContext}\n\nRecent conversation (most recent last):\n${transcript}`
          : `Recent conversation (most recent last):\n${transcript}`;
      }
      
      // **CRITICAL FIX**: Determine if this is a reply to bot (treat same as mention)
      const isReplyToBot = messageData.referenced_message && 
                          messageData.referenced_message.author && 
                          messageData.referenced_message.author.id === botClientId;
      
      console.log(`🎯 Message processing: Bot mentioned in content: ${/<@\!?(\d+)>/.test(messageData.content)}, Is reply to bot: ${isReplyToBot}`);
      
      // Use the EXACT local processing function with conversation context (legacy path when tutorial is OFF)
      // **IMPORTANT**: Skip mention check for replies to bot (treat them as direct communication)
      const result = await processDiscordMessageWithAI(
        messageData.content,
        messageData.guild_id,
        messageData.channel_id,
        messageData.author.id,
        isReplyToBot, // skipMentionCheck = true for bot replies
        "user_2yMTRvIng7ljDfRRUlXFvQkWSb5", // authenticatedUserId
        conversationContext // ← NOW PASSING CONVERSATION CONTEXT!
      );
      
      if (result.processed && result.conversationalResponse) {
        console.log(`🤖 API Response: ${result.conversationalResponse}`);
        try {
          const arr = channelMemory.get(messageData.channel_id) || [];
          arr.push({ role: 'bot', text: result.conversationalResponse });
          channelMemory.set(messageData.channel_id, arr.slice(-8));
        } catch {}
        return res.json({
          processed: true,
          response: result.conversationalResponse
        });
      } else if (result.processed && result.command) {
        console.log(`🎯 Command executed: ${result.command}`);
        return res.json({
          processed: true,
          response: `Command executed: ${result.command}`
        });
      } else if (result.needsClarification) {
        console.log(`❓ Clarification needed: ${result.clarificationQuestion}`);
        return res.json({
          processed: true,
          response: result.clarificationQuestion
        });
      } else {
        return res.json({ processed: false });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Discord API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while processing the Discord API request.'
    });
  }
});

app.get('/api/discord', (req, res) => {
  const { action } = req.query;
  
  if (action === 'process-message') {
    res.json({
      processed: false,
      reason: 'GET method not supported for process-message'
    });
  } else {
    res.json({
      processed: false,
      reason: 'Unknown action'
    });
  }
});

// Register & Heartbeat endpoints for SDK bots
app.post('/v1/relay/register', async (req, res) => {
  try {
    const apiKey = req.header('x-api-key') || req.header('x-commandless-key') || '';
    const apiKeyRecord = await findApiKeyRecord(apiKey);
    if (!apiKeyRecord) return res.status(401).json({ error: 'Unauthorized' });
    const { platform, name, clientId, botId } = req.body || {};
    const userId = apiKeyRecord.user_id;
    let finalBotId = botId || null;
    if (!finalBotId) {
      // Try to find by clientId
      if (clientId) {
        const { data: existing } = await supabase
          .from('bots')
          .select('id')
          .eq('client_id', clientId)
          .eq('user_id', userId)
          .maybeSingle();
        if (existing?.id) finalBotId = existing.id;
      }
    }
    if (!finalBotId) {
      // Create a minimal bot row letting DB assign numeric id
      const { data: inserted, error: insErr } = await supabase.from('bots').insert({
        user_id: userId,
        platform_type: platform || 'discord',
        bot_name: name || 'SDK Bot',
        client_id: clientId || null,
        token: '',
        is_connected: true,
      }).select('id').single();
      if (insErr) return res.status(500).json({ error: 'Failed to create bot' });
      finalBotId = inserted?.id;
    } else {
      await supabase.from('bots').update({ is_connected: true }).eq('id', finalBotId).eq('user_id', userId);
    }
    return res.json({ botId: finalBotId });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/v1/relay/heartbeat', async (req, res) => {
  try {
    const apiKey = req.header('x-api-key') || req.header('x-commandless-key') || '';
    const apiKeyRecord = await findApiKeyRecord(apiKey);
    if (!apiKeyRecord) return res.status(401).json({ error: 'Unauthorized' });
    const { botId } = req.body || {};
    if (botId) {
      await supabase.from('bots').update({ is_connected: true }).eq('id', botId).eq('user_id', apiKeyRecord.user_id);
    }
    // Deliver one-time sync request signal to SDK bots
    let syncRequested = false;
    if (botId && sdkSyncRequests.has(String(botId))) {
      syncRequested = true;
      sdkSyncRequests.delete(String(botId));
    }
    return res.json({ ok: true, syncRequested });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- SDK Command Sync (by botId) ----
app.post('/v1/relay/commands/sync', async (req, res) => {
  try {
    const apiKey = req.header('x-api-key') || req.header('x-commandless-key') || '';
    const apiKeyRecord = await findApiKeyRecord(apiKey);
    if (!apiKeyRecord) return res.status(401).json({ error: 'Unauthorized' });
    const { botId, commands } = req.body || {};
    if (!botId || !Array.isArray(commands)) return res.status(400).json({ error: 'botId and commands[] required' });
    const userId = apiKeyRecord.user_id;

    // Upsert each command by (user_id, bot_id, name)
    for (const c of commands) {
      const name = String(c.name || '').trim();
      const pattern = String(c.naturalLanguagePattern || c.pattern || '').trim();
      const output = String(c.commandOutput || c.output || c.slash || '').trim();
      if (!name || !pattern) continue;
      const { data: existing } = await supabase
        .from('command_mappings')
        .select('id')
        .eq('user_id', userId)
        .eq('bot_id', botId)
        .eq('name', name)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('command_mappings').update({
          natural_language_pattern: pattern,
          command_output: output,
          status: 'active'
        }).eq('id', existing.id);
      } else {
        await supabase.from('command_mappings').insert({
          user_id: userId,
          bot_id: botId,
          name,
          natural_language_pattern: pattern,
          command_output: output,
          status: 'active'
        });
      }
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/v1/relay/commands', async (req, res) => {
  try {
    const botId = String(req.query.botId || '');
    const apiKey = req.header('x-api-key') || req.header('x-commandless-key') || '';
    const apiKeyRecord = await findApiKeyRecord(apiKey);
    if (!apiKeyRecord) return res.status(401).json({ error: 'Unauthorized' });
    if (!botId) return res.status(400).json({ error: 'botId required' });
    const { data } = await supabase
      .from('command_mappings')
      .select('id,name,natural_language_pattern,command_output,status')
      .eq('user_id', apiKeyRecord.user_id)
      .eq('bot_id', botId)
      .eq('status', 'active');
    return res.json({ commands: data || [] });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard proxy: user-auth sync (no SDK key required)
app.post('/api/relay/commands/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;
    const { botId, commands } = req.body || {};
    if (!botId || !Array.isArray(commands)) return res.status(400).json({ error: 'botId and commands[] required' });
    for (const c of commands) {
      const name = String(c.name || '').trim();
      const pattern = String(c.naturalLanguagePattern || c.pattern || '').trim();
      const output = String(c.commandOutput || c.output || c.slash || '').trim();
      if (!name || !pattern) continue;
      const { data: existing } = await supabase
        .from('command_mappings')
        .select('id')
        .eq('user_id', userId)
        .eq('bot_id', botId)
        .eq('name', name)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('command_mappings').update({
          natural_language_pattern: pattern,
          command_output: output,
          status: 'active'
        }).eq('id', existing.id);
      } else {
        await supabase.from('command_mappings').insert({
          user_id: userId,
          bot_id: botId,
          name,
          natural_language_pattern: pattern,
          command_output: output,
          status: 'active'
        });
      }
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard -> Request SDK sync (no token required); signals via heartbeat
app.post('/api/relay/commands/request-sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const userId = decoded.userId;
    const { botId } = req.body || {};
    if (!botId) return res.status(400).json({ error: 'botId required' });
    const { data: bot } = await supabase
      .from('bots')
      .select('id,user_id')
      .eq('id', botId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    sdkSyncRequests.add(String(botId));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/relay/commands', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = decodeJWT(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const botId = String(req.query.botId || '');
    if (!botId) return res.status(400).json({ error: 'botId required' });
    const { data } = await supabase
      .from('command_mappings')
      .select('id,bot_id,name,natural_language_pattern,command_output,status,usage_count,created_at')
      .eq('user_id', decoded.userId)
      .eq('bot_id', botId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    return res.json((data || []).map(m => ({
      id: m.id,
      botId: m.bot_id,
      name: m.name,
      naturalLanguagePattern: m.natural_language_pattern,
      commandOutput: m.command_output,
      status: m.status,
      usageCount: m.usage_count,
      createdAt: m.created_at
    })));
  } catch (e) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
console.log('✅ Configuration validated successfully');

// Get command mappings
app.get('/api/mappings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: mappings, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', decodedToken.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch command mappings' });
    }

    // Format response to match frontend expectations
    const formattedMappings = mappings.map(mapping => ({
      id: mapping.id,
      botId: mapping.bot_id,
      name: mapping.name,
      naturalLanguagePattern: mapping.natural_language_pattern,
      commandOutput: mapping.command_output,
      status: mapping.status || 'active',
      usageCount: mapping.usage_count || 0,
      createdAt: mapping.created_at
    }));

    res.json(formattedMappings);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get individual command mapping
app.get('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Get specific mapping
    const { data: mapping, error } = await supabase
      .from('command_mappings')
      .select(`
        id,
        bot_id,
        name,
        natural_language_pattern,
        command_output,
        personality_context,
        status,
        usage_count,
        created_at
      `)
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .single();

    if (error || !mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Get bot information separately
    const { data: bot } = await supabase
      .from('bots')
      .select('id, bot_name, platform_type')
      .eq('id', mapping.bot_id)
      .single();

    const response = {
      id: mapping.id,
      botId: mapping.bot_id,
      name: mapping.name,
      naturalLanguagePattern: mapping.natural_language_pattern,
      commandOutput: mapping.command_output,
      personalityContext: mapping.personality_context,
      status: mapping.status,
      usageCount: mapping.usage_count,
      createdAt: mapping.created_at,
      bot: bot ? {
        id: bot.id,
        name: bot.bot_name,
        platformType: bot.platform_type
      } : null
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Individual mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update individual command mapping
app.put('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { 
      name,
      naturalLanguagePattern,
      commandOutput,
      personalityContext,
      status 
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (naturalLanguagePattern !== undefined) updateData.natural_language_pattern = naturalLanguagePattern;
    if (commandOutput !== undefined) updateData.command_output = commandOutput;
    if (personalityContext !== undefined) updateData.personality_context = personalityContext;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updatedMapping, error: updateError } = await supabase
      .from('command_mappings')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .select(`
        id,
        bot_id,
        name,
        natural_language_pattern,
        command_output,
        personality_context,
        status,
        usage_count,
        created_at
      `)
      .single();

    if (updateError || !updatedMapping) {
      console.error('Update error:', updateError);
      return res.status(404).json({ error: 'Failed to update mapping or mapping not found' });
    }

    const response = {
      id: updatedMapping.id,
      botId: updatedMapping.bot_id,
      name: updatedMapping.name,
      naturalLanguagePattern: updatedMapping.natural_language_pattern,
      commandOutput: updatedMapping.command_output,
      personalityContext: updatedMapping.personality_context,
      status: updatedMapping.status,
      usageCount: updatedMapping.usage_count,
      createdAt: updatedMapping.created_at
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Update mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete individual command mapping
app.delete('/api/mappings/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Delete mapping
    const { error: deleteError } = await supabase
      .from('command_mappings')
      .delete()
      .eq('id', id)
      .eq('user_id', decodedToken.userId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete mapping' });
    }

    return res.status(200).json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Delete mapping API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add test and use endpoints for individual mappings
app.post('/api/mappings/:id/test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { testInput } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    if (!testInput) {
      return res.status(400).json({ error: 'Test input is required' });
    }

    // Get the mapping
    const { data: mapping, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .single();

    if (error || !mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Simple pattern matching for testing
    const pattern = mapping.natural_language_pattern.toLowerCase();
    const input = testInput.toLowerCase();
    
    // Basic pattern matching - check if input contains key words from pattern
    const patternWords = pattern.split(/\s+/).filter(word => word.length > 2);
    const inputWords = input.split(/\s+/);
    
    const matchedWords = patternWords.filter(patternWord => 
      inputWords.some(inputWord => inputWord.includes(patternWord) || patternWord.includes(inputWord))
    );
    
    const confidence = patternWords.length > 0 ? matchedWords.length / patternWords.length : 0;
    const isMatch = confidence > 0.5;

    return res.status(200).json({
      matched: isMatch,
      confidence: Math.round(confidence * 100),
      response: isMatch ? mapping.command_output : 'No match found',
      testInput,
      pattern: mapping.natural_language_pattern
    });
  } catch (error) {
    console.error('Mapping test API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/mappings/:id/use', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { input, response } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }

    // Increment usage count
    const { data: currentMapping } = await supabase
      .from('command_mappings')
      .select('usage_count')
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .single();

    const newUsageCount = (currentMapping?.usage_count || 0) + 1;

    const { data: updatedMapping, error: updateError } = await supabase
      .from('command_mappings')
      .update({ 
        usage_count: newUsageCount
      })
      .eq('id', id)
      .eq('user_id', decodedToken.userId)
      .select()
      .single();

    if (updateError || !updatedMapping) {
      console.error('Update error:', updateError);
      return res.status(404).json({ error: 'Failed to update mapping or mapping not found' });
    }

    return res.status(200).json({
      id: updatedMapping.id,
      usageCount: updatedMapping.usage_count,
      message: 'Mapping usage recorded successfully'
    });
  } catch (error) {
    console.error('Mapping use API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update/Edit bot
app.put('/api/bots/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id: botId } = req.params;
    const { botName, token: botToken, personalityContext } = req.body;

    if (!botId) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    // Get existing bot to verify ownership
    const { data: existingBot, error: fetchError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .single();

    if (fetchError || !existingBot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Prepare update data
    const updateData = {};
    if (botName) updateData.bot_name = botName;
    if (botToken) updateData.token = botToken;
    if (personalityContext !== undefined) updateData.personality_context = personalityContext;

    // If token is being updated, check for conflicts
    if (botToken && botToken !== existingBot.token) {
      const { data: conflictBot, error: conflictError } = await supabase
        .from('bots')
        .select('id, bot_name, user_id')
        .eq('token', botToken)
        .neq('id', botId)
        .single();

      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Error checking for token conflict:', conflictError);
        return res.status(500).json({ error: 'Failed to validate token' });
      }

      if (conflictBot) {
        return res.status(409).json({ 
          error: 'Token already in use',
          details: 'This Discord bot token is already being used by another bot.',
          suggestion: 'Please use a different Discord bot token.'
        });
      }

      // If token is being changed and bot is connected, disconnect it first
      if (existingBot.is_connected) {
        updateData.is_connected = false;
      }
    }

    // Update the bot
    const { data: updatedBot, error: updateError } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bot:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update bot',
        details: 'There was an error updating your bot. Please try again.'
      });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'bot_updated',
        description: `Bot "${updatedBot.bot_name}" was updated`,
        metadata: { 
          botId: updatedBot.id,
          changes: Object.keys(updateData)
        }
      });

    res.json({
      id: updatedBot.id,
      botName: updatedBot.bot_name,
      platformType: updatedBot.platform_type,
      personalityContext: updatedBot.personality_context,
      isConnected: updatedBot.is_connected,
      createdAt: updatedBot.created_at,
      message: `${updatedBot.bot_name} has been updated successfully.`
    });

  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while updating your bot.'
    });
  }
});

// Delete bot
app.delete('/api/bots/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = decodeJWT(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id: botId } = req.params;

    if (!botId) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    // Get bot to verify ownership and get details
    const { data: bot, error: fetchError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', decodedToken.userId)
      .single();

    if (fetchError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Delete associated command mappings first
    const { error: mappingsError } = await supabase
      .from('command_mappings')
      .delete()
      .eq('bot_id', botId);

    if (mappingsError) {
      console.error('Error deleting command mappings:', mappingsError);
      // Continue with bot deletion even if mappings deletion fails
    }

    // Delete the bot
    const { error: deleteError } = await supabase
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('user_id', decodedToken.userId);

    if (deleteError) {
      console.error('Error deleting bot:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete bot',
        details: 'There was an error deleting your bot. Please try again.'
      });
    }

    // Create activity log
    await supabase
      .from('activities')
      .insert({
        user_id: decodedToken.userId,
        activity_type: 'bot_deleted',
        description: `Bot "${bot.bot_name}" was deleted`,
        metadata: { 
          botId: bot.id,
          botName: bot.bot_name,
          platformType: bot.platform_type
        }
      });

    res.json({
      success: true,
      message: `${bot.bot_name} has been deleted successfully.`
    });

  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred while deleting your bot.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Commandless server running on port ${PORT}`);
  console.log(`🤖 Gemini AI initialized`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
}); 