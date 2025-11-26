export interface UsageLog {
  _id?: string;
  userId: string;
  timestamp: Date;
  service: "claude-haiku" | "claude-sonnet" | "elevenlabs" | "web-speech";
  endpoint: string;
  requestType: "chat" | "agent-creation" | "agent-evolution" | "voice";
  tokens: {
    input: number;
    output: number;
    cached: number;
  };
  characters: number;
  cost: number;
  success: boolean;
  errorMessage?: string;
  metadata: {
    agentId?: string;
    conversationId?: string;
    model: string;
    cachingEnabled: boolean;
  };
}

export interface UsageStats {
  currentMonth: {
    claudeHaikuTokens: number;
    claudeSonnetTokens: number;
    elevenLabsCharacters: number;
    totalCost: number;
    requestCount: number;
  };
  budgetStatus: {
    limit: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    alertTriggered: boolean;
  };
  history: MonthlyUsage[];
}

export interface MonthlyUsage {
  month: string;
  claudeHaikuTokens: number;
  claudeSonnetTokens: number;
  elevenLabsCharacters: number;
  totalCost: number;
  requestCount: number;
}

export interface CostCalculation {
  service: string;
  tokens?: {
    input: number;
    output: number;
    cached: number;
  };
  characters?: number;
  cost: number;
  breakdown: {
    inputCost?: number;
    outputCost?: number;
    cachedCost?: number;
    characterCost?: number;
  };
}
