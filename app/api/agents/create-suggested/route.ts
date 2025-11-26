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
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";

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

    console.log("✅ Topic validated, performing web search...");
    
    // Get user's API key from settings
    const userSettings = await getUserSettings(userId);
    const userApiKey = userSettings?.apiKeys?.anthropic;
    const braveApiKey = userSettings?.apiKeys?.braveSearch;
    
    console.log("🔑 Using API key:", userApiKey ? "Custom key" : "Environment key");
    
    // Perform comprehensive web search to gather information about the topic
    const searchQuery = originalQuestion || topic;
    console.log("🔍 Searching for:", searchQuery);
    
    // Primary search
    const searchResults = await searchWeb(searchQuery, 5, braveApiKey);
    
    // Search for published work (articles, blogs, papers) - works for any topic
    const publishedQuery = `${searchQuery} article OR blog OR published OR wrote`;
    console.log("📰 Searching for published work:", publishedQuery);
    const publishedResults = await searchWeb(publishedQuery, 5, braveApiKey);
    
    // Search for academic/professional content
    const academicQuery = `${searchQuery} research OR paper OR publication`;
    console.log("📚 Searching for academic content:", academicQuery);
    const academicResults = await searchWeb(academicQuery, 3, braveApiKey);
    
    // Combine and deduplicate results
    const seenUrls = new Set<string>();
    const uniqueResults = [
      ...searchResults.results,
      ...publishedResults.results,
      ...academicResults.results
    ].filter(result => {
      if (seenUrls.has(result.url)) {
        return false;
      }
      seenUrls.add(result.url);
      return true;
    });
    
    const allResults = {
      results: uniqueResults,
      query: searchQuery,
      totalResults: uniqueResults.length
    };
    
    const searchContext = formatSearchResults(allResults);
    
    console.log(`📊 Found ${uniqueResults.length} unique results (${searchResults.results.length} general, ${publishedResults.results.length} published, ${academicResults.results.length} academic)`);
    
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
