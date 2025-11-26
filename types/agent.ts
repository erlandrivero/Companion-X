import { ObjectId } from "mongodb";

export interface Agent {
  _id?: ObjectId | string;
  name: string;
  description: string;
  expertise: string[];
  systemPrompt: string;
  knowledgeBase: {
    facts: string[];
    sources: string[];
    lastUpdated: Date;
  };
  capabilities: string[];
  conversationStyle: {
    tone: string;
    vocabulary: string;
    responseLength: string;
  };
  performanceMetrics: {
    questionsHandled: number;
    successRate: number;
    avgResponseTime: number;
    lastUsed: Date;
  };
  evolutionHistory: Evolution[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  userId: string;
}

export interface Evolution {
  date: Date;
  improvement: string;
  reason: string;
  changedFields: string[];
}

export interface AgentMatchResult {
  matchedAgent: Agent | null;
  confidence: number;
  reasoning: string;
}

export interface AgentCreationRequest {
  topic: string;
  initialPrompt: string;
  userId: string;
}

export interface AgentUpdateRequest {
  id: string;
  updates: Partial<Agent>;
  userId: string;
}
