import { storage } from "./storage";
import { hashPassword } from "./middleware/auth";
import { log } from "./vite";

/**
 * Set up sample data for demonstration purposes
 */
export async function setupSampleData() {
  try {
    // Check if we already have a test user
    const testUser = await storage.getUserByUsername("admin");
    
    if (testUser) {
      log("Sample data already exists", "setup");
      return;
    }
    
    // Create admin user
    const user = await storage.createUser({
      username: "admin",
      password: hashPassword("admin123"),
      name: "Administrator",
      email: "admin@example.com",
      role: "admin"
    });
    
    log(`Created test user: ${user.username} (ID: ${user.id})`, "setup");
    
    // Create a test Discord bot
    const discordBot = await storage.createBot({
      userId: user.id,
      platformType: "discord",
      botName: "TestBot",
      token: "discord-bot-token-here",
      clientId: "discord-client-id-here",
    });
    
    log(`Created test Discord bot: ${discordBot.botName}`, "setup");

    // Create a test Telegram bot
    const telegramBot = await storage.createBot({
      userId: user.id,
      platformType: "telegram",
      botName: "TelegramTestBot",
      token: "telegram-bot-token-here",
    });
    
    log(`Created test Telegram bot: ${telegramBot.botName}`, "setup");
    
    // Create sample command mappings for Discord bot
    const commands = [
      {
      name: "Ban User",
        naturalLanguagePattern: "ban {user} {reason}",
        commandOutput: "!ban @{user} {reason}"
      },
      {
        name: "Kick User",
        naturalLanguagePattern: "kick {user} {reason}",
        commandOutput: "!kick @{user} {reason}"
      },
      {
        name: "Set Role",
        naturalLanguagePattern: "give {user} the {role} role",
        commandOutput: "!role @{user} {role}"
      },
      {
        name: "Create Channel",
        naturalLanguagePattern: "create a channel named {name} in {category}",
        commandOutput: "!createchannel {name} {category}"
      }
    ];
    
    for (const cmd of commands) {
      const mapping = await storage.createCommandMapping({
        userId: user.id,
      botId: discordBot.id,
        name: cmd.name,
        naturalLanguagePattern: cmd.naturalLanguagePattern,
        commandOutput: cmd.commandOutput,
      status: "active"
    });
    
      log(`Created command mapping: ${mapping.name}`, "setup");
    }

    // Create sample activity records
    await storage.createActivity({
      userId: user.id,
      activityType: "system",
      description: "System initialized with sample data",
      metadata: { timestamp: new Date().toISOString() }
    });
    
    log("Sample data setup complete", "setup");
  } catch (error) {
    log(`Error setting up sample data: ${(error as Error).message}`, "setup");
  }
}