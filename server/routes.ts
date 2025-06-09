import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, generateToken, hashPassword, comparePassword, clerkUserIdToUuid } from "./middleware/auth";
import { loginUserSchema, insertUserSchema, insertBotSchema, insertCommandMappingSchema, insertActivitySchema } from "@shared/schema";
import { z } from "zod";
import { parseNaturalLanguage, translateToCommand } from "./gemini";
import { ZodError } from "zod-validation-error";
import { discordWebhookHandler } from "./discord/webhook";
import { processDiscordMessage } from "./discord/messageHandler";
import { processDiscordMessageWithAI } from "./discord/messageHandlerAI";
import { validateGeminiConfig } from "./gemini/client";
import { log } from "./vite";

// Export storage for use in other modules
export { storage };

// Middleware to ensure Clerk users exist in Supabase
async function ensureClerkUserExists(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (user && user.clerkUserId) {
    try {
      // Check if user exists in Supabase
      const existingUser = await storage.getUser(user.id);
      
      if (!existingUser) {
        console.log('[ROUTES] Creating new user record for Clerk user:', { 
          clerkUserId: user.clerkUserId, 
          supabaseUserId: user.id 
        });
        
        // Create user record with UUID
        await storage.createUser({
          id: user.id,
          username: user.clerkUserId, // Use Clerk ID as username for now
          password: '', // Not needed for Clerk users
          name: null,
          email: null,
          role: 'User'
        });
        
        console.log('[ROUTES] ✅ Created new user record in Supabase');
      }
    } catch (error) {
      console.error('[ROUTES] ❌ Error ensuring user exists:', error);
      // Don't block the request, just log the error
    }
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password before storing
      const user = await storage.createUser({
        ...userData,
        password: hashPassword(userData.password)
      });
      
      // Generate JWT token
      const token = generateToken(user.id);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating user" });
    }
  });
  
  // Alias routes for convenience (without /auth prefix)
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password before storing
      const user = await storage.createUser({
        ...userData,
        password: hashPassword(userData.password)
      });
      
      // Generate JWT token
      const token = generateToken(user.id);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating user" });
    }
  });
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      const passwordValid = comparePassword(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Generate JWT token
      const token = generateToken(user.id);
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(200).json({ user: userWithoutPassword, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error logging in" });
    }
  });
  
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      const passwordValid = comparePassword(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Generate JWT token
      const token = generateToken(user.id);
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(200).json({ user: userWithoutPassword, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error logging in" });
    }
  });
  
  // Protected routes
  app.use("/api/bots", authenticateToken, ensureClerkUserExists);
  app.use("/api/mappings", authenticateToken, ensureClerkUserExists);
  app.use("/api/activities", authenticateToken, ensureClerkUserExists);
  
  // Bot routes
  app.get("/api/bots", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const bots = await storage.getBots(user.id);
      res.json(bots);
    } catch (error) {
      res.status(500).json({ message: "Error fetching bots" });
    }
  });
  
  app.post("/api/bots", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      let botData = insertBotSchema.parse({
        ...req.body,
        userId: user.id
      });

      // Auto-generate personality context for Discord bots if none provided
      if (botData.platformType === 'discord' && !botData.personalityContext) {
        try {
          const { fetchBotInfo, generateFallbackPersonality } = await import('./discord/commandDiscovery');
          const botInfo = await fetchBotInfo(botData.token);
          
          if (botInfo) {
            botData.personalityContext = generateFallbackPersonality(botInfo);
          }
        } catch (error) {
          console.warn(`Failed to generate fallback personality: ${(error as Error).message}`);
          // Continue without auto-generated personality
        }
      }
      
      const bot = await storage.createBot(botData);
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "bot_created",
        description: `Bot ${bot.botName} was created`,
        metadata: { botId: bot.id, platformType: bot.platformType }
      });

      // Auto-discover Discord commands if it's a Discord bot
      if (bot.platformType === 'discord') {
        try {
          const { commandDiscoveryService } = await import('./discord/commandDiscovery');
          const discoveryResult = await commandDiscoveryService.discoverAndSyncCommands(
            bot.id,
            user.id,
            bot.token
          );
          
          if (discoveryResult.success && discoveryResult.createdMappings > 0) {
            // Create additional activity for command discovery
            await storage.createActivity({
              userId: user.id,
              activityType: "commands_discovered",
              description: `Auto-discovered ${discoveryResult.createdMappings} Discord commands for ${bot.botName}`,
              metadata: { 
                botId: bot.id, 
                commandsFound: discoveryResult.discoveredCommands.length,
                commandsCreated: discoveryResult.createdMappings,
                applicationId: discoveryResult.applicationId
              }
            });
          }

          // Include discovery results in response
          res.status(201).json({
            ...bot,
            discovery: discoveryResult
          });
        } catch (error) {
          // Discovery failed, but bot was created successfully
          console.warn(`Command discovery failed for bot ${bot.id}:`, error);
          res.status(201).json({
            ...bot,
            discovery: {
              success: false,
              error: 'Failed to auto-discover commands'
            }
          });
        }
      } else {
        res.status(201).json(bot);
      }
    } catch (error) {
      console.error('Bot creation error:', error); // Add detailed error logging
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating bot", details: (error as Error).message });
    }
  });
  
  app.post("/api/bots/:id/connect", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const botId = req.params.id;
      
      const bot = await storage.getBot(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      // Update database connection status first
      const updatedBot = await storage.updateBotConnection(botId, true);
      
      // If it's a Discord bot, actually start the Discord client
      if (bot.platformType === 'discord' && bot.token) {
        try {
          // First validate the Discord token
          const { discordAPI } = await import('./discord/api');
          const validation = await discordAPI.validateBotToken(bot.token);
          
          if (!validation.valid) {
            // Revert database status
            await storage.updateBotConnection(botId, false);
            return res.status(400).json({ 
              message: "Invalid Discord bot token. Please check your token in the Discord Developer Portal.",
              error: "INVALID_DISCORD_TOKEN",
              troubleshooting: [
                "Verify token is copied correctly from Discord Developer Portal",
                "Ensure bot has 'bot' and 'applications.commands' scopes",
                "Check if token was recently regenerated",
                "Confirm bot is not deleted or disabled"
              ]
            });
          }
          
          const { discordBotManager } = await import('./discord/bot');
          const started = await discordBotManager.startBot(bot.token, user.id);
          
          if (!started) {
            // Revert database status if Discord connection failed
            await storage.updateBotConnection(botId, false);
            return res.status(500).json({ 
              message: "Failed to start Discord bot. The token may be invalid or expired.",
              error: "DISCORD_CONNECTION_FAILED",
              troubleshooting: [
                "Check Discord bot token validity",
                "Ensure bot has proper permissions",
                "Verify bot is not rate limited",
                "Try regenerating the bot token"
              ]
            });
          }
        } catch (error) {
          // Revert database status if Discord connection failed
          await storage.updateBotConnection(botId, false);
          
          const errorMessage = (error as Error).message;
          let specificMessage = "Error starting Discord bot";
          let troubleshooting = [
            "Check Discord bot token",
            "Verify bot permissions",
            "Ensure bot is not disabled"
          ];
          
          // Provide specific error messages based on Discord.js errors
          if (errorMessage.includes("Incorrect login details")) {
            specificMessage = "Invalid Discord bot token provided";
            troubleshooting = [
              "Copy token exactly from Discord Developer Portal > Bot section",
              "Don't include 'Bot ' prefix when copying",
              "Regenerate token if it's not working"
            ];
          } else if (errorMessage.includes("Too many requests")) {
            specificMessage = "Discord API rate limit exceeded";
            troubleshooting = [
              "Wait a few minutes before trying again",
              "Check if bot is being used elsewhere",
              "Ensure only one instance is running"
            ];
          } else if (errorMessage.includes("Missing Permissions")) {
            specificMessage = "Bot token lacks required permissions";
            troubleshooting = [
              "Add 'bot' scope in Discord Developer Portal",
              "Add 'applications.commands' scope if using slash commands",
              "Reinvite bot to server with correct permissions"
            ];
          }
          
          return res.status(500).json({ 
            message: specificMessage,
            error: "DISCORD_STARTUP_ERROR",
            details: errorMessage,
            troubleshooting
          });
        }
      }
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "bot_connected",
        description: `Bot ${bot.botName} was connected`,
        metadata: { botId: bot.id, platformType: bot.platformType }
      });
      
      res.json(updatedBot);
    } catch (error) {
      res.status(500).json({ message: "Error connecting bot" });
    }
  });
  
  app.post("/api/bots/:id/disconnect", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const botId = req.params.id;
      
      const bot = await storage.getBot(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      // If it's a Discord bot, actually stop the Discord client
      if (bot.platformType === 'discord' && bot.token) {
        try {
          const { discordBotManager } = await import('./discord/bot');
          await discordBotManager.stopBot(bot.token);
        } catch (error) {
          console.warn(`Failed to stop Discord bot: ${(error as Error).message}`);
          // Continue with database update even if Discord stop failed
        }
      }
      
      // Update database connection status
      const updatedBot = await storage.updateBotConnection(botId, false);
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "bot_disconnected",
        description: `Bot ${bot.botName} was disconnected`,
        metadata: { botId: bot.id, platformType: bot.platformType }
      });
      
      res.json(updatedBot);
    } catch (error) {
      res.status(500).json({ message: "Error disconnecting bot" });
    }
  });
  
  // Command discovery endpoints
  app.post("/api/bots/:id/sync-commands", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const botId = req.params.id;
      const { forceRefresh = false } = req.body;
      
      const bot = await storage.getBot(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      if (bot.platformType !== 'discord') {
        return res.status(400).json({ message: "Command sync is only available for Discord bots" });
      }
      
      const { commandDiscoveryService } = await import('./discord/commandDiscovery');
      const result = await commandDiscoveryService.syncBotCommands(botId, user.id, forceRefresh);
      
      if (result.success && result.createdMappings > 0) {
        // Create activity for manual sync
        await storage.createActivity({
          userId: user.id,
          activityType: "commands_synced",
          description: `Manually synced ${result.createdMappings} Discord commands for ${bot.botName}`,
          metadata: { 
            botId: bot.id, 
            commandsFound: result.discoveredCommands.length,
            commandsCreated: result.createdMappings,
            forceRefresh
          }
        });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Error syncing commands",
        error: (error as Error).message
      });
    }
  });

  app.post("/api/discord/preview-commands", async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      
      if (!botToken) {
        return res.status(400).json({ message: "Bot token is required" });
      }
      
      const { commandDiscoveryService } = await import('./discord/commandDiscovery');
      const result = await commandDiscoveryService.previewCommands(botToken);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Error previewing commands",
        error: (error as Error).message
      });
    }
  });
  
  // Simple bot token validation endpoint
  app.post("/api/discord/validate-token", async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      
      if (!botToken) {
        return res.status(400).json({ message: "Bot token is required" });
      }

      const { discordAPI } = await import('./discord/api');
      const validation = await discordAPI.validateBotToken(botToken);
      
      if (validation.valid) {
        res.json({
          valid: true,
          applicationId: validation.applicationId,
          botName: validation.botName,
          message: "✅ Discord bot token is valid!"
        });
      } else {
        res.json({
          valid: false,
          message: "❌ Invalid Discord bot token. Please check your token and try again."
        });
      }
    } catch (error) {
      res.status(500).json({ 
        message: "Error validating token",
        error: (error as Error).message
      });
    }
  });
  
  // Comprehensive token debugging endpoint
  app.post("/api/discord/debug-token", async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      
      if (!botToken) {
        return res.status(400).json({ message: "Bot token is required" });
      }

      // Clean token
      const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
      
      const debugInfo = {
        originalLength: botToken.length,
        cleanedLength: cleanToken.length,
        hasSpaces: botToken !== botToken.trim(),
        hasBotPrefix: /^Bot\s+/i.test(botToken),
        firstChars: cleanToken.substring(0, 10) + "...",
        lastChars: "..." + cleanToken.substring(cleanToken.length - 10),
        validFormat: cleanToken.length > 50 && /^[A-Za-z0-9._-]+$/.test(cleanToken)
      };

      // Try Discord API call with detailed logging
      const { discordAPI } = await import('./discord/api');
      const validation = await discordAPI.validateBotToken(cleanToken);
      
      res.json({
        debugInfo,
        validation,
        recommendations: [
          "Make sure token is from Discord Developer Portal > Bot section",
          "Ensure bot has 'bot' and 'applications.commands' scopes",
          "Check if token was recently regenerated",
          "Verify bot is not deleted or disabled"
        ]
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Error debugging token",
        error: (error as Error).message
      });
    }
  });
  
  // Command mapping routes
  app.get("/api/mappings", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappings = await storage.getCommandMappings(user.id);
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ message: "Error fetching command mappings" });
    }
  });
  
  app.get("/api/mappings/:id", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappingId = req.params.id;
      
      const mapping = await storage.getCommandMapping(mappingId);
      if (!mapping) {
        return res.status(404).json({ message: "Command mapping not found" });
      }
      
      if (mapping.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this command mapping" });
      }
      
      res.json(mapping);
    } catch (error) {
      res.status(500).json({ message: "Error fetching command mapping" });
    }
  });
  
  app.post("/api/mappings", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappingData = insertCommandMappingSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      // Verify bot exists and belongs to user
      const bot = await storage.getBot(mappingData.botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      const mapping = await storage.createCommandMapping(mappingData);
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "command_created",
        description: `Command mapping ${mapping.name} was created`,
        metadata: { mappingId: mapping.id, botId: mapping.botId }
      });
      
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating command mapping" });
    }
  });
  
  app.put("/api/mappings/:id", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappingId = req.params.id;
      
      const mapping = await storage.getCommandMapping(mappingId);
      if (!mapping) {
        return res.status(404).json({ message: "Command mapping not found" });
      }
      
      if (mapping.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this command mapping" });
      }
      
      const updatedData: Partial<typeof mapping> = {};
      
      if (req.body.name) updatedData.name = req.body.name;
      if (req.body.naturalLanguagePattern) updatedData.naturalLanguagePattern = req.body.naturalLanguagePattern;
      if (req.body.commandOutput) updatedData.commandOutput = req.body.commandOutput;
      if (req.body.status) updatedData.status = req.body.status;
      
      const updatedMapping = await storage.updateCommandMapping(mappingId, updatedData);
      
      res.json(updatedMapping);
    } catch (error) {
      res.status(500).json({ message: "Error updating command mapping" });
    }
  });
  
  app.post("/api/mappings/:id/test", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappingId = req.params.id;
      
      // Validate input
      const { userInput } = req.body;
      if (!userInput || typeof userInput !== 'string') {
        return res.status(400).json({ message: "User input is required" });
      }
      
      const mapping = await storage.getCommandMapping(mappingId);
      if (!mapping) {
        return res.status(404).json({ message: "Command mapping not found" });
      }
      
      if (mapping.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this command mapping" });
      }
      
      // Parse input and translate to command
      const result = await translateToCommand(
        mapping.naturalLanguagePattern,
        mapping.commandOutput,
        userInput
      );
      
      if (!result) {
        return res.status(400).json({ message: "Could not translate input to command" });
      }
      
      res.json({ output: result });
    } catch (error) {
      res.status(500).json({ message: "Error testing command mapping" });
    }
  });
  
  app.post("/api/mappings/:id/use", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const mappingId = req.params.id;
      
      // Validate input
      const { userInput } = req.body;
      if (!userInput || typeof userInput !== 'string') {
        return res.status(400).json({ message: "User input is required" });
      }
      
      const mapping = await storage.getCommandMapping(mappingId);
      if (!mapping) {
        return res.status(404).json({ message: "Command mapping not found" });
      }
      
      if (mapping.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this command mapping" });
      }
      
      // Parse input and translate to command
      const result = await translateToCommand(
        mapping.naturalLanguagePattern,
        mapping.commandOutput,
        userInput
      );
      
      if (!result) {
        return res.status(400).json({ message: "Could not translate input to command" });
      }
      
      // Increment usage count
      await storage.incrementCommandUsage(mappingId);
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "command_used",
        description: `Command mapping ${mapping.name} was used`,
        metadata: { 
          mappingId: mapping.id, 
          userInput, 
          commandOutput: result 
        }
      });
      
      res.json({ output: result });
    } catch (error) {
      res.status(500).json({ message: "Error using command mapping" });
    }
  });
  
  // Activity routes
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const activities = await storage.getActivities(user.id, limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Error fetching activities" });
    }
  });
  
  // Webhook endpoints
  app.post("/api/webhooks/discord", async (req: Request, res: Response) => {
    return await discordWebhookHandler(req, res);
  });
  
  // Test endpoint for Discord message processing (protected for testing)
  app.post("/api/discord/process-message", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { message, guildId, channelId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const user = (req as any).user;
      const result = await processDiscordMessage(
        message,
        guildId || 'test-guild',
        channelId || 'test-channel',
        user.id.toString()
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Error processing Discord message",
        error: (error as Error).message
      });
    }
  });
  
  // AI intent processing test endpoint
  app.post("/api/discord/process-message-ai", authenticateToken, async (req: Request, res: Response) => {
    try {
      // Check if Gemini is configured
      if (!validateGeminiConfig()) {
        return res.status(400).json({ 
          message: "Gemini API is not configured. Please set GEMINI_API_KEY environment variable."
        });
      }
      
      const { message, guildId, channelId, userId, skipMentionCheck } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const user = (req as any).user;
      
      // For API testing, we'll continue to allow the skipMentionCheck parameter
      // but log when it's used
      if (skipMentionCheck === true) {
        log('Warning: skipMentionCheck=true was used, bypassing @mention requirement', 'discord');
      }
      
      const result = await processDiscordMessageWithAI(
        message,
        guildId || 'test-guild',
        channelId || 'test-channel',
        userId || user.id.toString(),
        skipMentionCheck === true, // ensure it's a boolean
        user.id // pass the authenticated user ID
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Error processing Discord message with AI",
        error: (error as Error).message
      });
    }
  });
  
  // Simple test endpoint for Gemini
  app.post("/api/test-gemini", async (req: Request, res: Response) => {
    try {
      const { pattern, input } = req.body;
      
      if (!pattern || !input) {
        return res.status(400).json({ message: "Pattern and input are required" });
      }
      
      const mockResult: Record<string, string> = {};
      
      // For "ban {user} for {reason}"
      if (pattern.includes("{user}") && pattern.includes("{reason}")) {
        const userMatch = input.match(/ban (\w+) for (.*)/);
        if (userMatch && userMatch.length >= 3) {
          mockResult.user = userMatch[1];
          mockResult.reason = userMatch[2];
        }
      }
      
      // For "kick {user} {reason}"
      if (pattern.includes("kick {user}")) {
        const userMatch = input.match(/kick (\w+) (.*)/);
        if (userMatch && userMatch.length >= 3) {
          mockResult.user = userMatch[1];
          mockResult.reason = userMatch[2];
        }
      }
      
      // Apply extracted variables to command template
      let output = pattern;
      for (const [key, value] of Object.entries(mockResult)) {
        output = output.replace(new RegExp(`{${key}}`, 'g'), value);
      }
      
      res.json({ 
        extracted: mockResult,
        output
      });
    } catch (error) {
      res.status(500).json({ message: "Error testing Gemini" });
    }
  });
  
  // Test endpoint for pattern generation
  app.post("/api/test-pattern-generation", async (req: Request, res: Response) => {
    try {
      const { command } = req.body;
      
      if (!command || !command.name) {
        return res.status(400).json({ message: "Discord command object is required" });
      }
      
      const { patternGenerator } = await import('./discord/patternGenerator');
      const result = patternGenerator.generatePatterns(command);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Error generating patterns",
        error: (error as Error).message
      });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
