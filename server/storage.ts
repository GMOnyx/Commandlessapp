import { 
  User, InsertUser, Bot, InsertBot, CommandMapping, 
  InsertCommandMapping, Activity, InsertActivity 
} from "@shared/schema";
import { SupabaseStorage } from "./supabaseStorage";
import { log } from "./vite";

export interface IStorage {
  // User related methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { id?: string }): Promise<User>;

  // Bot related methods
  getBots(userId: string): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBotConnection(id: string, isConnected: boolean): Promise<Bot | undefined>;
  
  // Command mapping related methods
  getCommandMappings(userId: string): Promise<CommandMapping[]>;
  getCommandMapping(id: string): Promise<CommandMapping | undefined>;
  createCommandMapping(commandMapping: InsertCommandMapping): Promise<CommandMapping>;
  updateCommandMapping(id: string, data: Partial<CommandMapping>): Promise<CommandMapping | undefined>;
  incrementCommandUsage(id: string): Promise<void>;
  
  // Activity related methods
  getActivities(userId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Data management methods
  clearAllData(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bots: Map<string, Bot>;
  private commandMappings: Map<string, CommandMapping>;
  private activities: Map<string, Activity>;
  
  private userIdCounter: number;
  private botIdCounter: number;
  private commandMappingIdCounter: number;
  private activityIdCounter: number;

  constructor() {
    this.users = new Map();
    this.bots = new Map();
    this.commandMappings = new Map();
    this.activities = new Map();
    
    this.userIdCounter = 1;
    this.botIdCounter = 1;
    this.commandMappingIdCounter = 1;
    this.activityIdCounter = 1;
    
    // No demo user created automatically
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const id = insertUser.id || this.userIdCounter.toString();
    this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id,
      name: insertUser.name ?? null,
      email: insertUser.email ?? null,
      role: insertUser.role ?? null,
      avatar: insertUser.avatar ?? null
    };
    this.users.set(id, user);
    return user;
  }

  // Bot methods
  async getBots(userId: string): Promise<Bot[]> {
    return Array.from(this.bots.values()).filter(
      (bot) => bot.userId === userId
    );
  }

  async getBot(id: string): Promise<Bot | undefined> {
    return this.bots.get(id);
  }

  async createBot(insertBot: InsertBot): Promise<Bot> {
    const id = this.botIdCounter.toString();
    this.botIdCounter++;
    const now = new Date();
    const bot: Bot = { 
      ...insertBot, 
      id,
      clientId: insertBot.clientId ?? null,
      personalityContext: insertBot.personalityContext ?? null,
      isConnected: false, 
      createdAt: now 
    };
    this.bots.set(id, bot);
    return bot;
  }

  async updateBotConnection(id: string, isConnected: boolean): Promise<Bot | undefined> {
    const bot = this.bots.get(id);
    if (!bot) return undefined;
    
    const updatedBot = { ...bot, isConnected };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }

  // Command mapping methods
  async getCommandMappings(userId: string): Promise<CommandMapping[]> {
    return Array.from(this.commandMappings.values()).filter(
      (mapping) => mapping.userId === userId
    );
  }

  async getCommandMapping(id: string): Promise<CommandMapping | undefined> {
    return this.commandMappings.get(id);
  }

  async createCommandMapping(insertCommandMapping: InsertCommandMapping): Promise<CommandMapping> {
    const id = this.commandMappingIdCounter.toString();
    this.commandMappingIdCounter++;
    const now = new Date();
    const commandMapping: CommandMapping = { 
      ...insertCommandMapping, 
      id,
      status: insertCommandMapping.status ?? null,
      usageCount: 0, 
      createdAt: now 
    };
    this.commandMappings.set(id, commandMapping);
    return commandMapping;
  }

  async updateCommandMapping(id: string, data: Partial<CommandMapping>): Promise<CommandMapping | undefined> {
    const mapping = this.commandMappings.get(id);
    if (!mapping) return undefined;
    
    const updatedMapping = { ...mapping, ...data };
    this.commandMappings.set(id, updatedMapping);
    return updatedMapping;
  }

  async incrementCommandUsage(id: string): Promise<void> {
    const mapping = this.commandMappings.get(id);
    if (!mapping) return;
    
    const updatedMapping = { ...mapping, usageCount: (mapping.usageCount || 0) + 1 };
    this.commandMappings.set(id, updatedMapping);
  }

  // Activity methods
  async getActivities(userId: string, limit?: number): Promise<Activity[]> {
    const activities = Array.from(this.activities.values())
      .filter((activity) => activity.userId === userId)
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    
    return limit ? activities.slice(0, limit) : activities;
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.activityIdCounter.toString();
    this.activityIdCounter++;
    const now = new Date();
    const activity: Activity = { 
      ...insertActivity, 
      id,
      metadata: insertActivity.metadata ?? {},
      createdAt: now 
    };
    this.activities.set(id, activity);
    return activity;
  }

  // Data management methods
  async clearAllData(): Promise<void> {
    this.users.clear();
    this.bots.clear();
    this.commandMappings.clear();
    this.activities.clear();
  }
}

// Function to select storage implementation based on environment
export function createStorage(): IStorage {
  const useSupabase = process.env.USE_SUPABASE === 'true';
  
  if (useSupabase) {
    log('Using Supabase storage implementation', 'storage');
    return new SupabaseStorage();
  } else {
    log('Using in-memory storage implementation', 'storage');
    return new MemStorage();
  }
}

// Export the selected storage implementation
export const storage = createStorage();
