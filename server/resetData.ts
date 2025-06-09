import { storage } from "./storage";
import { log } from "./vite";

/**
 * Reset all application data
 * This is used for testing purposes to start with a clean slate
 */
export async function resetData() {
  try {
    await storage.clearAllData();
    log("All application data has been reset. The app is now in a clean state.", "storage");
    return true;
  } catch (error) {
    log(`Error resetting data: ${(error as Error).message}`, "storage");
    return false;
  }
} 