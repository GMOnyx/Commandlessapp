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
interface MessageContext {
    channelId: string;
    authorId: string;
    guildId?: string;
    memberRoles?: string[];
}
export declare class ConfigCache {
    private config;
    private rateLimits;
    private serverRateLimits;
    private baseUrl;
    private apiKey;
    private botId;
    private pollInterval;
    private forcedRefetchDone;
    constructor(baseUrl: string, apiKey: string);
    /**
     * Fetch configuration from backend
     */
    fetch(botId: string): Promise<BotConfig | null>;
    /**
     * Start polling for config updates every 30 seconds
     */
    startPolling(botId: string, intervalMs?: number): void;
    /**
     * Stop polling
     */
    stopPolling(): void;
    /**
     * Get current config (may be null if not fetched yet)
     */
    getConfig(): BotConfig | null;
    /**
     * Check if a message should be processed based on config
     */
    shouldProcessMessage(ctx: MessageContext): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Check if channel is allowed
     */
    private checkChannel;
    /**
     * Check if user has permission
     */
    private checkPermissions;
    /**
     * Check rate limits (local check, server has final authority)
     */
    private checkRateLimit;
    /**
     * Clean up old rate limit entries (call periodically)
     */
    cleanupRateLimits(): void;
}
export {};
