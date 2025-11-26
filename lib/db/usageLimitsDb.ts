import { getDatabase } from "../mongodb";
import { ObjectId } from "mongodb";

export interface UserUsage {
  _id?: ObjectId;
  userId: string;
  date: string; // YYYY-MM-DD format for daily reset
  tokensUsed: number;
  requestsThisHour: number;
  costAccumulated: number;
  lastRequestTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageLimits {
  maxTokensPerDay: number;
  maxRequestsPerHour: number;
  maxCostPerDay: number;
  requireAuth: boolean;
}

const DEFAULT_TRIAL_LIMITS: UsageLimits = {
  maxTokensPerDay: 10000,      // ~20-30 messages
  maxRequestsPerHour: 20,       // Prevent abuse
  maxCostPerDay: 1.0,           // $1/day trial
  requireAuth: true,
};

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current hour key for rate limiting
 */
function getCurrentHourKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
}

/**
 * Get user's usage for today
 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
  try {
    const db = await getDatabase();
    const today = getTodayString();
    
    let usage = await db.collection<UserUsage>("user_usage").findOne({
      userId,
      date: today,
    });

    // Create new usage record if doesn't exist or is from previous day
    if (!usage) {
      const newUsage: UserUsage = {
        userId,
        date: today,
        tokensUsed: 0,
        requestsThisHour: 0,
        costAccumulated: 0,
        lastRequestTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection<UserUsage>("user_usage").insertOne(newUsage);
      return newUsage;
    }

    return usage;
  } catch (error) {
    console.error("Error getting user usage:", error);
    // Return empty usage on error
    return {
      userId,
      date: getTodayString(),
      tokensUsed: 0,
      requestsThisHour: 0,
      costAccumulated: 0,
      lastRequestTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Check if user has exceeded their limits
 */
export async function checkUsageLimits(
  userId: string,
  limits: UsageLimits = DEFAULT_TRIAL_LIMITS
): Promise<{
  allowed: boolean;
  reason?: string;
  usage: UserUsage;
}> {
  const usage = await getUserUsage(userId);
  const now = new Date();
  const hoursSinceLastRequest = (now.getTime() - new Date(usage.lastRequestTime).getTime()) / (1000 * 60 * 60);

  // Reset hourly counter if more than 1 hour has passed
  if (hoursSinceLastRequest >= 1) {
    usage.requestsThisHour = 0;
  }

  // Check daily token limit
  if (usage.tokensUsed >= limits.maxTokensPerDay) {
    return {
      allowed: false,
      reason: `Daily token limit reached (${limits.maxTokensPerDay} tokens). Your limit resets at midnight UTC. Please add your own API key in Settings to continue.`,
      usage,
    };
  }

  // Check hourly request limit
  if (usage.requestsThisHour >= limits.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: `Hourly request limit reached (${limits.maxRequestsPerHour} requests). Please wait an hour or add your own API key in Settings.`,
      usage,
    };
  }

  // Check daily cost limit
  if (usage.costAccumulated >= limits.maxCostPerDay) {
    return {
      allowed: false,
      reason: `Daily cost limit reached ($${limits.maxCostPerDay}). Your limit resets at midnight UTC. Please add your own API key in Settings to continue.`,
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

/**
 * Record usage after a request
 */
export async function recordUsage(
  userId: string,
  tokens: number,
  cost: number
): Promise<void> {
  try {
    const db = await getDatabase();
    const today = getTodayString();

    await db.collection<UserUsage>("user_usage").updateOne(
      { userId, date: today },
      {
        $inc: {
          tokensUsed: tokens,
          requestsThisHour: 1,
          costAccumulated: cost,
        },
        $set: {
          lastRequestTime: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error recording usage:", error);
  }
}

/**
 * Get usage summary for display
 */
export async function getUsageSummary(userId: string, limits: UsageLimits = DEFAULT_TRIAL_LIMITS) {
  const usage = await getUserUsage(userId);

  return {
    tokens: {
      used: usage.tokensUsed,
      limit: limits.maxTokensPerDay,
      percentage: Math.round((usage.tokensUsed / limits.maxTokensPerDay) * 100),
      remaining: Math.max(0, limits.maxTokensPerDay - usage.tokensUsed),
    },
    requests: {
      used: usage.requestsThisHour,
      limit: limits.maxRequestsPerHour,
      percentage: Math.round((usage.requestsThisHour / limits.maxRequestsPerHour) * 100),
      remaining: Math.max(0, limits.maxRequestsPerHour - usage.requestsThisHour),
    },
    cost: {
      used: usage.costAccumulated,
      limit: limits.maxCostPerDay,
      percentage: Math.round((usage.costAccumulated / limits.maxCostPerDay) * 100),
      remaining: Math.max(0, limits.maxCostPerDay - usage.costAccumulated),
    },
    resetsAt: new Date(new Date().setUTCHours(24, 0, 0, 0)), // Midnight UTC
  };
}
