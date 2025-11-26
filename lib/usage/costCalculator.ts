import { CLAUDE_COSTS, ELEVENLABS_COSTS } from "../constants";
import { CostCalculation } from "@/types/usage";

export function calculateClaudeHaikuCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): CostCalculation {
  const inputCost = (inputTokens / 1_000_000) * CLAUDE_COSTS.HAIKU.INPUT;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_COSTS.HAIKU.OUTPUT;
  const cachedCost = (cachedTokens / 1_000_000) * CLAUDE_COSTS.HAIKU.CACHED_INPUT;
  
  return {
    service: "claude-haiku",
    tokens: { input: inputTokens, output: outputTokens, cached: cachedTokens },
    cost: inputCost + outputCost + cachedCost,
    breakdown: {
      inputCost,
      outputCost,
      cachedCost,
    },
  };
}

export function calculateClaudeSonnetCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): CostCalculation {
  const inputCost = (inputTokens / 1_000_000) * CLAUDE_COSTS.SONNET.INPUT;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_COSTS.SONNET.OUTPUT;
  const cachedCost = (cachedTokens / 1_000_000) * CLAUDE_COSTS.SONNET.CACHED_INPUT;
  
  return {
    service: "claude-sonnet",
    tokens: { input: inputTokens, output: outputTokens, cached: cachedTokens },
    cost: inputCost + outputCost + cachedCost,
    breakdown: {
      inputCost,
      outputCost,
      cachedCost,
    },
  };
}

export function calculateElevenLabsCost(characters: number): CostCalculation {
  const characterCost = characters / ELEVENLABS_COSTS.CHARACTERS_PER_DOLLAR;
  
  return {
    service: "elevenlabs",
    characters,
    cost: characterCost,
    breakdown: {
      characterCost,
    },
  };
}

export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(4)}k`;
  }
  return `$${cost.toFixed(4)}`;
}

export function calculateSavingsFromCaching(
  cachedTokens: number,
  model: "haiku" | "sonnet"
): number {
  const costs = model === "haiku" ? CLAUDE_COSTS.HAIKU : CLAUDE_COSTS.SONNET;
  const fullCost = (cachedTokens / 1_000_000) * costs.INPUT;
  const cachedCost = (cachedTokens / 1_000_000) * costs.CACHED_INPUT;
  return fullCost - cachedCost;
}
