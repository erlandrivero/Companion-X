export interface User {
  _id?: string;
  googleId: string;
  email: string;
  name: string;
  image: string;
  personalAgents: string[];
  sharedAgents: string[];
  preferences: {
    voiceEnabled: boolean;
    defaultVoice: string;
    theme: "light" | "dark";
    exportFormat: "pdf" | "docx" | "txt";
  };
  subscription: {
    tier: "free" | "pro" | "enterprise";
    startDate: Date;
    endDate: Date;
  };
  usage: {
    currentMonth: {
      claudeHaikuTokens: number;
      claudeSonnetTokens: number;
      elevenLabsCharacters: number;
      totalCost: number;
      requestCount: number;
    };
    limits: {
      monthlyBudget: number;
      alertThreshold: number;
      hardLimit: boolean;
    };
    history: Array<{
      month: string;
      claudeHaikuTokens: number;
      claudeSonnetTokens: number;
      elevenLabsCharacters: number;
      totalCost: number;
      requestCount: number;
    }>;
  };
  createdAt: Date;
  lastLogin: Date;
}
