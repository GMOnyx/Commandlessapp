import { 
  User, InsertUser, Bot, InsertBot, CommandMapping, 
  InsertCommandMapping, Activity, InsertActivity 
} from "@shared/schema";

export interface IStorage {
  // User related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Bot related methods
  getBots(userId: number): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBotConnection(id: number, isConnected: boolean): Promise<Bot | undefined>;
  
  // Command mapping related methods
  getCommandMappings(userId: number): Promise<CommandMapping[]>;
  getCommandMapping(id: number): Promise<CommandMapping | undefined>;
  createCommandMapping(commandMapping: InsertCommandMapping): Promise<CommandMapping>;
  updateCommandMapping(id: number, data: Partial<CommandMapping>): Promise<CommandMapping | undefined>;
  incrementCommandUsage(id: number): Promise<void>;
  
  // Activity related methods
  getActivities(userId: number, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bots: Map<number, Bot>;
  private commandMappings: Map<number, CommandMapping>;
  private activities: Map<number, Activity>;
  
  private userId: number;
  private botId: number;
  private commandMappingId: number;
  private activityId: number;

  constructor() {
    this.users = new Map();
    this.bots = new Map();
    this.commandMappings = new Map();
    this.activities = new Map();
    
    this.userId = 1;
    this.botId = 1;
    this.commandMappingId = 1;
    this.activityId = 1;
    
    // Add demo user
    this.createUser({
      username: "demo",
      password: "password123",
      name: "Sarah Johnson",
      email: "sarah@example.com",
      role: "Marketing Lead",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Bot methods
  async getBots(userId: number): Promise<Bot[]> {
    return Array.from(this.bots.values()).filter(
      (bot) => bot.userId === userId
    );
  }

  async getBot(id: number): Promise<Bot | undefined> {
    return this.bots.get(id);
  }

  async createBot(insertBot: InsertBot): Promise<Bot> {
    const id = this.botId++;
    const now = new Date();
    const bot: Bot = { 
      ...insertBot, 
      id, 
      isConnected: false, 
      createdAt: now 
    };
    this.bots.set(id, bot);
    return bot;
  }

  async updateBotConnection(id: number, isConnected: boolean): Promise<Bot | undefined> {
    const bot = this.bots.get(id);
    if (!bot) return undefined;
    
    const updatedBot = { ...bot, isConnected };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }

  // Command mapping methods
  async getCommandMappings(userId: number): Promise<CommandMapping[]> {
    return Array.from(this.commandMappings.values()).filter(
      (mapping) => mapping.userId === userId
    );
  }

  async getCommandMapping(id: number): Promise<CommandMapping | undefined> {
    return this.commandMappings.get(id);
  }

  async createCommandMapping(insertCommandMapping: InsertCommandMapping): Promise<CommandMapping> {
    const id = this.commandMappingId++;
    const now = new Date();
    const commandMapping: CommandMapping = { 
      ...insertCommandMapping, 
      id, 
      usageCount: 0, 
      createdAt: now 
    };
    this.commandMappings.set(id, commandMapping);
    return commandMapping;
  }

  async updateCommandMapping(id: number, data: Partial<CommandMapping>): Promise<CommandMapping | undefined> {
    const mapping = this.commandMappings.get(id);
    if (!mapping) return undefined;
    
    const updatedMapping = { ...mapping, ...data };
    this.commandMappings.set(id, updatedMapping);
    return updatedMapping;
  }

  async incrementCommandUsage(id: number): Promise<void> {
    const mapping = this.commandMappings.get(id);
    if (!mapping) return;
    
    const updatedMapping = { ...mapping, usageCount: mapping.usageCount + 1 };
    this.commandMappings.set(id, updatedMapping);
  }

  // Activity methods
  async getActivities(userId: number, limit?: number): Promise<Activity[]> {
    const activities = Array.from(this.activities.values())
      .filter((activity) => activity.userId === userId)
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    
    return limit ? activities.slice(0, limit) : activities;
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.activityId++;
    const now = new Date();
    const activity: Activity = { 
      ...insertActivity, 
      id, 
      createdAt: now 
    };
    this.activities.set(id, activity);
    return activity;
  }
}

export const storage = new MemStorage();
