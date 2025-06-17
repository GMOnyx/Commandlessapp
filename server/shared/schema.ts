import { z } from "zod";

// User schemas
export const insertUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(6),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

// Bot schemas
export const insertBotSchema = z.object({
  bot_name: z.string().min(1),
  platform_type: z.enum(["discord", "telegram"]),
  token: z.string().min(1),
  personality_context: z.string().optional(),
  user_id: z.string(),
});

export type Bot = {
  id: string;
  botName: string;
  platformType: "discord" | "telegram";
  token: string;
  personalityContext?: string;
  userId: string;
  isConnected: boolean;
  createdAt: string;
};

// Command mapping schemas
export const insertCommandMappingSchema = z.object({
  bot_id: z.string(),
  command_name: z.string().min(1),
  description: z.string().optional(),
  action_type: z.enum(["moderation", "utility", "fun", "info", "custom"]),
  parameters: z.record(z.any()).optional(),
  response_template: z.string().optional(),
  user_id: z.string(),
});

export type CommandMapping = {
  id: string;
  botId: string;
  commandName: string;
  description?: string;
  actionType: "moderation" | "utility" | "fun" | "info" | "custom";
  parameters?: Record<string, any>;
  responseTemplate?: string;
  userId: string;
  usageCount: number;
  createdAt: string;
};

// Activity schemas
export const insertActivitySchema = z.object({
  user_id: z.string(),
  activity_type: z.string(),
  description: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type Activity = {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}; 