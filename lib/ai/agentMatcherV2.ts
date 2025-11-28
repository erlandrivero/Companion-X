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
  needsClarification?: boolean;
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

**STEP 3: ALWAYS Suggest New Skill If** (DEFAULT TO SUGGESTING SKILLS)
- Agent matches BUT has NO existing skill that specifically covers the question
- Question is about ANY specific topic, subtopic, or specialized area
- RULE: If the agent doesn't have a skill with that exact topic name, SUGGEST IT
- Examples:
  * Dr. Lee agent + "neuro networks" (no neuro skill) = Suggest "Neural Networks" skill ✓ REQUIRED
  * Dr. Lee agent + "Medium articles" (no publication skill) = Suggest "Published Articles" skill ✓ REQUIRED
  * Weather expert + "Madrid" (no European skill) = Suggest "European Weather" skill ✓ REQUIRED
  * Finance expert + "cryptocurrency" (no crypto skill) = Suggest "Cryptocurrency" skill ✓ REQUIRED

**STEP 4: Only Suggest New Agent If**
- Domain is completely different from ALL agents
- Example: Weather expert + "cooking recipe" = New agent

**PRIORITY ORDER**: Existing Skills > **SUGGEST NEW SKILL** > New Agent

**CRITICAL RULE**: 
- If agent has 0-2 skills → ALWAYS suggest a skill for any specific topic
- If question mentions a specific technology/topic/area → ALWAYS suggest a skill
- Default behavior: SUGGEST SKILL unless agent already has that exact skill
- Only let agent respond WITHOUT suggesting skill if they have 5+ skills covering the area`;

  const userPrompt = `Question: "${question}"

Available Agents and Skills:
${agentSummaries.map((agent, i) => `
${i}. ${agent.name}
   Description: ${agent.description}
   Expertise: ${agent.expertise}
   Capabilities: ${agent.capabilities}
   Existing Skills: ${agent.skills.length > 0 ? agent.skills.map(s => `\n     - ${s.name}: ${s.description}`).join('') : 'None'}
`).join("\n")}

CRITICAL RULES:
1. Before suggesting a new agent or skill, CHECK if any agent's EXISTING SKILLS already cover this question
2. If the question asks to create an agent that ALREADY EXISTS (same person/topic), DO NOT suggest a new agent - instead MATCH to the existing agent
3. Examples:
   - "Create agent for Dr. Ernesto Lee" + Dr. Lee agent exists = MATCH existing agent (index of Dr. Lee), confidence 95%
   - "European Weather" skill exists + "Burgos" question = USE EXISTING SKILL
   - "Create weather agent" + Dr. Storm exists = MATCH Dr. Storm, don't create duplicate

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
      console.log("❌ No tool use in response. Content:", response.content);
      
      // Check if Claude is asking for clarification
      const contentLower = response.content.toLowerCase();
      const isAskingForClarification = 
        contentLower.includes("clarify") ||
        contentLower.includes("rephrase") ||
        contentLower.includes("unclear") ||
        contentLower.includes("garbled") ||
        contentLower.includes("incoherent") ||
        contentLower.includes("could you");
      
      if (isAskingForClarification) {
        console.log("💬 Claude is asking for clarification - returning special response");
        return {
          matchedAgent: null,
          confidence: 0,
          reasoning: response.content,
          suggestNewAgent: false,
          suggestNewSkill: false,
          suggestion: response.content,
          needsClarification: true,
        };
      }
      
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
    
    console.log("🔍 Skill suggestion analysis:", {
      hasMatchedAgent: !!matchedAgent,
      aiSuggestsSkill: result.suggestNewSkill,
      suggestionText: result.suggestion,
      agentHasSkills: matchedAgent ? skills.filter(s => 
        agents.find(a => a._id?.toString() === matchedAgent?._id?.toString())
      ).length : 0
    });

    // Check for duplicate skills before suggesting
    let suggestNewSkill = result.suggestNewSkill || false;
    let suggestion = result.suggestion || "";
    
    if (suggestNewSkill && matchedAgent && suggestion) {
      // Get agent's existing skills (fixed: filter by agentId)
      const agentSkills = skills.filter(s => s.agentId === matchedAgent._id?.toString());
      
      console.log("🔍 Checking for duplicate skills:", {
        suggestion,
        agentId: matchedAgent._id?.toString(),
        existingSkills: agentSkills.map(s => s.name),
      });
      
      // Check if a similar skill already exists
      const suggestionLower = suggestion.toLowerCase();
      const hasSimilarSkill = agentSkills.some(skill => {
        const skillNameLower = skill.name.toLowerCase();
        // Check for significant overlap in words
        const suggestionWords = suggestionLower.split(/\s+/).filter((w: string) => w.length > 3);
        const skillWords = skillNameLower.split(/\s+/).filter((w: string) => w.length > 3);
        const overlap = suggestionWords.filter((w: string) => skillWords.some((sw: string) => sw.includes(w) || w.includes(sw)));
        
        console.log("🔍 Comparing skills:", {
          existing: skill.name,
          suggested: suggestion,
          suggestionWords,
          skillWords,
          overlap,
          overlapCount: overlap.length,
        });
        
        return overlap.length >= 2; // If 2+ words overlap, consider it duplicate
      });
      
      if (hasSimilarSkill) {
        console.log("⚠️ Similar skill already exists - not suggesting");
        suggestNewSkill = false;
        suggestion = "";
      } else {
        console.log("✅ No duplicate found - suggesting skill");
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
    console.error("❌ Agent matching error:", error);
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      agentCount: agents.length,
    });
    
    // Fallback to simple keyword matching
    console.log("⚠️ Falling back to keyword matching (Claude API failed)");
    return fallbackKeywordMatch(question, agents);
  }
}

/**
 * Fallback keyword-based matching if Claude fails
 * Mimics AI behavior: suggests skills for matched agents, new agents only if no match
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

  // Mimic AI behavior:
  // - If agent matched with decent confidence → suggest adding a skill
  // - If no good match → suggest creating a new agent
  const hasDecentMatch = confidence >= 0.4 && !!bestMatch;
  const hasWeakMatch = confidence >= 0.2 && confidence < 0.4 && !!bestMatch;
  const noMatch = confidence < 0.2;

  return {
    matchedAgent: bestMatch,
    confidence,
    reasoning: hasDecentMatch
      ? "Keyword-based match found (fallback method)"
      : noMatch
      ? "No suitable agent found using keyword matching"
      : "Weak match found (fallback method)",
    // Suggest new agent only if no match at all
    suggestNewAgent: noMatch,
    // Suggest new skill if we have a match (decent or weak)
    suggestNewSkill: hasDecentMatch || hasWeakMatch,
    // Extract a skill name from the question for skill suggestion
    suggestion: (hasDecentMatch || hasWeakMatch)
      ? extractSkillNameFromQuestion(question)
      : noMatch
      ? "Consider creating a new specialized agent"
      : undefined,
  };
}

/**
 * Extract a potential skill name from the question
 */
function extractSkillNameFromQuestion(question: string): string {
  // Remove common question words
  const cleaned = question
    .replace(/\b(what|where|when|why|how|who|can|could|would|should|is|are|the|a|an|in|on|at|to|for|of|about|with)\b/gi, ' ')
    .replace(/[?.,!]/g, '')
    .trim();
  
  // Take first few meaningful words and capitalize
  const words = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 4);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'New Skill';
}
