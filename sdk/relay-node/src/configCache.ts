import { postJson } from "./http.js";

export interface BotConfig {
  version: number;
  enabled: boolean;
  channelMode: 'all' | 'whitelist' | 'blacklist';
  enabledChannels: string[];
  disabledChannels: string[];
  permissionMode: 'all' | 'whitelist' | 'blacklist' | 'premium_only';
  enabledRoles: string[];
  disabledRoles: string[];
  enabledUsers: string[];
  disabledUsers: string[];
  premiumRoleIds: string[];
  premiumUserIds: string[];
  enabledCommandCategories: string[];
  disabledCommands: string[];
  commandMode: 'all' | 'category_based' | 'whitelist' | 'blacklist';
  mentionRequired: boolean;
  customPrefix: string | null;
  triggerMode: 'mention' | 'prefix' | 'always';
  freeRateLimit: number;
  premiumRateLimit: number;
  serverRateLimit: number;
  confidenceThreshold: number;
  requireConfirmation: boolean;
  dangerousCommands: string[];
  responseStyle: 'friendly' | 'professional' | 'minimal';
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface MessageContext {
  channelId: string;
  authorId: string;
  guildId?: string;
  memberRoles?: string[];
}

export class ConfigCache {
  private config: BotConfig | null = null;
  private rateLimits = new Map<string, RateLimitEntry>();
  private serverRateLimits = new Map<string, RateLimitEntry>();
  private baseUrl: string;
  private apiKey: string;
  private botId: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Fetch configuration from backend
   */
  async fetch(botId: string): Promise<BotConfig | null> {
    try {
      this.botId = botId;
      const currentVersion = this.config?.version || 0;
      
      const url = `${this.baseUrl}/v1/relay/config?botId=${botId}&version=${currentVersion}`;
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error(`[commandless] Failed to fetch config: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // If up to date, keep existing config
      if (data.upToDate && this.config) {
        return this.config;
      }

      // Update config
      this.config = data as BotConfig;
      console.log(`[commandless] Config loaded (v${this.config.version})`);
      
      return this.config;
    } catch (error) {
      console.error('[commandless] Error fetching config:', error);
      return null;
    }
  }

  /**
   * Start polling for config updates every 30 seconds
   */
  startPolling(botId: string, intervalMs: number = 30000): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      try {
        await this.fetch(botId);
      } catch (error) {
        console.error('[commandless] Config poll error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Get current config (may be null if not fetched yet)
   */
  getConfig(): BotConfig | null {
    return this.config;
  }

  /**
   * Check if a message should be processed based on config
   */
  shouldProcessMessage(ctx: MessageContext): { allowed: boolean; reason?: string } {
    // If no config loaded yet, allow (fail open for initial startup)
    if (!this.config) {
      return { allowed: true };
    }

    // Check if bot is enabled
    if (!this.config.enabled) {
      return { allowed: false, reason: 'Bot disabled' };
    }

    // Check channel permissions
    const channelCheck = this.checkChannel(ctx.channelId);
    if (!channelCheck.allowed) {
      return channelCheck;
    }

    // Check user/role permissions
    const permissionCheck = this.checkPermissions(ctx.authorId, ctx.memberRoles);
    if (!permissionCheck.allowed) {
      return permissionCheck;
    }

    // Check rate limits
    const rateLimitCheck = this.checkRateLimit(ctx.authorId, ctx.guildId, ctx.memberRoles);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    return { allowed: true };
  }

  /**
   * Check if channel is allowed
   */
  private checkChannel(channelId: string): { allowed: boolean; reason?: string } {
    if (!this.config) return { allowed: true };

    switch (this.config.channelMode) {
      case 'whitelist':
        if (!this.config.enabledChannels.includes(channelId)) {
          return { allowed: false, reason: 'Channel not whitelisted' };
        }
        break;
      case 'blacklist':
        if (this.config.disabledChannels.includes(channelId)) {
          return { allowed: false, reason: 'Channel blacklisted' };
        }
        break;
      case 'all':
      default:
        break;
    }

    return { allowed: true };
  }

  /**
   * Check if user has permission
   */
  private checkPermissions(userId: string, memberRoles?: string[]): { allowed: boolean; reason?: string } {
    if (!this.config) return { allowed: true };

    const roles = memberRoles || [];

    // Check if user is explicitly disabled
    if (this.config.disabledUsers.includes(userId)) {
      return { allowed: false, reason: 'User blacklisted' };
    }

    // Check permission mode
    switch (this.config.permissionMode) {
      case 'premium_only': {
        const isPremiumRole = roles.some(roleId => this.config!.premiumRoleIds.includes(roleId));
        const isPremiumUser = (this.config.premiumUserIds || []).includes(userId);
        const isPremium = isPremiumRole || isPremiumUser;
        if (!isPremium) {
          return { allowed: false, reason: 'Premium only' };
        }
        break;
      }
      case 'whitelist': {
        const hasEnabledRole = roles.some(roleId => this.config!.enabledRoles.includes(roleId));
        const isEnabledUser = this.config.enabledUsers.includes(userId);
        if (!hasEnabledRole && !isEnabledUser) {
          return { allowed: false, reason: 'No required role' };
        }
        break;
      }
      case 'blacklist': {
        const hasDisabledRole = roles.some(roleId => this.config!.disabledRoles.includes(roleId));
        if (hasDisabledRole) {
          return { allowed: false, reason: 'Role blacklisted' };
        }
        break;
      }
      case 'all':
      default:
        break;
    }

    return { allowed: true };
  }

  /**
   * Check rate limits (local check, server has final authority)
   */
  private checkRateLimit(userId: string, guildId?: string, memberRoles?: string[]): { allowed: boolean; reason?: string } {
    if (!this.config) return { allowed: true };

    const now = Date.now();
    const roles = memberRoles || [];
    const isPremiumRole = roles.some(roleId => this.config!.premiumRoleIds.includes(roleId));
    const isPremiumUser = (this.config.premiumUserIds || []).includes(userId);
    const isPremium = isPremiumRole || isPremiumUser;
    
    // User rate limit
    const userLimit = isPremium ? this.config.premiumRateLimit : this.config.freeRateLimit;
    const userKey = `user:${userId}`;
    const userEntry = this.rateLimits.get(userKey);

    if (!userEntry || now > userEntry.resetAt) {
      // Start new window
      this.rateLimits.set(userKey, {
        count: 1,
        resetAt: now + 60 * 60 * 1000, // 1 hour
      });
    } else {
      // Check limit
      if (userEntry.count >= userLimit) {
        return { allowed: false, reason: `Rate limit (${userLimit}/hr)` };
      }
      userEntry.count++;
    }

    // Server rate limit (if in guild)
    if (guildId) {
      const serverLimit = this.config.serverRateLimit;
      const serverKey = `server:${guildId}`;
      const serverEntry = this.serverRateLimits.get(serverKey);

      if (!serverEntry || now > serverEntry.resetAt) {
        this.serverRateLimits.set(serverKey, {
          count: 1,
          resetAt: now + 60 * 60 * 1000,
        });
      } else {
        if (serverEntry.count >= serverLimit) {
          return { allowed: false, reason: `Server rate limit (${serverLimit}/hr)` };
        }
        serverEntry.count++;
      }
    }

    return { allowed: true };
  }

  /**
   * Clean up old rate limit entries (call periodically)
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.rateLimits.entries()) {
      if (now > entry.resetAt) {
        this.rateLimits.delete(key);
      }
    }

    for (const [key, entry] of this.serverRateLimits.entries()) {
      if (now > entry.resetAt) {
        this.serverRateLimits.delete(key);
      }
    }
  }
}

