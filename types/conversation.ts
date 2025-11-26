export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  agentUsed: string | null; // Agent ID
  agentName?: string; // Agent display name
  timestamp: Date;
  voiceEnabled: boolean;
}

export interface Conversation {
  _id?: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  messages: Message[];
  agentsSuggested: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  voiceEnabled: boolean;
}

export interface ChatResponse {
  response: string;
  agentUsed: {
    id: string;
    name: string;
  } | null;
  suggestion?: string;
  tokensUsed: {
    input: number;
    output: number;
    cached: number;
  };
  cost: number;
}
