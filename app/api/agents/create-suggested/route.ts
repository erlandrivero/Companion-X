import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { createAgent } from "@/lib/db/agentDb";
import { getUserSettings } from "@/lib/db/settingsDb";

// POST /api/agents/create-suggested - Create agent from suggestion
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

    const { topic } = await request.json();

    console.log("📥 Received agent creation request for topic:", topic);

    if (!topic || typeof topic !== "string") {
      console.error("❌ Invalid topic:", topic);
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    console.log("✅ Topic validated, generating agent profile...");
    
    // Get user's API key from settings
    const userSettings = await getUserSettings(userId);
    const userApiKey = userSettings?.apiKeys?.anthropic;
    
    console.log("🔑 Using API key:", userApiKey ? "Custom key" : "Environment key");
    
    // Generate agent profile with user's API key
    const agentProfile = await generateAgentProfile(topic, "", userApiKey);

    // Create agent
    const agent = await createAgent(
      {
        name: agentProfile.name,
        description: agentProfile.description,
        expertise: agentProfile.expertise,
        systemPrompt: agentProfile.systemPrompt,
        knowledgeBase: agentProfile.knowledgeBase,
        capabilities: agentProfile.capabilities,
        conversationStyle: agentProfile.conversationStyle,
      },
      userId
    );

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("Create suggested agent error:", error);
    return NextResponse.json(
      {
        error: "Failed to create agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
