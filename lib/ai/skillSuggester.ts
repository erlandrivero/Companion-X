/**
 * AI-Powered Skill Suggestion System
 * Analyzes agent usage patterns and suggests relevant skills
 */

import { sendMessageHaiku } from "./claude";
import { Agent } from "@/types/agent";
import { AgentSkill } from "@/types/skill";

interface SkillSuggestion {
  name: string;
  description: string;
  category: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
  estimatedUsefulness: number; // 0-1 score
}

/**
 * Analyze conversation patterns and suggest skills for an agent
 */
export async function suggestSkillsForAgent(
  agent: Agent,
  recentQuestions: string[],
  existingSkills: AgentSkill[],
  apiKey?: string
): Promise<SkillSuggestion[]> {
  const existingSkillNames = existingSkills.map(s => s.name).join(", ");
  
  const prompt = `You are analyzing an AI agent to suggest new skills that would enhance its capabilities.

AGENT PROFILE:
Name: ${agent.name}
Description: ${agent.description}
Expertise: ${agent.expertise.join(", ")}
Existing Skills: ${existingSkillNames || "None"}

RECENT QUESTIONS HANDLED:
${recentQuestions.slice(0, 10).map((q, i) => `${i + 1}. ${q}`).join("\n")}

TASK:
Suggest 3-5 new skills that would help this agent answer questions better. Each skill should:
1. Fill a gap in current capabilities
2. Be relevant to the agent's domain
3. Address patterns in recent questions
4. NOT duplicate existing skills

Return ONLY a valid JSON array with this exact structure:
[
  {
    "name": "Skill name (concise, 2-4 words)",
    "description": "One sentence describing what this skill does",
    "category": "Category name",
    "reasoning": "Why this skill would be useful (1-2 sentences)",
    "priority": "high|medium|low",
    "estimatedUsefulness": 0.85
  }
]

IMPORTANT: Return ONLY the JSON array, no other text.`;

  try {
    const response = await sendMessageHaiku(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
      apiKey, // Pass user's custom API key
    });

    // Parse the JSON response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in response");
      return [];
    }

    const suggestions: SkillSuggestion[] = JSON.parse(jsonMatch[0]);
    
    // Validate and filter suggestions
    return suggestions
      .filter(s => s.name && s.description && s.category)
      .slice(0, 5); // Max 5 suggestions
      
  } catch (error) {
    console.error("Failed to generate skill suggestions:", error);
    return [];
  }
}

/**
 * Generate full skill content for a suggested skill
 */
export async function generateSkillContent(
  skillName: string,
  skillDescription: string,
  agentContext: string,
  apiKey?: string
): Promise<string> {
  const prompt = `Generate a comprehensive skill document in SKILL.md format.

SKILL NAME: ${skillName}
DESCRIPTION: ${skillDescription}
AGENT CONTEXT: ${agentContext}

Create a detailed skill document following this structure:

# ${skillName}

## Overview
[2-3 sentences explaining what this skill does and when to use it. BE EXPLICIT about geographic/topic coverage - e.g., "covers ALL European countries including Spain, France, Germany, etc."]

## Capabilities
- [Specific capability 1 - be comprehensive]
- [Specific capability 2 - list specific examples]
- [Specific capability 3 - include edge cases]
- [etc. - at least 5-7 capabilities]

## Coverage
[Explicitly list what this skill covers. For geographic skills, list major regions/countries. For topic skills, list specific subtopics.]

## Usage Guidelines
[When and how to use this skill effectively. Emphasize using it CONFIDENTLY for all covered areas.]

## Examples
[3-4 concrete examples showing this skill in action with specific locations/scenarios]

## Best Practices
- Answer directly and confidently when questions fall within this skill's coverage
- Use consistent units throughout responses (e.g., always Celsius for European weather, or provide both)
- When user asks for specific units (Fahrenheit/Celsius), provide the answer in those units
- Be consistent with terminology and formatting across all responses

## Common Pitfalls
- Being too cautious when you have the expertise
- [Pitfall 2 and how to avoid it]

## Related Concepts
[Related topics or skills that complement this one]

IMPORTANT: Make the skill COMPREHENSIVE and CONFIDENT. If it's a "European Weather" skill, it should explicitly state it covers ALL European countries. Don't be vague.`;

  try {
    const response = await sendMessageHaiku(prompt, {
      temperature: 0.5,
      maxTokens: 3000,
      apiKey, // Pass user's custom API key
    });

    return response.content;
  } catch (error) {
    console.error("Failed to generate skill content:", error);
    return generateFallbackSkillContent(skillName, skillDescription);
  }
}

/**
 * Fallback skill content if AI generation fails
 */
function generateFallbackSkillContent(name: string, description: string): string {
  return `# ${name}

## Overview
${description}

## Capabilities
- Core functionality related to ${name}
- Supporting features and tools
- Integration with related systems

## Usage Guidelines
Use this skill when working with ${name.toLowerCase()} related tasks.

## Examples
Example 1: [Add specific example]
Example 2: [Add specific example]

## Best Practices
- Follow established patterns
- Test thoroughly
- Document your work

## Common Pitfalls
- Avoid common mistakes
- Verify assumptions
- Handle edge cases

## Related Concepts
Related topics and complementary skills.`;
}

/**
 * Analyze a single question and suggest if a new skill is needed
 */
export async function analyzeQuestionForSkillGap(
  question: string,
  agent: Agent,
  existingSkills: AgentSkill[]
): Promise<SkillSuggestion | null> {
  const existingSkillNames = existingSkills.map(s => s.name).join(", ");
  
  const prompt = `Analyze if this question reveals a skill gap for the agent.

AGENT: ${agent.name} - ${agent.description}
EXISTING SKILLS: ${existingSkillNames || "None"}
QUESTION: "${question}"

Does this question require knowledge that isn't covered by existing skills?

If YES, suggest ONE new skill. Return JSON:
{
  "needsNewSkill": true,
  "name": "Skill name",
  "description": "Brief description",
  "category": "Category",
  "reasoning": "Why this skill is needed",
  "priority": "high|medium|low",
  "estimatedUsefulness": 0.8
}

If NO, return:
{
  "needsNewSkill": false
}

Return ONLY valid JSON, no other text.`;

  try {
    const response = await sendMessageHaiku(prompt, {
      temperature: 0.3,
      maxTokens: 500,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    
    if (result.needsNewSkill && result.name) {
      return {
        name: result.name,
        description: result.description,
        category: result.category,
        reasoning: result.reasoning,
        priority: result.priority || "medium",
        estimatedUsefulness: result.estimatedUsefulness || 0.7,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Failed to analyze question for skill gap:", error);
    return null;
  }
}

/**
 * Get skill suggestions based on agent's domain
 */
export async function getCommonSkillsForDomain(
  domain: string
): Promise<SkillSuggestion[]> {
  const commonSkills: Record<string, SkillSuggestion[]> = {
    "tableau": [
      {
        name: "Calculated Fields",
        description: "Create custom calculations and formulas",
        category: "Tableau",
        reasoning: "Essential for data transformation and custom metrics",
        priority: "high",
        estimatedUsefulness: 0.95,
      },
      {
        name: "LOD Expressions",
        description: "Level of Detail calculations for complex aggregations",
        category: "Tableau",
        reasoning: "Advanced technique for multi-level analysis",
        priority: "high",
        estimatedUsefulness: 0.9,
      },
      {
        name: "Dashboard Design",
        description: "Best practices for creating effective dashboards",
        category: "Tableau",
        reasoning: "Critical for user experience and insights delivery",
        priority: "medium",
        estimatedUsefulness: 0.85,
      },
    ],
    "fishing": [
      {
        name: "Seasonal Patterns",
        description: "Fish behavior and location by season",
        category: "Fishing",
        reasoning: "Timing is crucial for successful fishing",
        priority: "high",
        estimatedUsefulness: 0.9,
      },
      {
        name: "Bait Selection",
        description: "Choosing the right bait for different species and conditions",
        category: "Fishing",
        reasoning: "Most common question from anglers",
        priority: "high",
        estimatedUsefulness: 0.95,
      },
      {
        name: "Tackle Setup",
        description: "Rod, reel, and line configurations for different techniques",
        category: "Fishing",
        reasoning: "Proper equipment setup improves success rate",
        priority: "medium",
        estimatedUsefulness: 0.8,
      },
    ],
    "programming": [
      {
        name: "Error Handling",
        description: "Best practices for catching and handling errors",
        category: "Programming",
        reasoning: "Critical for robust application development",
        priority: "high",
        estimatedUsefulness: 0.9,
      },
      {
        name: "Code Optimization",
        description: "Techniques for improving performance and efficiency",
        category: "Programming",
        reasoning: "Essential for scalable applications",
        priority: "medium",
        estimatedUsefulness: 0.85,
      },
      {
        name: "Testing Strategies",
        description: "Unit testing, integration testing, and test-driven development",
        category: "Programming",
        reasoning: "Ensures code quality and reliability",
        priority: "high",
        estimatedUsefulness: 0.88,
      },
    ],
  };

  const domainLower = domain.toLowerCase();
  
  console.log("🔍 Looking for skills for domain:", domain, "→", domainLower);
  
  // Check for exact or partial matches
  for (const [key, skills] of Object.entries(commonSkills)) {
    if (domainLower.includes(key) || key.includes(domainLower)) {
      console.log("✅ Found predefined skills for:", key);
      return skills;
    }
  }

  console.log("⚠️ No predefined skills found for:", domain);
  
  // If no predefined skills, return generic suggestions based on domain type
  return [
    {
      name: `${domain} Fundamentals`,
      description: `Core concepts and best practices for ${domain}`,
      category: domain,
      reasoning: "Essential foundation for working effectively",
      priority: "high",
      estimatedUsefulness: 0.9,
    },
    {
      name: `Advanced ${domain} Techniques`,
      description: `Advanced methods and optimization strategies`,
      category: domain,
      reasoning: "Take your skills to the next level",
      priority: "medium",
      estimatedUsefulness: 0.85,
    },
    {
      name: `${domain} Best Practices`,
      description: `Industry standards and proven approaches`,
      category: domain,
      reasoning: "Follow established patterns for success",
      priority: "medium",
      estimatedUsefulness: 0.8,
    },
  ];
}
