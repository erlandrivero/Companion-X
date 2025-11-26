import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suggestSkillsForAgent, generateSkillContent, getCommonSkillsForDomain } from "@/lib/ai/skillSuggester";
import { getAgent } from "@/lib/db/agentDb";
import { getAgentSkills } from "@/lib/db/skillDb";
import { getUserSettings } from "@/lib/db/settingsDb";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email || "demo@localhost.dev";

    const body = await request.json();
    const { agentId, action, skillName, skillDescription } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Get agent details
    const agent = await getAgent(agentId, userId);
    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get existing skills
    const existingSkills = await getAgentSkills(agentId);

    if (action === "generate_content") {
      // Generate full skill content for a specific skill
      if (!skillName || !skillDescription) {
        return NextResponse.json(
          { error: "Skill name and description are required" },
          { status: 400 }
        );
      }
      
      // Get user's API keys
      const userSettings = await getUserSettings(userId);
      const userApiKey = userSettings?.apiKeys?.anthropic;
      const braveApiKey = userSettings?.apiKeys?.braveSearch;
      
      const content = await generateSkillContent(
        skillName,
        skillDescription,
        `${agent.name}: ${agent.description}`,
        userApiKey, // Pass user's custom API key
        braveApiKey // Pass Brave Search API key
      );

      return NextResponse.json({ content });
    }

    if (action === "common_skills") {
      console.log("🤖 Generating AI suggestions for agent:", agent.name);
      console.log("📋 Expertise:", agent.expertise);
      
      // Get user's API key
      const userSettings = await getUserSettings(userId);
      const userApiKey = userSettings?.apiKeys?.anthropic;
      
      console.log("🔑 Using API key:", userApiKey ? "Custom key" : "Environment key");
      
      // Primary: Use AI to generate custom suggestions
      const recentQuestions: string[] = []; // TODO: Load from conversation history
      
      let suggestions = await suggestSkillsForAgent(
        agent,
        recentQuestions,
        existingSkills,
        userApiKey // Pass user's custom API key
      );
      
      console.log("🤖 AI generated suggestions:", suggestions.length);
      
      // Fallback: If AI fails or returns empty, use predefined or generic
      if (!suggestions || suggestions.length === 0) {
        console.log("⚠️ AI suggestions failed, using fallback");
        const domain = agent.expertise[0] || agent.name;
        suggestions = await getCommonSkillsForDomain(domain);
      }
      
      console.log("📋 Final suggestions count:", suggestions.length);

      return NextResponse.json({ suggestions });
    }

    // Default: Same as common_skills for now
    const userSettings = await getUserSettings(userId);
    const userApiKey = userSettings?.apiKeys?.anthropic;
    const recentQuestions: string[] = [];
    
    const suggestions = await suggestSkillsForAgent(
      agent,
      recentQuestions,
      existingSkills,
      userApiKey
    );

    return NextResponse.json({
      suggestions,
      agent: {
        id: agent._id?.toString(),
        name: agent.name,
        description: agent.description,
      },
      existingSkillCount: existingSkills.length,
    });

  } catch (error) {
    console.error("Skill suggestion error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate skill suggestions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
