import { getDatabase } from "../mongodb";
import { UsageLog, UsageStats, MonthlyUsage } from "@/types/usage";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = "usage_logs";

/**
 * Log API usage
 */
export async function logUsage(log: Omit<UsageLog, "_id">): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  await collection.insertOne({
    ...log,
    timestamp: new Date(),
  });
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsageStats(
  userId: string,
  period: "current" | "history" = "current"
): Promise<UsageStats> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  // Get last 30 days stats (rolling window to avoid timezone issues)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const currentMonthLogs = await collection
    .find({
      userId,
      timestamp: { $gte: thirtyDaysAgo },
    })
    .toArray();

  const currentMonthStats = calculateMonthlyStats(currentMonthLogs);

  // Get user's budget settings
  const usersDb = db.collection("users");
  const user = await usersDb.findOne({ googleId: userId });
  const monthlyBudget = user?.usage?.limits?.monthlyBudget || 50;

  const budgetStatus = {
    limit: monthlyBudget,
    used: currentMonthStats.totalCost,
    remaining: monthlyBudget - currentMonthStats.totalCost,
    percentageUsed: (currentMonthStats.totalCost / monthlyBudget) * 100,
    alertTriggered:
      (currentMonthStats.totalCost / monthlyBudget) * 100 >=
      (user?.usage?.limits?.alertThreshold || 80),
  };

  // Get history if requested
  let history: MonthlyUsage[] = [];
  if (period === "history") {
    history = await getUsageHistory(userId, 6);
  }

  return {
    currentMonth: currentMonthStats,
    budgetStatus,
    history,
  };
}

/**
 * Get usage history for specified number of months
 */
export async function getUsageHistory(
  userId: string,
  months: number = 6
): Promise<MonthlyUsage[]> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  const history: MonthlyUsage[] = [];
  const currentDate = new Date();

  for (let i = 0; i < months; i++) {
    const targetDate = new Date(currentDate);
    targetDate.setMonth(targetDate.getMonth() - i);
    const monthStr = targetDate.toISOString().slice(0, 7);

    const startOfMonth = new Date(monthStr + "-01");
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const logs = await collection
      .find({
        userId,
        timestamp: { $gte: startOfMonth, $lt: endOfMonth },
      })
      .toArray();

    const stats = calculateMonthlyStats(logs);
    history.push({
      month: monthStr,
      ...stats,
    });
  }

  return history;
}

/**
 * Calculate monthly statistics from logs
 */
function calculateMonthlyStats(logs: UsageLog[]): {
  claudeHaikuTokens: number;
  claudeSonnetTokens: number;
  elevenLabsCharacters: number;
  totalCost: number;
  requestCount: number;
} {
  let claudeHaikuTokens = 0;
  let claudeSonnetTokens = 0;
  let elevenLabsCharacters = 0;
  let totalCost = 0;
  let requestCount = logs.length;

  for (const log of logs) {
    if (log.service === "claude-haiku") {
      claudeHaikuTokens += log.tokens.input + log.tokens.output;
    } else if (log.service === "claude-sonnet") {
      claudeSonnetTokens += log.tokens.input + log.tokens.output;
    } else if (log.service === "elevenlabs") {
      elevenLabsCharacters += log.characters;
    }
    totalCost += log.cost;
  }

  return {
    claudeHaikuTokens,
    claudeSonnetTokens,
    elevenLabsCharacters,
    totalCost,
    requestCount,
  };
}

/**
 * Get usage breakdown by service
 */
export async function getUsageBreakdown(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  claudeHaiku: { requests: number; cost: number };
  claudeSonnet: { requests: number; cost: number };
  elevenlabs: { requests: number; cost: number };
  webSpeech: { requests: number; cost: number };
}> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  const logs = await collection
    .find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate },
    })
    .toArray();

  const breakdown = {
    claudeHaiku: { requests: 0, cost: 0 },
    claudeSonnet: { requests: 0, cost: 0 },
    elevenlabs: { requests: 0, cost: 0 },
    webSpeech: { requests: 0, cost: 0 },
  };

  for (const log of logs) {
    switch (log.service) {
      case "claude-haiku":
        breakdown.claudeHaiku.requests++;
        breakdown.claudeHaiku.cost += log.cost;
        break;
      case "claude-sonnet":
        breakdown.claudeSonnet.requests++;
        breakdown.claudeSonnet.cost += log.cost;
        break;
      case "elevenlabs":
        breakdown.elevenlabs.requests++;
        breakdown.elevenlabs.cost += log.cost;
        break;
      case "web-speech":
        breakdown.webSpeech.requests++;
        breakdown.webSpeech.cost += log.cost;
        break;
    }
  }

  return breakdown;
}

/**
 * Get total cost for current month (uses last 30 days for better accuracy)
 */
export async function getCurrentMonthCost(userId: string): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  // Use last 30 days instead of calendar month to avoid timezone issues
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await collection
    .find({
      userId,
      timestamp: { $gte: thirtyDaysAgo },
    })
    .toArray();

  return logs.reduce((sum, log) => sum + log.cost, 0);
}

/**
 * Get caching savings
 */
export async function getCachingSavings(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCachedTokens: number;
  estimatedSavings: number;
}> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  const logs = await collection
    .find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate },
      "metadata.cachingEnabled": true,
    })
    .toArray();

  let totalCachedTokens = 0;
  let estimatedSavings = 0;

  for (const log of logs) {
    totalCachedTokens += log.tokens.cached;

    // Calculate savings (90% discount on cached tokens)
    if (log.service === "claude-haiku") {
      estimatedSavings += (log.tokens.cached / 1_000_000) * 1.0 * 0.9;
    } else if (log.service === "claude-sonnet") {
      estimatedSavings += (log.tokens.cached / 1_000_000) * 3.0 * 0.9;
    }
  }

  return {
    totalCachedTokens,
    estimatedSavings,
  };
}

/**
 * Clean up old usage logs (older than specified days)
 */
export async function cleanupOldLogs(olderThanDays: number = 365): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<UsageLog>(COLLECTION_NAME);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await collection.deleteMany({
    timestamp: { $lt: cutoffDate },
  });

  return result.deletedCount;
}
