import { Agent, AgentMatchResult } from "@/types/agent";
import { sendMessageWithTools } from "./claude";
import { AGENT_DEFAULTS } from "../constants";
import type { AgentSkill } from "@/types/skill";

/**
 * Enhanced agent matching with Claude function calling
 * Considers both agents and their skills for optimal matching
 */
export async function analyzeQuestionWithSkills(
  question: string,
  agents: Agent[],
  skills: AgentSkill[],
  apiKey?: string
): Promise<{
  matchedAgent: Agent | null;
  confidence: number;
  reasoning: string;
  suggestNewAgent?: boolean;
  suggestNewSkill?: boolean;
  suggestion?: string;
}> {
  // If no agents available, suggest creating one
  if (agents.length === 0) {
    return {
      matchedAgent: null,
      confidence: 0,
      reasoning: "No agents available.",
      suggestNewAgent: true,
      suggestion: "Create your first agent to get started!",
    };
  }

  // Build agent summaries with their skills
  const agentSummaries = agents.map((agent, index) => {
    const agentSkills = skills.filter(s => s.agentId === agent._id?.toString());
    return {
      index,
      id: agent._id?.toString() || "",
      name: agent.name,
      description: agent.description,
      expertise: agent.expertise.join(", "),
      capabilities: agent.capabilities.join(", "),
      skills: agentSkills.map(s => ({
        name: s.name,
        description: s.description,
      })),
    };
  });

  const systemPrompt = `You are an intelligent agent and skill matcher. Your job is to:
1. Analyze the user's question
2. Match it to the best agent based on expertise and available skills
3. Determine if a new agent or skill should be created
4. Provide confidence and reasoning

Consider:
- Agent expertise and capabilities (look for GENERAL expertise, not just exact matches)
- **EXISTING SKILLS**: Check if agent already has skills that cover the question
- Whether existing agents can handle this with a new skill
- Whether a completely new agent is needed

CRITICAL MATCHING RULES (FOLLOW IN ORDER):

**STEP 1: Check Existing Skills FIRST** (HIGHEST PRIORITY)
- Scan ALL agents' existing skills before suggesting anything new
- If ANY skill covers the question → Match that agent with confidence 80-95%
- Examples:
  * Weather expert with "European Weather" skill + "Burgos" = MATCH ✓ (Burgos is Spanish city in Europe)
  * Weather expert with "European Weather" skill + "Madrid" = MATCH ✓
  * Weather expert with "European Weather" skill + "Spain forecast" = MATCH ✓
  * Stock expert with "Cryptocurrency" skill + "Bitcoin" = MATCH ✓

**STEP 2: Geographic & Domain Understanding**
- European skills → ALL European countries (Spain, France, Germany, UK, Italy, Portugal, etc.)
- Asian skills → ALL Asian countries
- North American skills → USA, Canada, Mexico
- Cities belong to their countries (Madrid→Spain→Europe, Tokyo→Japan→Asia)
- Unit conversions (Fahrenheit/Celsius, miles/km) are PART OF the same domain
  * "Madrid in Fahrenheit" = Still weather question, use Weather skill ✓
  * "Convert to Celsius" = Still weather question, use Weather skill ✓

**STEP 3: Only Suggest New Skill If**
- Agent has related expertise BUT
- NO existing skill covers the question
- Example: Weather expert (no European skill) + "Madrid" = Suggest European skill

**STEP 4: Only Suggest New Agent If**
- Domain is completely different from ALL agents
- Example: Weather expert + "cooking recipe" = New agent

**PRIORITY ORDER**: Existing Skills > New Skill > New Agent`;

  const userPrompt = `Question: "${question}"

Available Agents and Skills:
${agentSummaries.map((agent, i) => `
${i}. ${agent.name}
   Description: ${agent.description}
   Expertise: ${agent.expertise}
   Capabilities: ${agent.capabilities}
   Existing Skills: ${agent.skills.length > 0 ? agent.skills.map(s => `\n     - ${s.name}: ${s.description}`).join('') : 'None'}
`).join("\n")}

IMPORTANT: Before suggesting a new agent or skill, CHECK if any agent's EXISTING SKILLS already cover this question.
Example: If Dr. Storm has "European Weather" skill and question is about "Burgos" (Spanish city), USE THE EXISTING SKILL.

Analyze and determine the best match.`;

  // Define the tool for structured matching
  const tools = [
    {
      name: "match_agent_with_recommendation",
      description: "Match user question to best agent and provide recommendations",
      input_schema: {
        type: "object" as const,
        properties: {
          matchedAgentIndex: {
            type: "number" as const,
            description: "Index of the best matching agent, or -1 if no good match",
          },
          confidence: {
            type: "number",
            description: "Confidence score from 0-100",
          },
          reasoning: {
            type: "string",
            description: "Explanation of the match decision",
          },
          suggestNewAgent: {
            type: "boolean",
            description: "Whether to suggest creating a new agent",
          },
          suggestNewSkill: {
            type: "boolean",
            description: "Whether to suggest adding a new skill to existing agent",
          },
          suggestion: {
            type: "string",
            description: "Suggested agent topic or skill name if applicable",
          },
        },
        required: ["matchedAgentIndex", "confidence", "reasoning", "suggestNewAgent", "suggestNewSkill"],
      },
    },
  ];

  console.log("🔍 Matching question:", question);
  console.log("🔍 Available agents:", agentSummaries.map(a => a.name).join(", "));
  console.log("🔍 Total skills:", skills.length);

  try {
    const response = await sendMessageWithTools(userPrompt, {
      systemPrompt,
      maxTokens: 2048,
      temperature: 0.3,
      apiKey,
      tools,
    });

    console.log("🔧 Tool response:", {
      hasToolUse: !!response.toolUse,
      toolName: response.toolUse?.name,
      content: response.content.substring(0, 100),
    });

    if (!response.toolUse || response.toolUse.name !== "match_agent_with_recommendation") {
      console.error("❌ No tool use in response. Content:", response.content);
      throw new Error("No tool use in response");
    }

    const result = response.toolUse.input;
    console.log("🔧 Tool input:", result);

    // Get matched agent if index is valid
    let matchedAgent: Agent | null = null;
    if (
      result.matchedAgentIndex !== null &&
      result.matchedAgentIndex >= 0 &&
      result.matchedAgentIndex < agents.length
    ) {
      matchedAgent = agents[result.matchedAgentIndex];
    }

    console.log("✅ Match result:", {
      agent: matchedAgent?.name || "None",
      confidence: `${result.confidence}%`,
      suggestNewAgent: result.suggestNewAgent,
      suggestNewSkill: result.suggestNewSkill,
      suggestion: result.suggestion,
      reasoning: result.reasoning,
    });

    // Check for duplicate skills before suggesting
    let suggestNewSkill = result.suggestNewSkill || false;
    let suggestion = result.suggestion || "";
    
    if (suggestNewSkill && matchedAgent && suggestion) {
      // Get agent's existing skills
      const agentSkills = skills.filter(s => 
        agents.find(a => a._id?.toString() === matchedAgent?._id?.toString())
      );
      
      // Check if a similar skill already exists
      const suggestionLower = suggestion.toLowerCase();
      const hasSimilarSkill = agentSkills.some(skill => {
        const skillNameLower = skill.name.toLowerCase();
        // Check for significant overlap in words
        const suggestionWords = suggestionLower.split(/\s+/).filter((w: string) => w.length > 3);
        const skillWords = skillNameLower.split(/\s+/).filter((w: string) => w.length > 3);
        const overlap = suggestionWords.filter((w: string) => skillWords.some((sw: string) => sw.includes(w) || w.includes(sw)));
        return overlap.length >= 2; // If 2+ words overlap, consider it duplicate
      });
      
      if (hasSimilarSkill) {
        console.log("⚠️ Similar skill already exists - not suggesting");
        suggestNewSkill = false;
        suggestion = "";
      }
    }

    return {
      matchedAgent,
      confidence: result.confidence / 100,
      reasoning: result.reasoning,
      suggestNewAgent: result.suggestNewAgent || false,
      suggestNewSkill,
      suggestion,
    };
  } catch (error) {
    console.error("Agent matching error:", error);
    
    // Fallback to simple keyword matching
    return fallbackKeywordMatch(question, agents);
  }
}

/**
 * Fallback keyword-based matching if Claude fails
 */
function fallbackKeywordMatch(
  question: string,
  agents: Agent[]
): {
  matchedAgent: Agent | null;
  confidence: number;
  reasoning: string;
  suggestNewAgent?: boolean;
  suggestNewSkill?: boolean;
  suggestion?: string;
} {
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

  const confidence = Math.min(bestScore / 10, 0.7);

  return {
    matchedAgent: bestMatch,
    confidence,
    reasoning: confidence > 0.4
      ? "Keyword-based match found (fallback method)"
      : "No suitable agent found using keyword matching",
    suggestNewAgent: confidence < 0.3,
    suggestNewSkill: false,
    suggestion: confidence < 0.3 ? "Consider creating a new specialized agent" : undefined,
  };
}
