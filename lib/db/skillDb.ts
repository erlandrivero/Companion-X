import { getDatabase } from "../mongodb";
import { AgentSkill } from "@/types/skill";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = "agent_skills";

/**
 * Create a new skill for an agent
 */
export async function createSkill(
  skill: Omit<AgentSkill, "_id" | "createdAt" | "updatedAt" | "usage">,
  agentId: string
): Promise<AgentSkill> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const newSkill: AgentSkill = {
    ...skill,
    agentId,
    usage: {
      timesInvoked: 0,
      lastUsed: new Date(),
      successRate: 0,
      averageResponseTime: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(newSkill);
  return { ...newSkill, _id: result.insertedId.toString() };
}

/**
 * Get all skills for an agent
 */
export async function getAgentSkills(agentId: string): Promise<AgentSkill[]> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const skills = await collection
    .find({ agentId })
    .sort({ "usage.timesInvoked": -1 })
    .toArray();

  return skills.map((skill) => ({
    ...skill,
    _id: skill._id?.toString(),
  }));
}

/**
 * Get a specific skill by ID
 */
export async function getSkill(skillId: string): Promise<AgentSkill | null> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const skill = await collection.findOne({ _id: new ObjectId(skillId) });

  if (!skill) return null;

  return {
    ...skill,
    _id: skill._id?.toString(),
  };
}

/**
 * Update a skill
 */
export async function updateSkill(
  skillId: string,
  updates: Partial<AgentSkill>
): Promise<AgentSkill | null> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(skillId) },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
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
 * Delete a skill
 */
export async function deleteSkill(skillId: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const result = await collection.deleteOne({ _id: new ObjectId(skillId) });
  return result.deletedCount > 0;
}

/**
 * Increment skill usage
 */
export async function incrementSkillUsage(
  skillId: string,
  responseTime: number
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  // Get current skill to calculate new average
  const skill = await collection.findOne({ _id: new ObjectId(skillId) });
  if (!skill) return;

  const currentAvg = skill.usage.averageResponseTime;
  const currentCount = skill.usage.timesInvoked;
  const newAvg = (currentAvg * currentCount + responseTime) / (currentCount + 1);

  await collection.updateOne(
    { _id: new ObjectId(skillId) },
    {
      $inc: { "usage.timesInvoked": 1 },
      $set: {
        "usage.lastUsed": new Date(),
        "usage.averageResponseTime": newAvg,
      },
    }
  );
}

/**
 * Update skill success rate
 */
export async function updateSkillSuccessRate(
  skillId: string,
  wasSuccessful: boolean
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const skill = await collection.findOne({ _id: new ObjectId(skillId) });
  if (!skill) return;

  const currentRate = skill.usage.successRate;
  const currentCount = skill.usage.timesInvoked;
  const successCount = Math.round(currentRate * currentCount);
  const newSuccessCount = successCount + (wasSuccessful ? 1 : 0);
  const newRate = newSuccessCount / Math.max(currentCount, 1);

  await collection.updateOne(
    { _id: new ObjectId(skillId) },
    {
      $set: {
        "usage.successRate": newRate,
      },
    }
  );
}

/**
 * Search skills by tags or description
 */
export async function searchSkills(
  query: string,
  agentId?: string
): Promise<AgentSkill[]> {
  const db = await getDatabase();
  const collection = db.collection<AgentSkill>(COLLECTION_NAME);

  const filter: any = {
    $or: [
      { name: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { "metadata.tags": { $regex: query, $options: "i" } },
    ],
  };

  if (agentId) {
    filter.agentId = agentId;
  }

  const skills = await collection.find(filter).toArray();

  return skills.map((skill) => ({
    ...skill,
    _id: skill._id?.toString(),
  }));
}
