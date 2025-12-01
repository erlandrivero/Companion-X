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

    console.log("✅ Topic validated, getting user settings...");
    
    // Get user's API key from settings
    const userSettings = await getUserSettings(userId);
    const userApiKey = userSettings?.apiKeys?.anthropic;
    const braveApiKey = userSettings?.apiKeys?.braveSearch;
    
    console.log("🔑 Using API key:", userApiKey ? "Custom key" : "Environment key");
    
    // Perform a single, fast web search (reduced from 3 searches to avoid timeout)
    const searchQuery = originalQuestion || topic;
    console.log("🔍 Searching for:", searchQuery);
    
    let searchContext = "";
    try {
      // Single search with timeout protection
      const searchResults = await Promise.race([
        searchWeb(searchQuery, 5, braveApiKey),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Search timeout")), 5000))
      ]) as Awaited<ReturnType<typeof searchWeb>>;
      
      searchContext = formatSearchResults(searchResults);
      console.log(`📊 Found ${searchResults.results.length} results`);
    } catch (error) {
      console.warn("⚠️ Web search failed or timed out, proceeding without search results:", error);
      searchContext = "No web search results available.";
    }
    
    // Generate agent profile with user's API key and web search context
    const contextDescription = originalQuestion 
      ? `User asked: "${originalQuestion}". Create an agent to handle this type of question.

WEB SEARCH RESULTS (including Medium articles and published content):
${searchContext}

IMPORTANT INSTRUCTIONS:
- Use the above web search results to create an accurate, well-informed agent profile
- If Medium articles or published content are found, the agent should reference these specific publications when responding
- The agent should be knowledgeable about the person's actual work, articles, and contributions
- Include specific article titles, topics, and insights from the search results in the agent's knowledge base`
      : `WEB SEARCH RESULTS (including Medium articles and published content):
${searchContext}

IMPORTANT INSTRUCTIONS:
- Use the above web search results to create an accurate, well-informed agent profile
- If Medium articles or published content are found, the agent should reference these specific publications when responding
- The agent should be knowledgeable about the person's actual work, articles, and contributions`;
    
    const agentProfile = await generateAgentProfile(topic, contextDescription, userApiKey);

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
