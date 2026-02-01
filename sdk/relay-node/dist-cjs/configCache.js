"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigCache = void 0;
class ConfigCache {
    constructor(baseUrl, apiKey) {
        this.config = null;
        this.rateLimits = new Map();
        this.serverRateLimits = new Map();
        this.botId = null;
        this.pollInterval = null;
        this.forcedRefetchDone = false;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    /**
     * Fetch configuration from backend
     */
    async fetch(botId) {
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
            this.config = data;
            console.log(`[commandless] Config loaded (v${this.config.version}) premiumUserIds.length=${(this.config.premiumUserIds || []).length}`);
            // If premium_only but no premium IDs, force one refetch (in case of stale/cached response)
            if (!this.forcedRefetchDone && this.config.permissionMode === 'premium_only' && (this.config.premiumUserIds || []).length === 0) {
                this.forcedRefetchDone = true;
                console.log(`[commandless] premium_only with empty premiumUserIds - forcing one refetch`);
                this.config = null;
                return this.fetch(botId);
            }
            return this.config;
        }
        catch (error) {
            console.error('[commandless] Error fetching config:', error);
            return null;
        }
    }
    /**
     * Start polling for config updates every 30 seconds
     */
    startPolling(botId, intervalMs = 30000) {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(async () => {
            try {
                await this.fetch(botId);
            }
            catch (error) {
                console.error('[commandless] Config poll error:', error);
            }
        }, intervalMs);
    }
    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    /**
     * Get current config (may be null if not fetched yet)
     */
    getConfig() {
        return this.config;
    }
    /**
     * Check if a message should be processed based on config
     */
    shouldProcessMessage(ctx) {
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
    checkChannel(channelId) {
        if (!this.config)
            return { allowed: true };
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
    checkPermissions(userId, memberRoles) {
        if (!this.config)
            return { allowed: true };
        const roles = memberRoles || [];
        // Check if user is explicitly disabled
        if (this.config.disabledUsers.includes(userId)) {
            return { allowed: false, reason: 'User blacklisted' };
        }
        // Check permission mode
        switch (this.config.permissionMode) {
            case 'premium_only': {
                const isPremiumRole = roles.some(roleId => this.config.premiumRoleIds.includes(roleId));
                const premiumIds = (this.config.premiumUserIds || []).map(id => String(id).trim()).filter(Boolean);
                const authorIdStr = String(userId).trim();
                const isPremiumUser = premiumIds.includes(authorIdStr);
                const isPremium = isPremiumRole || isPremiumUser;
                // Diagnostic: masked format hint to spot ID type mismatch
                const uidSuffix = authorIdStr.slice(-4);
                const firstPremiumSuffix = premiumIds[0] ? premiumIds[0].slice(-4) : 'none';
                console.log(`[commandless] premium_only check: premiumUserIds.length=${premiumIds.length}, isPremiumUser=${isPremiumUser}, allowed=${isPremium} (authorId ends ...${uidSuffix}, first premiumId ends ...${firstPremiumSuffix})`);
                if (!isPremium) {
                    return { allowed: false, reason: 'Premium only' };
                }
                break;
            }
            case 'whitelist': {
                const hasEnabledRole = roles.some(roleId => this.config.enabledRoles.includes(roleId));
                const isEnabledUser = this.config.enabledUsers.includes(userId);
                if (!hasEnabledRole && !isEnabledUser) {
                    return { allowed: false, reason: 'No required role' };
                }
                break;
            }
            case 'blacklist': {
                const hasDisabledRole = roles.some(roleId => this.config.disabledRoles.includes(roleId));
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
    checkRateLimit(userId, guildId, memberRoles) {
        if (!this.config)
            return { allowed: true };
        const now = Date.now();
        const roles = memberRoles || [];
        const isPremiumRole = roles.some(roleId => this.config.premiumRoleIds.includes(roleId));
        const premiumIds = (this.config.premiumUserIds || []).map(id => String(id).trim()).filter(Boolean);
        const authorIdStr = String(userId).trim();
        const isPremiumUser = premiumIds.includes(authorIdStr);
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
        }
        else {
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
            }
            else {
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
    cleanupRateLimits() {
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
exports.ConfigCache = ConfigCache;
