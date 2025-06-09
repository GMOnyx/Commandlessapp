import { log } from '../vite';

interface Conversation {
  userId: string;
  channelId: string;
  lastMessageTime: number;
  pendingCommand?: {
    commandId: number;
    params: Record<string, string>;
    confidence: number;
  };
  clarificationQuestion?: string;
  originalMessage?: string;
}

// Store active conversations with a timeout
// Key: `${userId}:${channelId}`
const activeConversations = new Map<string, Conversation>();

// Conversation timeout in milliseconds (5 minutes)
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;

// Clean up old conversations periodically
setInterval(() => {
  const now = Date.now();
  Array.from(activeConversations.entries()).forEach(([key, conversation]) => {
    if (now - conversation.lastMessageTime > CONVERSATION_TIMEOUT) {
      activeConversations.delete(key);
      log(`Cleaned up expired conversation for ${key}`, 'discord');
    }
  });
}, 60000); // Check every minute

/**
 * Get an active conversation
 */
export function getConversation(userId: string, channelId: string): Conversation | undefined {
  const key = `${userId}:${channelId}`;
  const conversation = activeConversations.get(key);
  
  // Check if conversation is expired
  if (conversation && Date.now() - conversation.lastMessageTime > CONVERSATION_TIMEOUT) {
    activeConversations.delete(key);
    return undefined;
  }
  
  return conversation;
}

/**
 * Create or update a conversation context
 */
export function updateConversation(
  userId: string, 
  channelId: string, 
  updates: Partial<Omit<Conversation, 'userId' | 'channelId' | 'lastMessageTime'>>
): Conversation {
  const key = `${userId}:${channelId}`;
  let existing = activeConversations.get(key);
  
  // If conversation exists but is expired, treat as new
  if (existing && Date.now() - existing.lastMessageTime > CONVERSATION_TIMEOUT) {
    activeConversations.delete(key);
    existing = undefined;
  }
  
  const conversation: Conversation = {
    userId,
    channelId,
    lastMessageTime: Date.now(),
    ...existing,
    ...updates
  };
  
  activeConversations.set(key, conversation);
  return conversation;
}

/**
 * End a conversation by removing it from active conversations
 */
export function endConversation(userId: string, channelId: string): void {
  const key = `${userId}:${channelId}`;
  activeConversations.delete(key);
}

/**
 * Check if a message is an affirmative response to a clarification question
 */
export function isAffirmativeResponse(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  const affirmativeResponses = [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'absolutely',
    'confirm', 'confirmed', 'ok', 'okay', 'y', 'ye', 'ya', 'yea', 'indeed',
    'affirmative', 'certainly', 'definitely', 'exactly', '👍', 'yes please', 
    'that\'s right', 'that is right', 'that\'s correct', 'that is correct'
  ];
  
  return affirmativeResponses.some(response => 
    normalized === response || normalized.startsWith(response + ' ')
  );
}

/**
 * Check if a message is a negative response to a clarification question
 */
export function isNegativeResponse(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  const negativeResponses = [
    'no', 'nope', 'nah', 'negative', 'never', 'not', 'n', 'wrong', 'incorrect',
    'noo', 'nooo', 'no way', 'definitely not', 'absolutely not', '👎', 
    'no thanks', 'that\'s wrong', 'that is wrong', 'that\'s incorrect', 'that is incorrect'
  ];
  
  return negativeResponses.some(response => 
    normalized === response || normalized.startsWith(response + ' ')
  );
} 