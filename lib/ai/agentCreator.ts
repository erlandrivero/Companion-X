import { Agent } from "@/types/agent";
import { sendMessageSonnet } from "./claude";

/**
 * Generate a comprehensive agent profile using Claude Sonnet
 * Uses high-quality model for creating well-structured agents
 */
export async function generateAgentProfile(
  topic: string,
  context: string,
  apiKey?: string
): Promise<Omit<Agent, "_id" | "userId" | "createdAt" | "updatedAt" | "version" | "performanceMetrics" | "evolutionHistory">> {
  const systemPrompt = `You are an expert AI agent architect. Your job is to design comprehensive, specialized AI agent profiles with sophisticated system prompts.

When given a topic, create a detailed agent profile with a RICH, STRUCTURED system prompt that includes:

1. **Goal Statement**: Start with "🎯 Goal:" followed by what the agent does
2. **Backstory**: Start with "📖 Backstory:" explaining the agent's expertise and approach
3. **Core Competencies**: List specific skills and knowledge areas
4. **Operational Guidelines**: Clear rules for how the agent should behave
5. **Success Criteria**: What makes a good response from this agent

CRITICAL SYSTEM PROMPT REQUIREMENTS:
- Must make the agent BE the specialist, not explain what the specialist is
- Should be 300-500 words with clear structure and sections
- Use emojis for section headers (🎯, 📖, ✅, ❌, 💡, etc.)
- Include specific examples of good vs bad responses
- Define clear boundaries and capabilities
- Add a "Mental Model" or "Approach" section

Example structure for a Financial Advisor:
"""
🎯 Goal: Provide personalized financial advice and actionable investment strategies to help clients achieve their financial goals.

📖 Backstory:
You are an experienced Financial Advisor with 15+ years in wealth management, retirement planning, and investment strategy. You combine deep financial knowledge with practical, client-focused advice.

💼 Core Competencies:
- Investment portfolio analysis and optimization
- Retirement planning (401k, IRA, pension strategies)
- Tax-efficient investing strategies
- Risk assessment and management
- Estate planning basics

📋 How You Help Clients:
When a client asks for advice, you:
✅ Ask clarifying questions about their goals, timeline, and risk tolerance
✅ Provide specific, actionable recommendations
✅ Explain the reasoning behind your advice
✅ Consider tax implications and fees
✅ Suggest concrete next steps

You do NOT:
❌ Give generic advice without context
❌ Guarantee returns or make promises
❌ Recommend specific stocks without analysis
❌ Ignore risk factors

💡 Your Approach:
Think of yourself as a trusted advisor, not a salesperson. Your goal is to educate and empower clients to make informed decisions. Always consider their unique situation before recommending strategies.
"""

The agent should be:
- A PRACTITIONER who provides direct help, not an explainer
- Structured with clear sections and formatting
- Specific about what they do and don't do
- Professional yet approachable
- Action-oriented with concrete guidance

Respond in JSON format with this exact structure:
{
  "name": "<agent name>",
  "description": "<1-2 sentence description>",
  "expertise": ["<area1>", "<area2>", ...],
  "systemPrompt": "<detailed system prompt for the agent>",
  "knowledgeBase": {
    "facts": ["<fact1>", "<fact2>", ...],
    "sources": ["<source1>", "<source2>", ...]
  },
  "capabilities": ["<capability1>", "<capability2>", ...],
  "conversationStyle": {
    "tone": "<professional|friendly|casual|formal>",
    "vocabulary": "<technical|simple|mixed>",
    "responseLength": "<concise|detailed|adaptive>"
  }
}`;

  const userPrompt = `Create a specialized AI agent profile for: ${topic}

Context: ${context}

CRITICAL REQUIREMENTS FOR THE SYSTEM PROMPT:

1. **Structure**: Create a rich, well-organized system prompt (300-500 words) with these sections:
   - 🎯 Goal: (What the agent does in one sentence)
   - 📖 Backstory: (Agent's expertise and experience)
   - Core Competencies: (Specific skills - use relevant emoji)
   - Operational Guidelines: (What the agent does ✅ and doesn't do ❌)
   - Approach/Mental Model: (How the agent thinks)

2. **Tone**: The agent must BE the ${topic}, not explain what a ${topic} is.
   - Start with "You are a ${topic}." (not "You are a ${topic} Assistant")
   - Focus on what you DO for users, not what a ${topic} is

3. **Specificity**: Include concrete examples and specific guidance
   - List 4-6 specific competencies
   - Give clear dos and don'ts
   - Explain the agent's approach or philosophy

4. **Formatting**: Use emojis for section headers, bullet points for lists, clear structure

5. **Response Style**: Include guidance for concise, voice-friendly responses:
   - Keep responses under 500 words / 2500 characters
   - Be conversational and direct
   - Offer to elaborate if user needs more detail

Example opening for ${topic}:
"🎯 Goal: [What this agent does for users]

📖 Backstory:
You are an experienced ${topic} with deep expertise in [specific areas]. You [describe approach and philosophy].

💬 Communication Style:
Keep responses concise and conversational (under 500 words). Be direct, offer to elaborate on specific aspects if needed."

Design a comprehensive, production-quality agent profile with a sophisticated system prompt.`;

  try {
    console.log("🤖 Generating agent profile for:", topic);
    const response = await sendMessageSonnet(userPrompt, {
      systemPrompt,
      enableCaching: true, // Cache the system prompt (it's reused)
      maxTokens: 8192, // Increased for richer prompts
      temperature: 0.7,
      apiKey, // Pass user's custom API key
    });

    console.log("✅ Claude Sonnet response received, length:", response.content.length);

    // Extract JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ No JSON found in Claude response. First 200 chars:", response.content.substring(0, 200));
      throw new Error("Invalid response format from Claude");
    }

    console.log("✅ JSON extracted, parsing...");
    const agentData = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      !agentData.name ||
      !agentData.description ||
      !agentData.expertise ||
      !agentData.systemPrompt
    ) {
      console.error("❌ Missing required fields:", {
        hasName: !!agentData.name,
        hasDescription: !!agentData.description,
        hasExpertise: !!agentData.expertise,
        hasSystemPrompt: !!agentData.systemPrompt,
      });
      throw new Error("Missing required fields in agent profile");
    }

    console.log("✅ Agent data validated:", {
      name: agentData.name,
      systemPromptLength: agentData.systemPrompt.length,
      expertiseCount: agentData.expertise?.length || 0,
    });

    // Ensure arrays exist
    if (!Array.isArray(agentData.expertise)) {
      agentData.expertise = [topic];
    }
    if (!Array.isArray(agentData.capabilities)) {
      agentData.capabilities = [];
    }
    if (!agentData.knowledgeBase) {
      agentData.knowledgeBase = { facts: [], sources: [] };
    }
    if (!agentData.conversationStyle) {
      agentData.conversationStyle = {
        tone: "professional",
        vocabulary: "mixed",
        responseLength: "adaptive",
      };
    }

    // Add timestamps to knowledge base
    agentData.knowledgeBase.lastUpdated = new Date();

    console.log("✅ Rich agent profile created successfully!");
    return agentData;
  } catch (error) {
    console.error("❌ Agent creation failed, using fallback");
    console.error("❌ Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("❌ Error message:", error instanceof Error ? error.message : String(error));
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Check if it's an API error
    if (error && typeof error === 'object' && 'status' in error) {
      console.error("❌ API Status:", (error as any).status);
      console.error("❌ API Error:", (error as any).error);
    }
    
    // Fallback: Create a basic agent profile
    console.warn("⚠️ Creating GENERIC fallback agent for:", topic);
    return createFallbackAgent(topic, context);
  }
}

/**
 * Fallback agent creation if Claude fails
 */
function createFallbackAgent(
  topic: string,
  context: string
): Omit<Agent, "_id" | "userId" | "createdAt" | "updatedAt" | "version" | "performanceMetrics" | "evolutionHistory"> {
  const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);

  return {
    name: `${capitalizedTopic} Assistant`,
    description: `A specialized assistant focused on ${topic.toLowerCase()} related questions and tasks.`,
    expertise: [topic.toLowerCase()],
    systemPrompt: `You are a specialized ${capitalizedTopic} Assistant with expertise in ${topic.toLowerCase()}.

Your role is to provide helpful, accurate information and assistance related to ${topic.toLowerCase()}.

Context: ${context}

Guidelines:
- Stay within your area of expertise (${topic.toLowerCase()})
- Provide clear, accurate information
- If a question is outside your domain, acknowledge it politely
- Be helpful and professional in your responses
- Cite sources when possible`,
    knowledgeBase: {
      facts: [],
      sources: [],
      lastUpdated: new Date(),
    },
    capabilities: [
      "Answer questions",
      "Provide explanations",
      "Offer guidance",
    ],
    conversationStyle: {
      tone: "professional",
      vocabulary: "mixed",
      responseLength: "adaptive",
    },
  };
}

/**
 * Refine an agent profile based on feedback
 */
export async function refineAgentProfile(
  currentAgent: Agent,
  feedback: string
): Promise<Partial<Agent>> {
  const systemPrompt = `You are an AI agent improvement specialist. Given an existing agent profile and user feedback, suggest specific improvements.

Respond in JSON format with only the fields that should be updated:
{
  "description": "<updated description if needed>",
  "expertise": ["<updated expertise if needed>"],
  "systemPrompt": "<updated system prompt if needed>",
  "capabilities": ["<updated capabilities if needed>"],
  "knowledgeBase": {
    "facts": ["<new or updated facts>"]
  }
}

Only include fields that need updating. If a field doesn't need changes, omit it.`;

  const userPrompt = `Current Agent Profile:
Name: ${currentAgent.name}
Description: ${currentAgent.description}
Expertise: ${currentAgent.expertise.join(", ")}

User Feedback: ${feedback}

What improvements should be made to this agent?`;

  try {
    const response = await sendMessageSonnet(userPrompt, {
      systemPrompt,
      enableCaching: true,
      maxTokens: 2048,
      temperature: 0.6,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const updates = JSON.parse(jsonMatch[0]);

    // Add lastUpdated to knowledgeBase if it was updated
    if (updates.knowledgeBase) {
      updates.knowledgeBase.lastUpdated = new Date();
    }

    return updates;
  } catch (error) {
    console.error("Agent refinement error:", error);
    return {};
  }
}

/**
 * Generate initial knowledge base facts for an agent
 */
export async function generateKnowledgeBase(
  topic: string,
  expertise: string[]
): Promise<{ facts: string[]; sources: string[] }> {
  const systemPrompt = `You are a knowledge curator. Generate a list of key facts and reliable sources for a given topic.

Respond in JSON format:
{
  "facts": ["<fact1>", "<fact2>", ...],
  "sources": ["<source1>", "<source2>", ...]
}

Facts should be:
- Accurate and verifiable
- Relevant to the topic
- Concise (1-2 sentences each)
- Foundational knowledge

Sources should be:
- Reputable and authoritative
- Publicly accessible
- Relevant to the topic`;

  const userPrompt = `Topic: ${topic}
Expertise Areas: ${expertise.join(", ")}

Generate 5-10 key facts and 3-5 reliable sources for this topic.`;

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
      facts: Array.isArray(result.facts) ? result.facts : [],
      sources: Array.isArray(result.sources) ? result.sources : [],
    };
  } catch (error) {
    console.error("Knowledge base generation error:", error);
    return { facts: [], sources: [] };
  }
}
