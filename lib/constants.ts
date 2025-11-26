// API Cost Constants (per 1M tokens)
export const CLAUDE_COSTS = {
  HAIKU: {
    INPUT: 1.0,
    OUTPUT: 5.0,
    CACHED_INPUT: 0.1,
  },
  SONNET: {
    INPUT: 3.0,
    OUTPUT: 15.0,
    CACHED_INPUT: 0.3,
  },
} as const;

// ElevenLabs Constants
export const ELEVENLABS_COSTS = {
  CHARACTERS_PER_DOLLAR: 6000, // Approximate for $5/month plan
  MONTHLY_LIMIT: parseInt(process.env.ELEVENLABS_MONTHLY_LIMIT || "30000"),
} as const;

// Budget Constants
export const BUDGET_DEFAULTS = {
  MONTHLY_BUDGET: parseFloat(process.env.DEFAULT_MONTHLY_BUDGET || "50"),
  ALERT_THRESHOLD: parseFloat(process.env.BUDGET_ALERT_THRESHOLD || "80"),
} as const;

// Agent Constants
export const AGENT_DEFAULTS = {
  MATCH_CONFIDENCE_THRESHOLD: 0.7,
  MAX_AGENTS_PER_USER: 50,
  MAX_EVOLUTION_HISTORY: 20,
} as const;

// Conversation Constants
export const CONVERSATION_DEFAULTS = {
  MAX_MESSAGES_PER_SESSION: 100,
  SESSION_TIMEOUT_HOURS: 24,
} as const;

// Model Names - Claude 4 Family
export const CLAUDE_MODELS = {
  HAIKU: "claude-haiku-4-5-20251001",
  SONNET: "claude-sonnet-4-5-20250929",
} as const;
