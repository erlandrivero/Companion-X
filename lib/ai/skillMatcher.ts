import { AgentSkill, SkillMatchResult, ParsedSkill } from "@/types/skill";
import { sendMessageHaiku } from "./claude";

/**
 * Parse SKILL.md content into structured format
 */
export function parseSkillContent(skillContent: string): ParsedSkill {
  // Extract YAML frontmatter
  const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
  const metadata: any = {};
  
  if (frontmatterMatch) {
    const yamlContent = frontmatterMatch[1];
    const lines = yamlContent.split("\n");
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(":").trim();
        metadata[key.trim()] = value;
      }
    }
  }

  // Extract content sections
  const content = skillContent.replace(/^---\n[\s\S]*?\n---\n/, "");
  
  const sections: any = {
    overview: extractSection(content, "## Overview"),
    capabilities: extractListItems(content, "## Core Capabilities"),
    guidelines: {
      dos: extractListItems(content, "✅ DO:"),
      donts: extractListItems(content, "❌ DON'T:"),
    },
    examples: extractListItems(content, "## Examples"),
    resources: extractListItems(content, "## Resources"),
  };

  return {
    metadata: {
      name: metadata.name || "",
      description: metadata.description || "",
      version: metadata.version,
      dependencies: metadata.dependencies?.split(",").map((d: string) => d.trim()),
    },
    content: sections,
    rawContent: content,
  };
}

function extractSection(content: string, header: string): string {
  const regex = new RegExp(`${header}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractListItems(content: string, header: string): string[] {
  const section = extractSection(content, header);
  const items = section.match(/^[-*]\s+(.+)$/gm);
  return items ? items.map(item => item.replace(/^[-*]\s+/, "").trim()) : [];
}

/**
 * Match skills to a user message
 * Returns skills ranked by relevance
 */
export async function matchSkillsToMessage(
  message: string,
  skills: AgentSkill[]
): Promise<SkillMatchResult[]> {
  if (skills.length === 0) {
    return [];
  }

  // Quick filter: Only consider skills with relevant keywords
  const relevantSkills = skills.filter(skill => {
    const searchText = `${skill.name} ${skill.description} ${skill.metadata.tags.join(" ")}`.toLowerCase();
    const messageWords = message.toLowerCase().split(/\s+/);
    return messageWords.some(word => word.length > 3 && searchText.includes(word));
  });

  if (relevantSkills.length === 0) {
    return [];
  }

  // Use Claude to rank skills by relevance
  const systemPrompt = `You are an intelligent skill matcher. Given a user message and available skills, determine which skills are most relevant.

IMPORTANT MATCHING RULES:
1. **Geographic Coverage**: If a skill mentions "European" or "Europe", it covers ALL European countries (Spain, France, Germany, UK, Italy, etc.)
2. **Semantic Understanding**: "Madrid", "Barcelona", "Burgos" are Spanish cities → covered by European skills
3. **Topic Coverage**: If a skill covers a broad topic, it includes specific subtopics
4. **Be Generous**: If there's reasonable overlap, match the skill

For each skill, provide a relevance score (0-100) and brief reasoning.

Respond in JSON format:
{
  "matches": [
    {
      "skillName": "skill-name",
      "score": 85,
      "reasoning": "This skill is relevant because..."
    }
  ]
}

Include skills with score >= 60 (lowered threshold for better coverage).`;

  const skillDescriptions = relevantSkills.map(skill => 
    `- ${skill.name}: ${skill.description}\n  Tags: ${skill.metadata.tags.join(", ")}`
  ).join("\n");

  const userPrompt = `User message: "${message}"

Available skills:
${skillDescriptions}

Which skills are most relevant? Consider geographic and semantic coverage.`;

  try {
    const response = await sendMessageHaiku(userPrompt, {
      systemPrompt,
      maxTokens: 1024,
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const result = JSON.parse(jsonMatch[0]);
    
    return result.matches.map((match: any) => {
      const skill = relevantSkills.find(s => s.name === match.skillName);
      return skill ? {
        skill,
        relevanceScore: match.score,
        reasoning: match.reasoning,
      } : null;
    }).filter(Boolean) as SkillMatchResult[];

  } catch (error) {
    console.error("Skill matching error:", error);
    // Fallback: Return all relevant skills with basic scoring
    return relevantSkills.map(skill => ({
      skill,
      relevanceScore: 75,
      reasoning: "Keyword match",
    }));
  }
}

/**
 * Build enhanced system prompt with matched skills
 */
export function buildSystemPromptWithSkills(
  baseSystemPrompt: string,
  matchedSkills: SkillMatchResult[]
): string {
  if (matchedSkills.length === 0) {
    return baseSystemPrompt;
  }

  const skillsSection = matchedSkills.map(match => {
    const parsed = parseSkillContent(match.skill.skillContent);
    return `
### Skill: ${parsed.metadata.name}
${parsed.metadata.description}

${parsed.content.overview || ""}

**Capabilities:**
${parsed.content.capabilities?.map(c => `- ${c}`).join("\n") || ""}

**Guidelines:**
DO:
${parsed.content.guidelines?.dos?.map(d => `- ${d}`).join("\n") || ""}

DON'T:
${parsed.content.guidelines?.donts?.map(d => `- ${d}`).join("\n") || ""}
`;
  }).join("\n\n---\n\n");

  return `${baseSystemPrompt}

---

## Active Skills - USE THESE CONFIDENTLY

You have been enhanced with the following specialized skills. When a question matches these skills, USE THEM DIRECTLY to answer - don't ask for more details unless absolutely necessary:

${skillsSection}

IMPORTANT: 
- If the user's question falls within these skill areas, answer it directly using your enhanced knowledge
- Don't be overly cautious or ask for clarification if you can provide useful information
- Example: If asked about "Madrid weather" and you have European Weather skill, provide Madrid weather information directly
- Handle unit conversions within your domain (e.g., Fahrenheit/Celsius for weather, miles/km for distance)
- Use CONSISTENT units across all responses, or provide both when appropriate
- If user requests specific units, provide the answer in those units
- Only ask for clarification if the question is genuinely ambiguous or you need critical missing information`;
}

/**
 * Generate a new skill using Claude
 */
export async function generateSkill(
  topic: string,
  description: string,
  agentContext: string
): Promise<string> {
  const systemPrompt = `You are a skill creator. Generate a SKILL.md file for a specialized capability.

The skill should follow this format:

---
name: skill-name
description: Clear description of what this skill does and when to use it
version: 1.0.0
---

# Skill Name

## Overview
Detailed overview of the skill's purpose and capabilities.

## Core Capabilities
- Capability 1
- Capability 2
- Capability 3

## When to Use
Apply this skill when:
- Scenario 1
- Scenario 2

## Guidelines
✅ DO:
- Guideline 1
- Guideline 2

❌ DON'T:
- Anti-pattern 1
- Anti-pattern 2

## Examples
- Example usage 1
- Example usage 2

## Resources
Additional resources or references if needed.

Create a comprehensive, production-ready skill.`;

  const userPrompt = `Create a skill for: ${topic}

Description: ${description}

Agent Context: ${agentContext}

Generate the complete SKILL.md content.`;

  const response = await sendMessageHaiku(userPrompt, {
    systemPrompt,
    maxTokens: 2048,
    temperature: 0.7,
  });

  return response.content;
}
