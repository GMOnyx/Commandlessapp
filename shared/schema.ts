import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email").unique(),
  role: text("role"),
  avatar: text("avatar"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  platformType: text("platform_type").notNull(), // 'discord' or 'telegram'
  botName: text("bot_name").notNull(),
  token: text("token").notNull(),
  clientId: text("client_id"),
  personalityContext: text("personality_context"), // Optional: Custom bot personality and context
  // Tutorial mode fields
  tutorialEnabled: boolean("tutorial_enabled").default(false),
  tutorialPersona: text("tutorial_persona"),
  isConnected: boolean("is_connected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBotSchema = createInsertSchema(bots).pick({
  userId: true,
  platformType: true,
  botName: true,
  token: true,
  clientId: true,
  personalityContext: true,
});

export const commandMappings = pgTable("command_mappings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  botId: text("bot_id").notNull(),
  name: text("name").notNull(),
  naturalLanguagePattern: text("natural_language_pattern").notNull(),
  commandOutput: text("command_output").notNull(),
  status: text("status").default("active"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommandMappingSchema = createInsertSchema(commandMappings).pick({
  userId: true,
  botId: true,
  name: true,
  naturalLanguagePattern: true,
  commandOutput: true,
  status: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

export type Bot = typeof bots.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;

export type CommandMapping = typeof commandMappings.$inferSelect;
export type InsertCommandMapping = z.infer<typeof insertCommandMappingSchema>;
