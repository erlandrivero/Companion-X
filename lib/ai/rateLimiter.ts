/**
 * Rate Limiting for AI API Calls
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed
   */
  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No entry or window expired, create new entry
    if (!entry || now >= entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Rate limiters for different AI operations
export const haikuLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests per minute
  windowMs: 60 * 1000,
});

export const sonnetLimiter = new RateLimiter({
  maxRequests: 50, // 50 requests per minute (more expensive)
  windowMs: 60 * 1000,
});

export const userLimiter = new RateLimiter({
  maxRequests: 50, // 50 requests per user per minute
  windowMs: 60 * 1000,
});

/**
 * Check if user can make a request
 */
export async function checkUserRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  return await userLimiter.checkLimit(userId);
}

/**
 * Check if Haiku request is allowed
 */
export async function checkHaikuRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  return await haikuLimiter.checkLimit("haiku");
}

/**
 * Check if Sonnet request is allowed
 */
export async function checkSonnetRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  return await sonnetLimiter.checkLimit("sonnet");
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimiters(): void {
  haikuLimiter.cleanup();
  sonnetLimiter.cleanup();
  userLimiter.cleanup();
}

// Clean up every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimiters, 5 * 60 * 1000);
}

/**
 * Format time until reset
 */
export function formatResetTime(resetTime: number): string {
  const seconds = Math.ceil((resetTime - Date.now()) / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
