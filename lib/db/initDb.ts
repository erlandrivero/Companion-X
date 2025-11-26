import { getDatabase } from "../mongodb";

/**
 * Initialize database with indexes and constraints
 * Run this once when setting up the application
 */
export async function initializeDatabase(): Promise<void> {
  console.log("🔧 Initializing database...");

  const db = await getDatabase();

  try {
    // Users Collection Indexes
    console.log("Creating indexes for 'users' collection...");
    const usersCollection = db.collection("users");
    await usersCollection.createIndexes([
      { key: { googleId: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { createdAt: 1 } },
      { key: { lastLogin: 1 } },
    ]);

    // Agents Collection Indexes
    console.log("Creating indexes for 'agents' collection...");
    const agentsCollection = db.collection("agents");
    await agentsCollection.createIndexes([
      { key: { userId: 1 } },
      { key: { userId: 1, "performanceMetrics.lastUsed": -1 } },
      { key: { expertise: 1 } },
      { key: { name: "text", description: "text" } }, // Text search
      { key: { createdAt: 1 } },
      { key: { "performanceMetrics.questionsHandled": -1 } },
    ]);

    // Conversations Collection Indexes
    console.log("Creating indexes for 'conversations' collection...");
    const conversationsCollection = db.collection("conversations");
    await conversationsCollection.createIndexes([
      { key: { sessionId: 1, userId: 1 }, unique: true },
      { key: { userId: 1, updatedAt: -1 } },
      { key: { "messages.agentUsed": 1 } },
      { key: { createdAt: 1 } },
      { key: { updatedAt: 1 } },
    ]);

    // Usage Logs Collection Indexes
    console.log("Creating indexes for 'usage_logs' collection...");
    const usageLogsCollection = db.collection("usage_logs");
    await usageLogsCollection.createIndexes([
      { key: { userId: 1, timestamp: -1 } },
      { key: { service: 1 } },
      { key: { timestamp: 1 } },
      { key: { "metadata.agentId": 1 } },
      { key: { success: 1 } },
    ]);

    // NextAuth Collections (created by adapter, but we can add indexes)
    console.log("Creating indexes for NextAuth collections...");
    
    const accountsCollection = db.collection("accounts");
    await accountsCollection.createIndexes([
      { key: { userId: 1 } },
      { key: { provider: 1, providerAccountId: 1 }, unique: true },
    ]);

    const sessionsCollection = db.collection("sessions");
    await sessionsCollection.createIndexes([
      { key: { sessionToken: 1 }, unique: true },
      { key: { userId: 1 } },
      { key: { expires: 1 } },
    ]);

    console.log("✅ Database initialization complete!");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  }
}

/**
 * Drop all indexes (for development/testing)
 */
export async function dropAllIndexes(): Promise<void> {
  console.log("🗑️  Dropping all indexes...");

  const db = await getDatabase();
  const collections = ["users", "agents", "conversations", "usage_logs"];

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      await collection.dropIndexes();
      console.log(`Dropped indexes for '${collectionName}'`);
    } catch (error) {
      console.log(`No indexes to drop for '${collectionName}'`);
    }
  }

  console.log("✅ All indexes dropped!");
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  collections: {
    name: string;
    count: number;
    size: number;
    indexes: number;
  }[];
}> {
  const db = await getDatabase();
  const collections = ["users", "agents", "conversations", "usage_logs"];

  const stats = [];

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      const collStats = await db.command({ collStats: collectionName });

      stats.push({
        name: collectionName,
        count,
        size: collStats.size || 0,
        indexes: indexes.length,
      });
    } catch (error) {
      stats.push({
        name: collectionName,
        count: 0,
        size: 0,
        indexes: 0,
      });
    }
  }

  return { collections: stats };
}

/**
 * Verify database connection
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    console.log("✅ Database connection verified!");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
