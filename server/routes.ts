import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateToken, generateToken, hashPassword, comparePassword } from "./middleware/auth";
import { loginUserSchema, insertUserSchema, insertBotSchema, insertCommandMappingSchema, insertActivitySchema } from "@shared/schema";
import { z } from "zod";
import { parseNaturalLanguage, translateToCommand } from "./openai";
import { ZodError } from "zod-validation-error";

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
  
  // Protected routes
  app.use("/api/bots", authenticateToken);
  app.use("/api/mappings", authenticateToken);
  app.use("/api/activities", authenticateToken);
  
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
      const botData = insertBotSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      const bot = await storage.createBot(botData);
      
      // Create activity
      await storage.createActivity({
        userId: user.id,
        activityType: "bot_created",
        description: `Bot ${bot.botName} was created`,
        metadata: { botId: bot.id, platformType: bot.platformType }
      });
      
      res.status(201).json(bot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating bot" });
    }
  });
  
  app.post("/api/bots/:id/connect", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const botId = parseInt(req.params.id);
      
      const bot = await storage.getBot(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      // In a real app, we would actually connect to Discord/Telegram here
      const updatedBot = await storage.updateBotConnection(botId, true);
      
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
      const botId = parseInt(req.params.id);
      
      const bot = await storage.getBot(botId);
      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }
      
      if (bot.userId !== user.id) {
        return res.status(403).json({ message: "Unauthorized access to this bot" });
      }
      
      // In a real app, we would actually disconnect from Discord/Telegram here
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
      const mappingId = parseInt(req.params.id);
      
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
      const mappingId = parseInt(req.params.id);
      
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
      const mappingId = parseInt(req.params.id);
      
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
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
