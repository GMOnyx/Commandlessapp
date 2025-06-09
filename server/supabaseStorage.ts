import { 
  User, InsertUser, Bot, InsertBot, CommandMapping, 
  InsertCommandMapping, Activity, InsertActivity 
} from "@shared/schema";
import { IStorage } from "./storage";
import { supabase } from "./supabase";
import { log } from "./vite";
import { encryptSensitiveData, decryptSensitiveData } from "./utils/encryption";

export class SupabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      log(`Error fetching user: ${error.message}`, 'supabase');
      return undefined;
    }
    
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      log(`Error fetching user by username: ${error.message}`, 'supabase');
      return undefined;
    }
    
    return data as User;
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const userData: any = {
      username: insertUser.username,
      password: insertUser.password,
      name: insertUser.name || null,
      email: insertUser.email || null,
      role: insertUser.role || null,
      avatar: insertUser.avatar || null
    };
    
    // Add ID if provided (for Clerk users)
    if (insertUser.id) {
      userData.id = insertUser.id;
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      log(`Error creating user: ${error.message}`, 'supabase');
      throw new Error(`Failed to create user: ${error.message}`);
    }
    
    return data as User;
  }

  // Bot methods
  async getBots(userId: string): Promise<Bot[]> {
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      log(`Error fetching bots: ${error.message}`, 'supabase');
      return [];
    }
    
    // Transform Supabase snake_case columns to camelCase for our frontend
    // and decrypt sensitive data
    return data.map(bot => ({
      id: bot.id,
      userId: bot.user_id,
      platformType: bot.platform_type,
      botName: bot.bot_name,
      token: decryptSensitiveData(bot.token), // Decrypt token
      clientId: bot.client_id,
      personalityContext: bot.personality_context,
      isConnected: bot.is_connected,
      createdAt: new Date(bot.created_at)
    })) as Bot[];
  }

  async getBot(id: string): Promise<Bot | undefined> {
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      log(`Error fetching bot: ${error.message}`, 'supabase');
      return undefined;
    }
    
    // Transform to camelCase for frontend and decrypt sensitive data
    return {
      id: data.id,
      userId: data.user_id,
      platformType: data.platform_type,
      botName: data.bot_name,
      token: decryptSensitiveData(data.token), // Decrypt token
      clientId: data.client_id,
      personalityContext: data.personality_context,
      isConnected: data.is_connected,
      createdAt: new Date(data.created_at)
    } as Bot;
  }

  async createBot(insertBot: InsertBot): Promise<Bot> {
    // Transform camelCase to snake_case for Supabase and encrypt sensitive data
    const botData = {
      user_id: insertBot.userId,
      platform_type: insertBot.platformType,
      bot_name: insertBot.botName,
      token: encryptSensitiveData(insertBot.token), // Encrypt token before storing
      client_id: insertBot.clientId || null,
      personality_context: insertBot.personalityContext || null
    };
    
    const { data, error } = await supabase
      .from('bots')
      .insert(botData)
      .select()
      .single();
    
    if (error) {
      log(`Error creating bot: ${error.message}`, 'supabase');
      throw new Error(`Failed to create bot: ${error.message}`);
    }
    
    // Transform back to camelCase for frontend and decrypt for return
    return {
      id: data.id,
      userId: data.user_id,
      platformType: data.platform_type,
      botName: data.bot_name,
      token: decryptSensitiveData(data.token), // Decrypt for return value
      clientId: data.client_id,
      personalityContext: data.personality_context,
      isConnected: data.is_connected,
      createdAt: new Date(data.created_at)
    } as Bot;
  }

  async updateBotConnection(id: string, isConnected: boolean): Promise<Bot | undefined> {
    const { data, error } = await supabase
      .from('bots')
      .update({ is_connected: isConnected })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      log(`Error updating bot connection: ${error.message}`, 'supabase');
      return undefined;
    }
    
    // Transform to camelCase for frontend and decrypt sensitive data
    return {
      id: data.id,
      userId: data.user_id,
      platformType: data.platform_type,
      botName: data.bot_name,
      token: decryptSensitiveData(data.token), // Decrypt token
      clientId: data.client_id,
      personalityContext: data.personality_context,
      isConnected: data.is_connected,
      createdAt: new Date(data.created_at)
    } as Bot;
  }

  // Command mapping methods
  async getCommandMappings(userId: string): Promise<CommandMapping[]> {
    const { data, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      log(`Error fetching command mappings: ${error.message}`, 'supabase');
      return [];
    }
    
    // Transform Supabase snake_case columns to camelCase for our frontend
    return data.map(mapping => ({
      id: mapping.id,
      userId: mapping.user_id,
      botId: mapping.bot_id,
      name: mapping.name,
      naturalLanguagePattern: mapping.natural_language_pattern,
      commandOutput: mapping.command_output,
      status: mapping.status,
      usageCount: mapping.usage_count,
      createdAt: new Date(mapping.created_at)
    })) as CommandMapping[];
  }

  async getCommandMapping(id: string): Promise<CommandMapping | undefined> {
    const { data, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      log(`Error fetching command mapping: ${error.message}`, 'supabase');
      return undefined;
    }
    
    // Transform to camelCase for frontend
    return {
      id: data.id,
      userId: data.user_id,
      botId: data.bot_id,
      name: data.name,
      naturalLanguagePattern: data.natural_language_pattern,
      commandOutput: data.command_output,
      status: data.status,
      usageCount: data.usage_count,
      createdAt: new Date(data.created_at)
    } as CommandMapping;
  }

  async createCommandMapping(insertCommandMapping: InsertCommandMapping): Promise<CommandMapping> {
    // Transform camelCase to snake_case for Supabase
    const mappingData = {
      user_id: insertCommandMapping.userId,
      bot_id: insertCommandMapping.botId,
      name: insertCommandMapping.name,
      natural_language_pattern: insertCommandMapping.naturalLanguagePattern,
      command_output: insertCommandMapping.commandOutput,
      status: insertCommandMapping.status || 'active'
    };
    
    const { data, error } = await supabase
      .from('command_mappings')
      .insert(mappingData)
      .select()
      .single();
    
    if (error) {
      log(`Error creating command mapping: ${error.message}`, 'supabase');
      throw new Error(`Failed to create command mapping: ${error.message}`);
    }
    
    // Transform back to camelCase for frontend
    return {
      id: data.id,
      userId: data.user_id,
      botId: data.bot_id,
      name: data.name,
      naturalLanguagePattern: data.natural_language_pattern,
      commandOutput: data.command_output,
      status: data.status,
      usageCount: data.usage_count,
      createdAt: new Date(data.created_at)
    } as CommandMapping;
  }

  async updateCommandMapping(id: string, updateData: Partial<CommandMapping>): Promise<CommandMapping | undefined> {
    // Transform camelCase to snake_case for Supabase
    const supabaseUpdateData: Record<string, any> = {};
    
    if (updateData.name) supabaseUpdateData.name = updateData.name;
    if (updateData.naturalLanguagePattern) supabaseUpdateData.natural_language_pattern = updateData.naturalLanguagePattern;
    if (updateData.commandOutput) supabaseUpdateData.command_output = updateData.commandOutput;
    if (updateData.status) supabaseUpdateData.status = updateData.status;
    if (updateData.usageCount !== undefined) supabaseUpdateData.usage_count = updateData.usageCount;
    
    const { data, error } = await supabase
      .from('command_mappings')
      .update(supabaseUpdateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      log(`Error updating command mapping: ${error.message}`, 'supabase');
      return undefined;
    }
    
    // Transform to camelCase for frontend
    return {
      id: data.id,
      userId: data.user_id,
      botId: data.bot_id,
      name: data.name,
      naturalLanguagePattern: data.natural_language_pattern,
      commandOutput: data.command_output,
      status: data.status,
      usageCount: data.usage_count,
      createdAt: new Date(data.created_at)
    } as CommandMapping;
  }

  async incrementCommandUsage(id: string): Promise<void> {
    // Get current usage count
    const { data, error } = await supabase
      .from('command_mappings')
      .select('usage_count')
      .eq('id', id)
      .single();
    
    if (error) {
      log(`Error fetching command usage: ${error.message}`, 'supabase');
      return;
    }
    
    // Increment the usage count
    const newCount = (data.usage_count || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('command_mappings')
      .update({ usage_count: newCount })
      .eq('id', id);
    
    if (updateError) {
      log(`Error incrementing command usage: ${updateError.message}`, 'supabase');
    }
  }

  // Activity methods
  async getActivities(userId: string, limit?: number): Promise<Activity[]> {
    let query = supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      log(`Error fetching activities: ${error.message}`, 'supabase');
      return [];
    }
    
    // Transform Supabase snake_case columns to camelCase for our frontend
    return data.map(activity => ({
      id: activity.id,
      userId: activity.user_id,
      activityType: activity.activity_type,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: new Date(activity.created_at)
    })) as Activity[];
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    // Transform camelCase to snake_case for Supabase
    const activityData = {
      user_id: insertActivity.userId,
      activity_type: insertActivity.activityType,
      description: insertActivity.description,
      metadata: insertActivity.metadata || {}
    };
    
    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single();
    
    if (error) {
      log(`Error creating activity: ${error.message}`, 'supabase');
      throw new Error(`Failed to create activity: ${error.message}`);
    }
    
    // Transform back to camelCase for frontend
    return {
      id: data.id,
      userId: data.user_id,
      activityType: data.activity_type,
      description: data.description,
      metadata: data.metadata,
      createdAt: new Date(data.created_at)
    } as Activity;
  }

  // Data management methods
  async clearAllData(): Promise<void> {
    // Clear activities first (due to foreign key constraints)
    await supabase.from('activities').delete().neq('id', '');
    
    // Clear command_mappings
    await supabase.from('command_mappings').delete().neq('id', '');
    
    // Clear bots
    await supabase.from('bots').delete().neq('id', '');
    
    // Clear users (except system users if needed)
    await supabase.from('users').delete().neq('id', '');
    
    log('Cleared all application data from Supabase', 'supabase');
  }
} 