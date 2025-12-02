import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { createAgent } from "@/lib/db/agentDb";
import { getApiKeys } from "@/lib/db/settingsDb";
import { searchWeb, formatSearchResults } from "@/lib/search/webSearch";

// POST /api/agents/create-suggested - Create agent from suggestion
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // Check if user is authenticated
    // In production, require authentication. In development, allow fallback.
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');
    
    if (!session?.user?.email && !isDevelopment) {
      console.error("❌ No session found in production");
      return NextResponse.json(
        { error: "Authentication required. Please log in again." },
        { status: 401 }
      );
    }
    
    const userId = session?.user?.email || "demo@localhost.dev";
    
    console.log("🔐 Auth check (create-suggested):", {
      hasSession: !!session,
      userId,
      isDevelopment,
      environment: process.env.NODE_ENV,
    });

    const { topic, originalQuestion } = await request.json();

    console.log("📥 Received agent creation request for topic:", topic);
    console.log("📥 Original question:", originalQuestion);

    if (!topic || typeof topic !== "string") {
      console.error("❌ Invalid topic:", topic);
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    console.log("✅ Topic validated, getting API keys...");
    
    // Get user's API key with fallback to environment variable
    const { anthropic: userApiKey } = await getApiKeys(userId);
    console.log("🔑 Using API key:", userApiKey ? (userApiKey === process.env.ANTHROPIC_API_KEY ? "Environment key" : "Custom key") : "None");
    
    // Generate agent profile with Claude API (skip web search for speed)
    console.log("🤖 Generating agent profile with Claude...");
    let agentProfile;
    try {
      const contextDescription = originalQuestion 
        ? `User asked: "${originalQuestion}". Create an agent to handle this type of question.`
        : `Create an expert agent for: ${topic}`;
      
      agentProfile = await generateAgentProfile(topic, contextDescription, userApiKey);
      console.log("✅ Agent profile generated:", agentProfile.name);
    } catch (error) {
      console.error("❌ Failed to generate agent profile:", error);
      return NextResponse.json(
        { 
          error: "Failed to generate agent profile",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }

    // Create agent in database
    console.log("💾 Saving agent to database...");
    let agent;
    try {
      agent = await createAgent(
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
      console.log("✅ Agent created successfully:", agent._id);
    } catch (error) {
      console.error("❌ Failed to save agent to database:", error);
      return NextResponse.json(
        { 
          error: "Failed to save agent",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }

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
