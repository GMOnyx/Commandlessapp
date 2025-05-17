import { storage } from "./storage";
import { hashPassword } from "./middleware/auth";
import { Json } from "@shared/schema";

export async function setupSampleData() {
  console.log("Setting up sample data for Commandless...");

  // Create demo user if it doesn't exist
  let demoUser = await storage.getUserByUsername("demo");
  if (!demoUser) {
    demoUser = await storage.createUser({
      username: "demo",
      password: hashPassword("password123"),
      name: "Demo User",
      email: "demo@example.com",
      role: "Admin",
      avatar: null
    });
    console.log("Created demo user");
  }

  // Check for existing bots
  const existingBots = await storage.getBots(demoUser.id);
  if (existingBots.length === 0) {
    // Create sample Discord bot
    const discordBot = await storage.createBot({
      userId: demoUser.id,
      platformType: "discord",
      botName: "Moderation Bot",
      token: "sample_discord_token",
      clientId: "12345678901234567"
    });
    
    // Update bot connection status after creation
    await storage.updateBotConnection(discordBot.id, true);
    console.log("Created sample Discord bot");

    // Create sample Telegram bot
    const telegramBot = await storage.createBot({
      userId: demoUser.id,
      platformType: "telegram",
      botName: "Community Helper",
      token: "sample_telegram_token",
      clientId: null
    });
    
    // Update bot connection status after creation
    await storage.updateBotConnection(telegramBot.id, true);
    console.log("Created sample Telegram bot");

    // Create sample Discord bot for games
    const gameBot = await storage.createBot({
      userId: demoUser.id,
      platformType: "discord",
      botName: "Game Stats Bot",
      token: "another_discord_token",
      clientId: "98765432109876543"
    });
    console.log("Created sample Game bot");

    // Add sample command mappings for Discord bot
    let banCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: discordBot.id,
      name: "Ban User",
      naturalLanguagePattern: "Ban {user} for {reason}",
      commandOutput: "!ban @{user} {reason}",
      status: "active"
    });
    
    // Manually update usage count for demonstration
    for (let i = 0; i < 24; i++) {
      await storage.incrementCommandUsage(banCommand.id);
    }

    let muteCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: discordBot.id,
      name: "Mute User",
      naturalLanguagePattern: "Mute {user} for {duration} because {reason}",
      commandOutput: "!mute @{user} {duration} {reason}",
      status: "active"
    });
    
    // Manually update usage count
    for (let i = 0; i < 15; i++) {
      await storage.incrementCommandUsage(muteCommand.id);
    }

    let warnCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: discordBot.id,
      name: "Warn User",
      naturalLanguagePattern: "Warn {user} about {reason}",
      commandOutput: "!warn @{user} {reason}",
      status: "active"
    });
    
    // Manually update usage count
    for (let i = 0; i < 42; i++) {
      await storage.incrementCommandUsage(warnCommand.id);
    }

    // Add sample command mappings for Telegram bot
    let pollCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: telegramBot.id,
      name: "Create Poll",
      naturalLanguagePattern: "Create a poll about {topic} with options {options}",
      commandOutput: "/poll {topic} - {options}",
      status: "active"
    });
    
    // Manually update usage count
    for (let i = 0; i < 8; i++) {
      await storage.incrementCommandUsage(pollCommand.id);
    }

    let weatherCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: telegramBot.id,
      name: "Get Weather",
      naturalLanguagePattern: "What's the weather in {location}",
      commandOutput: "/weather {location}",
      status: "active"
    });
    
    // Manually update usage count
    for (let i = 0; i < 32; i++) {
      await storage.incrementCommandUsage(weatherCommand.id);
    }

    // Add sample command mapping for Game bot
    let statsCommand = await storage.createCommandMapping({
      userId: demoUser.id,
      botId: gameBot.id,
      name: "Player Stats",
      naturalLanguagePattern: "Show stats for {player} in {game}",
      commandOutput: "!stats {game} player={player}",
      status: "active"
    });
    
    // Manually update usage count
    for (let i = 0; i < 19; i++) {
      await storage.incrementCommandUsage(statsCommand.id);
    }

    // Add sample activities
    await storage.createActivity({
      userId: demoUser.id,
      activityType: "bot_connected",
      description: `Bot ${discordBot.botName} was connected`,
      metadata: { botId: discordBot.id, platformType: discordBot.platformType } as Json
    });

    await storage.createActivity({
      userId: demoUser.id,
      activityType: "command_created",
      description: `Command mapping "Ban User" was created`,
      metadata: { mappingId: banCommand.id, botId: discordBot.id } as Json
    });

    await storage.createActivity({
      userId: demoUser.id,
      activityType: "command_used",
      description: `Command mapping "Ban User" was used`,
      metadata: { 
        mappingId: banCommand.id, 
        userInput: "Ban trollUser for spamming",
        commandOutput: "!ban @trollUser spamming"
      } as Json
    });

    await storage.createActivity({
      userId: demoUser.id,
      activityType: "bot_connected",
      description: `Bot ${telegramBot.botName} was connected`,
      metadata: { botId: telegramBot.id, platformType: telegramBot.platformType } as Json
    });

    await storage.createActivity({
      userId: demoUser.id,
      activityType: "command_used",
      description: `Command mapping "Get Weather" was used`,
      metadata: { 
        mappingId: weatherCommand.id, 
        userInput: "What's the weather in New York",
        commandOutput: "/weather New York"
      } as Json
    });

    console.log("Created sample command mappings and activities");
  } else {
    console.log("Sample data already exists, skipping creation");
  }

  console.log("Sample data setup complete!");
}