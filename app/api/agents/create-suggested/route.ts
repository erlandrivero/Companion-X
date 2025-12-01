import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { createAgent } from "@/lib/db/agentDb";
import { getUserSettings } from "@/lib/db/settingsDb";
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

    console.log("✅ Topic validated");
    
    // Create a simple agent profile without external API calls for debugging
    console.log("🤖 Creating simple agent profile...");
    const agentProfile = {
      name: topic.substring(0, 50), // Use topic as name
      description: `Expert agent for ${topic}`,
      expertise: [topic],
      systemPrompt: `You are an expert on ${topic}. Provide helpful, accurate information.`,
      knowledgeBase: {
        facts: originalQuestion ? [`User asked: ${originalQuestion}`] : [`Expert on ${topic}`],
        sources: [],
        lastUpdated: new Date()
      },
      capabilities: ["Answer questions", "Provide information"],
      conversationStyle: {
        tone: "Professional",
        vocabulary: "Clear and accessible",
        responseLength: "Concise"
      }
    };
    console.log("✅ Agent profile created:", agentProfile.name);

    // Create agent in database
    console.log("💾 Saving agent to database...");
    let agent;
    try {
      agent = await createAgent(agentProfile, userId);
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
