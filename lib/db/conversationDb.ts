import { getDatabase } from "../mongodb";
import { Conversation, Message } from "@/types/conversation";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = "conversations";

/**
 * Create a new conversation
 */
export async function createConversation(
  sessionId: string,
  userId: string,
  userEmail: string
): Promise<Conversation> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const newConversation: Conversation = {
    sessionId,
    userId,
    userEmail,
    messages: [],
    agentsSuggested: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(newConversation);
  return { ...newConversation, _id: result.insertedId.toString() };
}

/**
 * Add message to conversation
 */
export async function addMessage(
  sessionId: string,
  userId: string,
  message: Message
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  await collection.updateOne(
    { sessionId, userId },
    {
      $push: { messages: message },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Get conversation by session ID
 */
export async function getConversation(
  sessionId: string,
  userId: string
): Promise<Conversation | null> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const conversation = await collection.findOne({ sessionId, userId });
  if (!conversation) return null;

  return {
    ...conversation,
    _id: conversation._id?.toString(),
  };
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(
  userId: string,
  limit: number = 50
): Promise<Conversation[]> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const conversations = await collection
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return conversations.map((conv) => ({
    ...conv,
    _id: conv._id?.toString(),
  }));
}

/**
 * Delete conversation
 */
export async function deleteConversation(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const result = await collection.deleteOne({ sessionId, userId });
  return result.deletedCount > 0;
}

/**
 * Add suggested agent to conversation
 */
export async function addSuggestedAgent(
  sessionId: string,
  userId: string,
  agentId: string
): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  await collection.updateOne(
    { sessionId, userId },
    { $addToSet: { agentsSuggested: agentId } }
  );
}

/**
 * Get recent conversations with specific agent
 */
export async function getConversationsWithAgent(
  userId: string,
  agentId: string,
  limit: number = 10
): Promise<Conversation[]> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const conversations = await collection
    .find({
      userId,
      "messages.agentUsed": agentId,
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return conversations.map((conv) => ({
    ...conv,
    _id: conv._id?.toString(),
  }));
}

/**
 * Get conversation statistics for user
 */
export async function getConversationStats(userId: string): Promise<{
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
}> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const conversations = await collection.find({ userId }).toArray();

  const totalConversations = conversations.length;
  const totalMessages = conversations.reduce(
    (sum, conv) => sum + conv.messages.length,
    0
  );
  const averageMessagesPerConversation =
    totalConversations > 0 ? totalMessages / totalConversations : 0;

  return {
    totalConversations,
    totalMessages,
    averageMessagesPerConversation,
  };
}

/**
 * Clean up old conversations (older than specified days)
 */
export async function cleanupOldConversations(
  userId: string,
  olderThanDays: number = 90
): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<Conversation>(COLLECTION_NAME);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await collection.deleteMany({
    userId,
    updatedAt: { $lt: cutoffDate },
  });

  return result.deletedCount;
}
