import { getDatabase } from "../mongodb";
import { User } from "@/types/user";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = "users";

/**
 * Create a new user from Google OAuth profile
 */
export async function createUser(googleUser: {
  id: string;
  email: string;
  name: string;
  image: string;
}): Promise<User> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const newUser: User = {
    googleId: googleUser.id,
    email: googleUser.email,
    name: googleUser.name,
    image: googleUser.image,
    personalAgents: [],
    sharedAgents: [],
    preferences: {
      voiceEnabled: false,
      defaultVoice: "Bella",
      theme: "dark",
      exportFormat: "pdf",
    },
    subscription: {
      tier: "free",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    usage: {
      currentMonth: {
        claudeHaikuTokens: 0,
        claudeSonnetTokens: 0,
        elevenLabsCharacters: 0,
        totalCost: 0,
        requestCount: 0,
      },
      limits: {
        monthlyBudget: parseFloat(process.env.DEFAULT_MONTHLY_BUDGET || "50"),
        alertThreshold: parseFloat(process.env.BUDGET_ALERT_THRESHOLD || "80"),
        hardLimit: false,
      },
      history: [],
    },
    createdAt: new Date(),
    lastLogin: new Date(),
  };

  const result = await collection.insertOne(newUser);
  return { ...newUser, _id: result.insertedId.toString() };
}

/**
 * Get user by Google ID
 */
export async function getUser(googleId: string): Promise<User | null> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const user = await collection.findOne({ googleId });
  if (!user) return null;

  return {
    ...user,
    _id: user._id?.toString(),
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const user = await collection.findOne({ email });
  if (!user) return null;

  return {
    ...user,
    _id: user._id?.toString(),
  };
}

/**
 * Update user data
 */
export async function updateUser(
  googleId: string,
  updates: Partial<User>
): Promise<User | null> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    { googleId },
    { $set: updates },
    { returnDocument: "after" }
  );

  if (!result) return null;

  return {
    ...result,
    _id: result._id?.toString(),
  };
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(googleId: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  await collection.updateOne({ googleId }, { $set: { lastLogin: new Date() } });
}

/**
 * Update user's current month usage
 */
export async function updateUsage(
  googleId: string,
  usage: {
    claudeHaikuTokens?: number;
    claudeSonnetTokens?: number;
    elevenLabsCharacters?: number;
    totalCost?: number;
    requestCount?: number;
  }
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const updateFields: any = {};
  if (usage.claudeHaikuTokens !== undefined) {
    updateFields["usage.currentMonth.claudeHaikuTokens"] = usage.claudeHaikuTokens;
  }
  if (usage.claudeSonnetTokens !== undefined) {
    updateFields["usage.currentMonth.claudeSonnetTokens"] = usage.claudeSonnetTokens;
  }
  if (usage.elevenLabsCharacters !== undefined) {
    updateFields["usage.currentMonth.elevenLabsCharacters"] = usage.elevenLabsCharacters;
  }
  if (usage.totalCost !== undefined) {
    updateFields["usage.currentMonth.totalCost"] = usage.totalCost;
  }
  if (usage.requestCount !== undefined) {
    updateFields["usage.currentMonth.requestCount"] = usage.requestCount;
  }

  await collection.updateOne({ googleId }, { $inc: updateFields });
}

/**
 * Reset monthly usage (called at start of new month)
 */
export async function resetMonthlyUsage(googleId: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  const user = await collection.findOne({ googleId });
  if (!user) return;

  // Archive current month to history
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const historyEntry = {
    month: currentMonth,
    ...user.usage.currentMonth,
  };

  await collection.updateOne(
    { googleId },
    {
      $push: { "usage.history": historyEntry },
      $set: {
        "usage.currentMonth": {
          claudeHaikuTokens: 0,
          claudeSonnetTokens: 0,
          elevenLabsCharacters: 0,
          totalCost: 0,
          requestCount: 0,
        },
      },
    }
  );
}

/**
 * Add agent to user's personal agents
 */
export async function addPersonalAgent(
  googleId: string,
  agentId: string
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  await collection.updateOne(
    { googleId },
    { $addToSet: { personalAgents: agentId } }
  );
}

/**
 * Remove agent from user's personal agents
 */
export async function removePersonalAgent(
  googleId: string,
  agentId: string
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);

  await collection.updateOne(
    { googleId },
    { $pull: { personalAgents: agentId } }
  );
}

/**
 * Check if user has exceeded budget
 */
export async function checkBudgetStatus(googleId: string): Promise<{
  withinBudget: boolean;
  percentageUsed: number;
  alertTriggered: boolean;
}> {
  const user = await getUser(googleId);
  if (!user) {
    return { withinBudget: true, percentageUsed: 0, alertTriggered: false };
  }

  const { totalCost } = user.usage.currentMonth;
  const { monthlyBudget, alertThreshold } = user.usage.limits;

  const percentageUsed = (totalCost / monthlyBudget) * 100;
  const alertTriggered = percentageUsed >= alertThreshold;
  const withinBudget = percentageUsed < 100;

  return { withinBudget, percentageUsed, alertTriggered };
}
