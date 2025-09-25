// Pseudocode example (not wired to discord.js in this repo)
import { RelayClient } from "@commandless/relay-node";

async function main() {
  const client = new RelayClient({ apiKey: process.env.COMMANDLESS_API_KEY! });
  // You would wire useDiscordAdapter({ client: discordClient, relay: client }) in your bot
  console.log("Relay ready");
}

main();

