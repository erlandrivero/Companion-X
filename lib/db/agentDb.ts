import { getDatabase } from "../mongodb";
import { Agent, Evolution } from "@/types/agent";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = "agents";

/**
 * Create a new agent
 */
export async function createAgent(
  agent: Omit<Agent, "_id" | "userId" | "createdAt" | "updatedAt" | "version" | "performanceMetrics" | "evolutionHistory">,
  userId: string
): Promise<Agent> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const newAgent: Agent = {
    ...agent,
    userId,
    performanceMetrics: {
      questionsHandled: 0,
      successRate: 0,
      avgResponseTime: 0,
      lastUsed: new Date(),
    },
    evolutionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  const result = await collection.insertOne(newAgent);
  return { ...newAgent, _id: result.insertedId.toString() };
}

/**
 * Get agent by ID (with user ownership check)
 */
export async function getAgent(
  id: string,
  userId: string
): Promise<Agent | null> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const agent = await collection.findOne({
    _id: new ObjectId(id),
    userId,
  });

  if (!agent) return null;

  return {
    ...agent,
    _id: agent._id?.toString(),
  };
}

/**
 * Get all agents for a user
 */
export async function getUserAgents(userId: string): Promise<Agent[]> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const agents = await collection
    .find({ userId })
    .sort({ "performanceMetrics.lastUsed": -1 })
    .toArray();

  return agents.map((agent) => ({
    ...agent,
    _id: agent._id?.toString(),
  }));
}

/**
 * Update agent
 */
export async function updateAgent(
  id: string,
  userId: string,
  updates: Partial<Agent>
): Promise<Agent | null> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { returnDocument: "after" }
  );

  if (!result) return null;

  return {
    ...result,
    _id: result._id?.toString(),
  };
}

/**
 * Delete agent
 */
export async function deleteAgent(
  id: string,
  userId: string
): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const result = await collection.deleteOne({
    _id: new ObjectId(id),
    userId,
  });

  return result.deletedCount > 0;
}

/**
 * Search agents by expertise keywords
 */
export async function searchAgentsByExpertise(
  keywords: string[],
  userId: string
): Promise<Agent[]> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const agents = await collection
    .find({
      userId,
      $or: [
        { expertise: { $in: keywords } },
        { name: { $regex: keywords.join("|"), $options: "i" } },
        { description: { $regex: keywords.join("|"), $options: "i" } },
      ],
    })
    .toArray();

  return agents.map((agent) => ({
    ...agent,
    _id: agent._id?.toString(),
  }));
}

/**
 * Log agent evolution
 */
export async function logAgentEvolution(
  agentId: string,
  evolution: Omit<Evolution, "date">
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const evolutionEntry: Evolution = {
    ...evolution,
    date: new Date(),
  };

  await collection.updateOne(
    { _id: new ObjectId(agentId) },
    {
      $push: { evolutionHistory: evolutionEntry },
      $set: { updatedAt: new Date() },
      $inc: { version: 1 },
    }
  );
}

/**
 * Update agent performance metrics
 */
export async function updateAgentMetrics(
  agentId: string,
  metrics: {
    questionsHandled?: number;
    successRate?: number;
    avgResponseTime?: number;
  }
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const updateFields: any = {
    "performanceMetrics.lastUsed": new Date(),
  };

  if (metrics.questionsHandled !== undefined) {
    updateFields["performanceMetrics.questionsHandled"] = metrics.questionsHandled;
  }
  if (metrics.successRate !== undefined) {
    updateFields["performanceMetrics.successRate"] = metrics.successRate;
  }
  if (metrics.avgResponseTime !== undefined) {
    updateFields["performanceMetrics.avgResponseTime"] = metrics.avgResponseTime;
  }

  await collection.updateOne(
    { _id: new ObjectId(agentId) },
    { $set: updateFields }
  );
}

/**
 * Increment questions handled count
 */
export async function incrementQuestionsHandled(agentId: string): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  await collection.updateOne(
    { _id: new ObjectId(agentId) },
    {
      $inc: { "performanceMetrics.questionsHandled": 1 },
      $set: { "performanceMetrics.lastUsed": new Date() },
    }
  );
}

/**
 * Share agent with other users
 */
export async function shareAgent(
  agentId: string,
  withUserIds: string[]
): Promise<void> {
  // This would update the sharedAgents array in the User collection
  // Implementation depends on sharing model (copy vs reference)
  const db = await getDatabase();
  const usersCollection = db.collection("users");

  await usersCollection.updateMany(
    { googleId: { $in: withUserIds } },
    { $addToSet: { sharedAgents: agentId } }
  );
}

/**
 * Get agent count for user
 */
export async function getAgentCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  return await collection.countDocuments({ userId });
}

/**
 * Get most used agents
 */
export async function getMostUsedAgents(
  userId: string,
  limit: number = 5
): Promise<Agent[]> {
  const db = await getDatabase();
  const collection = db.collection<Agent>(COLLECTION_NAME);

  const agents = await collection
    .find({ userId })
    .sort({ "performanceMetrics.questionsHandled": -1 })
    .limit(limit)
    .toArray();

  return agents.map((agent) => ({
    ...agent,
    _id: agent._id?.toString(),
  }));
}
