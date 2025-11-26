import { Agent, AgentMatchResult } from "@/types/agent";
import { sendMessageHaiku } from "./claude";
import { AGENT_DEFAULTS } from "../constants";

/**
 * Analyze a user question and match it to the most appropriate agent
 * Uses Claude Haiku for fast, cost-efficient semantic matching
 */
export async function analyzeQuestion(
  question: string,
  agents: Agent[],
  apiKey?: string
): Promise<AgentMatchResult> {
  // If no agents available, return null match
  if (agents.length === 0) {
    return {
      matchedAgent: null,
      confidence: 0,
      reasoning: "No agents available to match against.",
    };
  }

  // Create agent summaries for matching
  const agentSummaries = agents.map((agent, index) => ({
    index,
    id: agent._id?.toString() || "",
    name: agent.name,
    description: agent.description,
    expertise: agent.expertise.join(", "),
    capabilities: agent.capabilities.join(", "),
  }));

  const systemPrompt = `You are an intelligent agent matcher. Your job is to analyze a user's question and determine which specialized AI agent is best suited to answer it.

You will be given:
1. A user's question
2. A list of available agents with their expertise and capabilities

Your task:
- Analyze the question's topic, intent, and complexity
- Match it to the most appropriate agent based on expertise
- Provide a confidence score (0-100)
- Explain your reasoning

Respond in JSON format:
{
  "matchedAgentIndex": <index number or null>,
  "confidence": <0-100>,
  "reasoning": "<brief explanation>"
}

Guidelines:
- Look for EXACT keyword matches in agent name, expertise, or capabilities
- "Tableau" question → Tableau agent (high confidence)
- "SQL" question → Database agent (high confidence)
- "React" question → React agent (high confidence)
- Confidence >= 70: Strong match, route to this agent
- Confidence 40-69: Moderate match, suggest agent but ask user
- Confidence < 40: Weak match, suggest creating a new agent
- If no agent is suitable, set matchedAgentIndex to null
- IMPORTANT: Prioritize agents with matching technical terms/tools in their name or expertise`;

  const userPrompt = `Question: "${question}"

Available Agents:
${agentSummaries
  .map(
    (agent, i) => `
${i}. ${agent.name}
   Description: ${agent.description}
   Expertise: ${agent.expertise}
   Capabilities: ${agent.capabilities}
`
  )
  .join("\n")}

Analyze the question and determine the best agent match.`;

  console.log("🔍 Matching question:", question);
  console.log("🔍 Available agents:", agentSummaries.map(a => `${a.name} (${a.expertise})`).join(", "));

  try {
    const response = await sendMessageHaiku(userPrompt, {
      systemPrompt,
      enableCaching: false, // Don't cache for matching (varies too much)
      maxTokens: 1024,
      temperature: 0.3, // Lower temperature for more consistent matching
      apiKey, // Pass user's custom API key
    });

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from Claude");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate response
    if (
      typeof result.confidence !== "number" ||
      typeof result.reasoning !== "string"
    ) {
      throw new Error("Invalid response structure from Claude");
    }

    // Get matched agent if index is valid
    let matchedAgent: Agent | null = null;
    if (
      result.matchedAgentIndex !== null &&
      result.matchedAgentIndex >= 0 &&
      result.matchedAgentIndex < agents.length
    ) {
      matchedAgent = agents[result.matchedAgentIndex];
    }

    const matchResult = {
      matchedAgent,
      confidence: result.confidence / 100, // Convert to 0-1 range
      reasoning: result.reasoning,
    };

    console.log("✅ Match result:", {
      agent: matchedAgent?.name || "None",
      confidence: `${result.confidence}%`,
      reasoning: result.reasoning
    });

    return matchResult;
  } catch (error) {
    console.error("Agent matching error:", error);
    
    // Fallback: Simple keyword matching
    return fallbackKeywordMatch(question, agents);
  }
}

/**
 * Fallback keyword-based matching if Claude fails
 */
function fallbackKeywordMatch(
  question: string,
  agents: Agent[]
): AgentMatchResult {
  const questionLower = question.toLowerCase();
  let bestMatch: Agent | null = null;
  let bestScore = 0;

  for (const agent of agents) {
    let score = 0;

    // Check expertise keywords
    for (const expertise of agent.expertise) {
      if (questionLower.includes(expertise.toLowerCase())) {
        score += 3;
      }
    }

    // Check name
    if (questionLower.includes(agent.name.toLowerCase())) {
      score += 2;
    }

    // Check description words
    const descWords = agent.description.toLowerCase().split(" ");
    for (const word of descWords) {
      if (word.length > 4 && questionLower.includes(word)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  const confidence = Math.min(bestScore / 10, 0.7); // Cap at 70% for fallback

  return {
    matchedAgent: bestMatch,
    confidence,
    reasoning:
      confidence > 0.4
        ? `Keyword-based match found (fallback method)`
        : "No suitable agent found using keyword matching",
  };
}

/**
 * Determine if a new agent should be created for this question
 */
export async function shouldCreateNewAgent(
  question: string,
  matchResult: AgentMatchResult,
  apiKey?: string
): Promise<{
  shouldCreate: boolean;
  suggestedTopic: string;
  reasoning: string;
}> {
  // If we have a strong match, don't create new agent
  if (matchResult.confidence >= AGENT_DEFAULTS.MATCH_CONFIDENCE_THRESHOLD) {
    return {
      shouldCreate: false,
      suggestedTopic: "",
      reasoning: "Existing agent is well-suited for this question",
    };
  }

  const systemPrompt = `You are an AI agent advisor. Analyze a user's question and determine if a new specialized agent should be created to handle it.

Consider:
- Is this a specialized domain that would benefit from a dedicated agent?
- Would this topic likely come up again?
- Is it different enough from existing agents?

Respond in JSON format:
{
  "shouldCreate": <true/false>,
  "suggestedTopic": "<topic name if true, empty if false>",
  "reasoning": "<brief explanation>"
}`;

  const userPrompt = `Question: "${question}"

Current match confidence: ${(matchResult.confidence * 100).toFixed(0)}%
Current match reasoning: ${matchResult.reasoning}

Should we create a new specialized agent for this question?`;

  try {
    const response = await sendMessageHaiku(userPrompt, {
      systemPrompt,
      maxTokens: 512,
      temperature: 0.5,
      apiKey, // Pass user's custom API key
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      shouldCreate: result.shouldCreate === true,
      suggestedTopic: result.suggestedTopic || "",
      reasoning: result.reasoning || "",
    };
  } catch (error) {
    console.error("Agent creation suggestion error:", error);
    
    // Extract topic from question for fallback
    // Look for key nouns/topics in the question
    const words = question.toLowerCase().split(/\s+/);
    const keywords = words.filter(w => w.length > 4 && !['what', 'how', 'when', 'where', 'which', 'would', 'could', 'should', 'about', 'doing', 'today'].includes(w));
    const fallbackTopic = keywords.length > 0 
      ? keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1) + " Expert"
      : "General Assistant";
    
    // Conservative fallback: only suggest if confidence is very low
    return {
      shouldCreate: matchResult.confidence < 0.3,
      suggestedTopic: fallbackTopic,
      reasoning: "Fallback: Low confidence match suggests new agent might be useful",
    };
  }
}

/**
 * Extract keywords from a question for agent search
 */
export function extractKeywords(question: string): string[] {
  // Remove common words and extract meaningful keywords
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "can",
    "may",
    "might",
    "must",
    "what",
    "when",
    "where",
    "who",
    "why",
    "how",
    "which",
  ]);

  const words = question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !commonWords.has(word));

  // Remove duplicates
  return Array.from(new Set(words));
}
