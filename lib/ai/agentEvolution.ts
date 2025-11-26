import { Agent } from "@/types/agent";
import { Message } from "@/types/conversation";
import { sendMessageSonnet } from "./claude";

export interface EvolutionSuggestion {
  needsImprovement: boolean;
  suggestions: string[];
  updatedFields: Partial<Agent>;
  reasoning: string;
  priority: "low" | "medium" | "high";
}

/**
 * Analyze agent performance and suggest improvements
 * Uses Claude Sonnet for high-quality analysis
 */
export async function analyzeAgentPerformance(
  agent: Agent,
  recentConversations: Message[]
): Promise<EvolutionSuggestion> {
  // If no conversations, no improvements needed yet
  if (recentConversations.length === 0) {
    return {
      needsImprovement: false,
      suggestions: [],
      updatedFields: {},
      reasoning: "No conversation data available for analysis",
      priority: "low",
    };
  }

  const systemPrompt = `You are an AI agent performance analyst. Your job is to analyze an agent's performance based on recent conversations and suggest improvements.

Analyze:
1. Response quality and relevance
2. Knowledge gaps
3. Tone and style consistency
4. Capability coverage
5. Areas for expansion

Respond in JSON format:
{
  "needsImprovement": <true/false>,
  "suggestions": ["<suggestion1>", "<suggestion2>", ...],
  "updatedFields": {
    "expertise": ["<updated expertise if needed>"],
    "capabilities": ["<updated capabilities if needed>"],
    "knowledgeBase": {
      "facts": ["<new facts to add>"]
    },
    "systemPrompt": "<updated system prompt if needed>"
  },
  "reasoning": "<explanation of why improvements are needed>",
  "priority": "<low|medium|high>"
}

Only include fields in updatedFields that actually need updating.`;

  // Format recent conversations for analysis
  const conversationSummary = recentConversations
    .slice(-10) // Last 10 messages
    .map((msg, i) => `${i + 1}. [${msg.role}]: ${msg.content.substring(0, 200)}...`)
    .join("\n");

  const userPrompt = `Agent Profile:
Name: ${agent.name}
Description: ${agent.description}
Expertise: ${agent.expertise.join(", ")}
Capabilities: ${agent.capabilities.join(", ")}
Questions Handled: ${agent.performanceMetrics.questionsHandled}

Recent Conversations:
${conversationSummary}

Analyze this agent's performance and suggest improvements if needed.`;

  try {
    const response = await sendMessageSonnet(userPrompt, {
      systemPrompt,
      enableCaching: true, // Cache the system prompt
      maxTokens: 3072,
      temperature: 0.6,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from Claude");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (typeof result.needsImprovement !== "boolean") {
      throw new Error("Invalid response structure");
    }

    // Add timestamp to knowledge base if updated
    if (result.updatedFields?.knowledgeBase) {
      result.updatedFields.knowledgeBase.lastUpdated = new Date();
    }

    return {
      needsImprovement: result.needsImprovement,
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      updatedFields: result.updatedFields || {},
      reasoning: result.reasoning || "",
      priority: result.priority || "low",
    };
  } catch (error) {
    console.error("Agent evolution analysis error:", error);
    
    // Fallback: Basic heuristic analysis
    return performBasicAnalysis(agent, recentConversations);
  }
}

/**
 * Fallback analysis using basic heuristics
 */
function performBasicAnalysis(
  agent: Agent,
  recentConversations: Message[]
): EvolutionSuggestion {
  const suggestions: string[] = [];
  const updatedFields: Partial<Agent> = {};

  // Check if agent has handled enough questions
  if (agent.performanceMetrics.questionsHandled < 5) {
    return {
      needsImprovement: false,
      suggestions: ["Need more conversation data to analyze performance"],
      updatedFields: {},
      reasoning: "Insufficient data for meaningful analysis",
      priority: "low",
    };
  }

  // Check for knowledge gaps (simple heuristic)
  const userQuestions = recentConversations
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content.toLowerCase());

  const commonWords = extractCommonWords(userQuestions);
  const missingExpertise = commonWords.filter(
    (word) => !agent.expertise.some((exp) => exp.toLowerCase().includes(word))
  );

  if (missingExpertise.length > 0) {
    suggestions.push(
      `Consider adding expertise in: ${missingExpertise.slice(0, 3).join(", ")}`
    );
  }

  // Check response length consistency
  const assistantResponses = recentConversations
    .filter((msg) => msg.role === "assistant")
    .map((msg) => msg.content.length);

  if (assistantResponses.length > 0) {
    const avgLength =
      assistantResponses.reduce((a, b) => a + b, 0) / assistantResponses.length;
    
    if (avgLength < 100) {
      suggestions.push("Responses seem too brief, consider more detailed answers");
    } else if (avgLength > 1000) {
      suggestions.push("Responses might be too verbose, consider being more concise");
    }
  }

  return {
    needsImprovement: suggestions.length > 0,
    suggestions,
    updatedFields,
    reasoning: "Basic heuristic analysis based on conversation patterns",
    priority: suggestions.length > 2 ? "medium" : "low",
  };
}

/**
 * Extract common words from user questions
 */
function extractCommonWords(questions: string[]): string[] {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set([
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
  ]);

  for (const question of questions) {
    const words = question
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 4 && !stopWords.has(word));

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Return words that appear more than once
  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5);
}

/**
 * Identify knowledge gaps in agent's responses
 */
export async function identifyKnowledgeGaps(
  agent: Agent,
  failedQuestions: string[]
): Promise<{
  gaps: string[];
  suggestedFacts: string[];
  suggestedSources: string[];
}> {
  if (failedQuestions.length === 0) {
    return { gaps: [], suggestedFacts: [], suggestedSources: [] };
  }

  const systemPrompt = `You are a knowledge gap analyst. Identify what knowledge an AI agent is missing based on questions it couldn't answer well.

Respond in JSON format:
{
  "gaps": ["<gap1>", "<gap2>", ...],
  "suggestedFacts": ["<fact1>", "<fact2>", ...],
  "suggestedSources": ["<source1>", "<source2>", ...]
}`;

  const userPrompt = `Agent: ${agent.name}
Current Expertise: ${agent.expertise.join(", ")}

Questions the agent struggled with:
${failedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

What knowledge gaps exist and what should be added?`;

  try {
    const response = await sendMessageSonnet(userPrompt, {
      systemPrompt,
      maxTokens: 2048,
      temperature: 0.5,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      gaps: Array.isArray(result.gaps) ? result.gaps : [],
      suggestedFacts: Array.isArray(result.suggestedFacts)
        ? result.suggestedFacts
        : [],
      suggestedSources: Array.isArray(result.suggestedSources)
        ? result.suggestedSources
        : [],
    };
  } catch (error) {
    console.error("Knowledge gap identification error:", error);
    return { gaps: [], suggestedFacts: [], suggestedSources: [] };
  }
}

/**
 * Suggest new capabilities for an agent
 */
export async function suggestNewCapabilities(
  agent: Agent,
  userRequests: string[]
): Promise<string[]> {
  if (userRequests.length === 0) {
    return [];
  }

  const systemPrompt = `You are a capability advisor. Based on user requests, suggest new capabilities an AI agent should have.

Respond with a JSON array of capability strings:
["<capability1>", "<capability2>", ...]

Capabilities should be:
- Specific and actionable
- Relevant to the agent's domain
- Not already in the agent's current capabilities`;

  const userPrompt = `Agent: ${agent.name}
Current Capabilities: ${agent.capabilities.join(", ")}

User Requests:
${userRequests.map((r, i) => `${i + 1}. ${r}`).join("\n")}

What new capabilities should this agent have?`;

  try {
    const response = await sendMessageSonnet(userPrompt, {
      systemPrompt,
      maxTokens: 1024,
      temperature: 0.6,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const capabilities = JSON.parse(jsonMatch[0]);

    return Array.isArray(capabilities) ? capabilities : [];
  } catch (error) {
    console.error("Capability suggestion error:", error);
    return [];
  }
}

/**
 * Calculate evolution priority based on agent metrics
 */
export function calculateEvolutionPriority(agent: Agent): "low" | "medium" | "high" {
  const { questionsHandled, successRate } = agent.performanceMetrics;

  // High priority if many questions but low success rate
  if (questionsHandled > 20 && successRate < 0.7) {
    return "high";
  }

  // Medium priority if moderate usage with room for improvement
  if (questionsHandled > 10 && successRate < 0.85) {
    return "medium";
  }

  // Low priority otherwise
  return "low";
}
