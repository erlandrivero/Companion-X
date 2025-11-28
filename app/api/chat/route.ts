import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeQuestion, shouldCreateNewAgent } from "@/lib/ai/agentMatcher";
import { analyzeQuestionWithSkills } from "@/lib/ai/agentMatcherV2";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { sendMessageHaiku, streamMessageHaiku } from "@/lib/ai/claude";
import { getUserAgents } from "@/lib/db/agentDb";
import { createAgent, incrementQuestionsHandled } from "@/lib/db/agentDb";
import { createConversation, addMessage } from "@/lib/db/conversationDb";
import { logUsage } from "@/lib/db/usageDb";
import { checkUserRateLimit } from "@/lib/ai/rateLimiter";
import { RateLimitError } from "@/lib/ai/errorHandler";
import { getAgentSkills } from "@/lib/db/skillDb";
import { matchSkillsToMessage, buildSystemPromptWithSkills } from "@/lib/ai/skillMatcher";
import { getApiKeys } from "@/lib/db/settingsDb";
import { checkUsageLimits, recordUsage } from "@/lib/db/usageLimitsDb";
import { getUserSettings } from "@/lib/db/settingsDb";
import { correctTyposAndVoiceErrors } from "@/lib/ai/typoCorrection";
import { searchWeb, formatSearchResults } from "@/lib/search/webSearch";

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
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";
    
    console.log("🔐 Auth check:", {
      hasSession: !!session,
      userId,
      isDevelopment,
      environment: process.env.NODE_ENV,
    });
    const { 
      message, 
      conversationId, 
      voiceEnabled = false,
      stream = false,
      skipAgentMatching = false
    } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Apply typo and voice recognition error correction
    const correctionResult = correctTyposAndVoiceErrors(message);
    const correctedMessage = correctionResult.correctedText;
    
    // Log corrections if any were made
    if (correctionResult.corrections.length > 0) {
      console.log("🔧 Voice corrections applied:");
      correctionResult.corrections.forEach(c => {
        console.log(`  "${c.original}" → "${c.corrected}" (confidence: ${c.confidence})`);
      });
    }

    // Check if user has custom API keys and get AI settings
    const { anthropic: userApiKey } = await getApiKeys(userId);
    const hasCustomKey = !!userApiKey && userApiKey !== process.env.ANTHROPIC_API_KEY;
    
    console.log("🔑 User:", userId);
    console.log("🔑 Has custom API key:", hasCustomKey);
    console.log("🔑 User key exists:", !!userApiKey);
    
    // Get user's AI preferences
    const userSettings = await getUserSettings(userId);
    let userTemperature = userSettings?.ai?.temperature ?? 0.3;
    const userResponseLength = userSettings?.ai?.responseLength ?? "concise";
    
    // Force very low temperature for concise mode to ensure strict rule following
    if (userResponseLength === "concise" && userTemperature > 0.2) {
      userTemperature = 0.2; // Override to ensure no creative formatting
    }

    // If using trial (no custom key), check usage limits
    if (!hasCustomKey) {
      console.log("⚠️ No custom key - checking trial limits");
    } else {
      console.log("✅ Custom key detected - bypassing trial limits");
    }
    
    if (!hasCustomKey) {
      const settings = await getUserSettings(userId);
      const limits = settings?.limits?.enabled ? settings.limits : {
        enabled: true,
        maxTokensPerUser: 10000,
        maxRequestsPerHour: 20,
        maxCostPerUser: 1.0,
        requireAuth: true,
      };

      const { allowed, reason } = await checkUsageLimits(userId, {
        maxTokensPerDay: limits.maxTokensPerUser,
        maxRequestsPerHour: limits.maxRequestsPerHour,
        maxCostPerDay: limits.maxCostPerUser,
        requireAuth: limits.requireAuth,
      });

      if (!allowed) {
        console.log("🚫 Trial limit reached for user:", userId);
        console.log("🚫 Reason:", reason);
        return NextResponse.json(
          { 
            error: reason,
            trialLimitReached: true,
            limitType: "trial",
            message: "Add your own API key in Settings to continue using the app without limits."
          },
          { status: 429 } // Too Many Requests
        );
      }
    }

    // Check rate limit
    const rateLimit = await checkUserRateLimit(userId);
    if (!rateLimit.allowed) {
      console.log("🚫 Rate limit exceeded for user:", userId);
      console.log("🚫 Reset time:", rateLimit.resetTime);
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before sending more messages.",
          limitType: "rate",
          resetTime: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    // Get user's agents
    const agents = await getUserAgents(userId);
    
    console.log("🔍 DEBUG - Agent retrieval:", {
      userId,
      agentCount: agents.length,
      agentNames: agents.map(a => a.name),
      environment: process.env.NODE_ENV,
      isProduction: !isDevelopment,
      mongoUri: process.env.MONGODB_URI ? "SET (Atlas)" : "NOT SET (localhost)",
    });

    // Check if user is explicitly requesting to add a skill (only if not skipping agent matching)
    // This prevents infinite loops when user declines skill suggestion
    if (!skipAgentMatching) {
      const messageLowerForSkillCheck = correctedMessage.toLowerCase();
      const isExplicitSkillRequest = (
        (messageLowerForSkillCheck.includes('add') || messageLowerForSkillCheck.includes('create')) &&
        (messageLowerForSkillCheck.includes('skill') || messageLowerForSkillCheck.includes('skills'))
      );
      
      if (isExplicitSkillRequest) {
      console.log("🎯 Detected explicit skill creation request:", correctedMessage);
      
      // Extract skill topic from message (everything after "skill" or before "to")
      let skillTopic = "";
      const patterns = [
        /(?:add|create).*?skill.*?(?:about|on|for|called|named)\s+([^.!?,]+?)(?:\s+to|\s+for|$)/i,
        /(?:add|create).*?(?:a|an|the)\s+([^.!?,]+?)\s+skill/i,
        /skill.*?(?:about|on|for|called|named)\s+([^.!?,]+?)(?:\s+to|\s+for|$)/i,
      ];
      
      for (const pattern of patterns) {
        const match = correctedMessage.match(pattern);
        if (match && match[1]) {
          skillTopic = match[1].trim();
          break;
        }
      }
      
      if (!skillTopic) {
        // Fallback: take text between "skill" and "to"
        const fallbackMatch = correctedMessage.match(/skill\s+(.+?)\s+to/i);
        skillTopic = fallbackMatch ? fallbackMatch[1].trim() : "New Skill";
      }
      
      console.log("📝 Extracted skill topic:", skillTopic);
      
      // Find which agent to add skill to
      const agentMatch = agents.find(a => {
        const agentNameLower = a.name.toLowerCase();
        const firstPart = a.name.split('-')[0].trim().toLowerCase();
        return messageLowerForSkillCheck.includes(agentNameLower) || 
               messageLowerForSkillCheck.includes(firstPart);
      });
      
      if (agentMatch) {
        console.log(`✅ Triggering skill suggestion: "${skillTopic}" for agent "${agentMatch.name}"`);
        
        // Trigger skill suggestion modal
        const suggestedSkill = {
          agentId: agentMatch._id!.toString(),
          agentName: agentMatch.name,
          skillName: skillTopic,
          reasoning: `User explicitly requested to add this skill`,
        };
        
        // IMPORTANT: Return immediately to prevent further processing
        if (stream) {
          return new Response(
            new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "skill_suggestion",
                      suggestion: suggestedSkill,
                    })}\n\n`
                  )
                );
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "waiting_for_decision",
                      message: "Please decide whether to add the suggested skill.",
                    })}\n\n`
                  )
                );
                controller.close();
              },
            }),
            {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            }
          );
        }
        
        return NextResponse.json({
          response: "",
          skillSuggestion: suggestedSkill,
          waitingForDecision: true,
        });
      }
      // If no agent found, continue with normal flow
      console.log("⚠️ Could not find agent in explicit skill request, continuing with normal flow");
    }
  }
    
    let matchResult;
    
    // Skip agent matching if flag is set (user declined suggestion)
    if (skipAgentMatching) {
      console.log("⏭️ Skipping agent matching - using generic assistant");
      matchResult = {
        matchedAgent: null,
        confidence: 0,
        reasoning: "User declined agent/skill suggestion",
        suggestNewAgent: false,
        suggestNewSkill: false,
      };
    } else {
      // Get all skills across all agents
      const allSkillsPromises = agents.map(agent => getAgentSkills(agent._id!.toString()));
      const allSkillsArrays = await Promise.all(allSkillsPromises);
      const allSkills = allSkillsArrays.flat();

      // Use enhanced matching with skills consideration
      matchResult = await analyzeQuestionWithSkills(correctedMessage, agents, allSkills, userApiKey);
    }

    console.log("📊 Match result summary:", {
      hasAgent: !!matchResult.matchedAgent,
      agentName: matchResult.matchedAgent?.name,
      confidence: matchResult.confidence,
      suggestNewAgent: matchResult.suggestNewAgent,
      suggestNewSkill: matchResult.suggestNewSkill,
      suggestion: matchResult.suggestion,
    });

    let agentUsed = matchResult.matchedAgent;
    let response = "";
    let agentCreated = false;
    let suggestedAgent: {topic: string; reasoning: string} | null = null;
    let suggestedSkill: {agentId: string; agentName: string; skillName: string; reasoning: string} | null = null;

    // Handle AI recommendations
    console.log("🤔 Checking recommendations:", {
      suggestNewAgent: matchResult.suggestNewAgent,
      suggestNewSkill: matchResult.suggestNewSkill,
      hasSuggestion: !!matchResult.suggestion,
      agentCount: agents.length,
    });

    if (matchResult.suggestNewAgent && matchResult.suggestion && agents.length < 50) {
      // AI suggests creating a new agent - STOP HERE and wait for user decision
      suggestedAgent = {
        topic: matchResult.suggestion,
        reasoning: matchResult.reasoning,
      };
      console.log("✨ Suggesting new agent - waiting for user decision");
      
      // Return immediately with just the suggestion, no response yet
      if (stream) {
        return new Response(
          new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "agent_suggestion",
                    suggestion: suggestedAgent,
                  })}\n\n`
                )
              );
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "waiting_for_decision",
                    message: "Please decide whether to create the suggested agent.",
                  })}\n\n`
                )
              );
              controller.close();
            },
          }),
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }
      
      return NextResponse.json({
        response: "",
        agentSuggestion: suggestedAgent,
        waitingForDecision: true,
      });
    } else if (matchResult.suggestNewSkill && matchResult.suggestion && agentUsed) {
      // AI suggests adding a skill to existing agent - STOP HERE and wait for user decision
      suggestedSkill = {
        agentId: agentUsed._id!.toString(),
        agentName: agentUsed.name,
        skillName: matchResult.suggestion,
        reasoning: matchResult.reasoning,
      };
      console.log("✨ Suggesting new skill - waiting for user decision");
      
      // Return immediately with just the suggestion, no response yet
      if (stream) {
        return new Response(
          new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "skill_suggestion",
                    suggestion: suggestedSkill,
                  })}\n\n`
                )
              );
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "waiting_for_decision",
                    message: "Please decide whether to add the suggested skill.",
                  })}\n\n`
                )
              );
              controller.close();
            },
          }),
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }
      
      return NextResponse.json({
        response: "",
        skillSuggestion: suggestedSkill,
        waitingForDecision: true,
      });
    }

    // Load and match skills if agent is being used (use corrected message)
    let matchedSkills: any[] = [];
    if (agentUsed) {
      const agentSkills = await getAgentSkills(agentUsed._id!.toString());
      if (agentSkills.length > 0) {
        matchedSkills = await matchSkillsToMessage(correctedMessage, agentSkills, userApiKey);
      }
    }

    // Perform web search to get current information
    console.log("🔍 Performing web search for current information...");
    const braveApiKey = userSettings?.apiKeys?.braveSearch;
    
    // Primary search - general information
    const searchResults = await searchWeb(correctedMessage, 3, braveApiKey);
    
    // Search for published content (articles, blog posts, papers)
    // If asking about publications/articles and an agent is being used, search for that agent's name + Medium
    const messageLower = correctedMessage.toLowerCase();
    const isAskingAboutPublications = messageLower.includes('publication') || 
                                       messageLower.includes('article') || 
                                       messageLower.includes('medium') ||
                                       messageLower.includes('wrote') ||
                                       messageLower.includes('published') ||
                                       messageLower.includes('blog');
    
    console.log("🔍 Publication search check:", { 
      hasAgent: !!agentUsed, 
      agentName: agentUsed?.name,
      isAskingAboutPublications,
      message: correctedMessage 
    });
    
    let publishedResults: Awaited<ReturnType<typeof searchWeb>>;
    if (agentUsed && isAskingAboutPublications) {
      // Extract person name from agent name (e.g., "Dr. Ernesto Lee - Title" -> "Ernesto Lee")
      const fullName = agentUsed.name.split('-')[0].trim().replace(/^(Dr\.|Professor|Mr\.|Ms\.|Mrs\.)\s*/i, '');
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      // Try multiple search strategies to find Medium articles
      console.log("📰 Trying multiple search strategies for Medium articles...");
      
      // Strategy 1: Full name with recent filter
      const query1 = `"${fullName}" site:medium.com`;
      console.log("  Strategy 1:", query1);
      publishedResults = await searchWeb(query1, 3, braveApiKey, "py"); // Past year
      
      // Strategy 2: First and last name separately (if no results from strategy 1)
      if (publishedResults.results.length === 0) {
        const query2 = `${firstName} ${lastName} site:medium.com`;
        console.log("  Strategy 2:", query2);
        const results2 = await searchWeb(query2, 3, braveApiKey, "py");
        publishedResults = results2;
      }
      
      // Strategy 3: Just last name + medium (if still no results)
      if (publishedResults.results.length === 0) {
        const query3 = `${lastName} site:medium.com author`;
        console.log("  Strategy 3:", query3);
        const results3 = await searchWeb(query3, 3, braveApiKey, "py");
        publishedResults = results3;
      }
      
      // Strategy 4: Broader Medium search with context (last resort)
      if (publishedResults.results.length === 0) {
        const query4 = `${fullName} medium article AI data`;
        console.log("  Strategy 4 (broad):", query4);
        const results4 = await searchWeb(query4, 5, braveApiKey, "py");
        publishedResults = results4;
      }
      
      console.log(`📊 Found ${publishedResults.results.length} Medium articles after trying multiple strategies`);
    } else {
      const generalQuery = `${correctedMessage} site:medium.com OR site:towardsdatascience.com OR article OR blog`;
      console.log("📰 Searching for general published content");
      publishedResults = await searchWeb(generalQuery, 5, braveApiKey);
    }
    
    // Search for academic/research content
    const academicQuery = `${correctedMessage} research OR paper OR study OR publication`;
    console.log("📚 Searching for academic and research content...");
    const academicResults = await searchWeb(academicQuery, 2, braveApiKey);
    
    // Combine all results, removing duplicates by URL
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
      query: correctedMessage,
      totalResults: uniqueResults.length
    };
    
    const webContext = allResults.results.length > 0 
      ? `\n\nCURRENT WEB INFORMATION (Articles, Publications, and General Info):\n${formatSearchResults(allResults)}\n\nCRITICAL INSTRUCTIONS FOR USING WEB SOURCES:
1. When referencing articles or publications, ALWAYS include the full URL from the search results above
2. Format references as: "I wrote about this in [Article Title] (URL: [exact URL from search results])"
3. If Medium articles are found in the search results, LIST THEM with their URLs
4. Prioritize Medium and published articles over general information
5. If the user asks about your publications and Medium articles are found, provide SPECIFIC article titles and URLs
6. Example: "I've published several articles on Medium, including 'Building AI Agents' (URL: https://medium.com/@author/building-ai-agents-abc123) and 'Data Analytics Best Practices' (URL: https://medium.com/@author/data-analytics-xyz789)"
7. DO NOT say "I don't have access" if the search results contain the information - USE THE SEARCH RESULTS
8. If no Medium articles are found in search results, then you can say you don't have specific links available

Use these sources to provide accurate, well-cited responses with actual URLs.`
      : "";
    
    console.log(`📊 Web search: ${allResults.results.length} unique results (${searchResults.results.length} general, ${publishedResults.results.length} published, ${academicResults.results.length} academic)`);

    // Generate response using matched/created agent or general assistant
    // Adjust base prompt based on user's response length preference
    const responseLengthInstructions = {
      concise: "Maximum 3 sentences. Be extremely brief and direct.",
      normal: "Keep responses clear and focused, typically 3-5 sentences.",
      detailed: "Provide thorough explanations with examples when helpful."
    };
    
    // Prepend strict formatting rules to any system prompt (including agent prompts)
    const formattingRules = `CRITICAL FORMATTING RULES (MUST FOLLOW):
- Your response will be READ ALOUD by voice synthesis
- Use ONLY plain conversational text - NO markdown formatting
- NO asterisks (*, **), hashtags (#, ##), backticks (\`, \`\`\`), brackets ([], ())
- NO horizontal rules (---, ===), tables (|), or code blocks
- NO bullet points or numbered lists
- Write as if speaking naturally to someone
- ${responseLengthInstructions[userResponseLength]}
- EXCEPTION: You MAY include plain URLs (https://...) for places, attractions, articles, or resources you mention - these will be automatically made clickable

`;

    let systemPrompt = agentUsed?.systemPrompt 
      ? formattingRules + agentUsed.systemPrompt + webContext
      : formattingRules + `You are a helpful voice assistant. Answer questions clearly and conversationally.

ABSOLUTELY FORBIDDEN (will break voice synthesis):
❌ Any asterisks: * ** ***
❌ Any hashtags: # ##
❌ Any brackets: [ ] ( )
❌ Any backticks: \` \`\`\`
❌ Any dashes for lists: - --
❌ Bold, italic, or any formatting
❌ Section headers
❌ Multiple options or alternatives

CORRECT EXAMPLES:
Q: "What bait for bass?"
A: "Use live shiners or crawfish. They work year-round and bass love them."

Q: "Year to date calculation"  
A: "Use SUM IF YEAR of Date equals YEAR of TODAY and Date is less than or equal to TODAY THEN Measure END. This sums your measure for the current year up to today."

Q: "Best places to visit in France?"
A: "The south of France is magical. Start with Provence https://en.wikipedia.org/wiki/Provence with its lavender fields and Roman ruins. Visit Avignon https://en.wikipedia.org/wiki/Avignon and Arles https://en.wikipedia.org/wiki/Arles for history. On the coast, Nice https://en.wikipedia.org/wiki/Nice is stunning with Mediterranean beaches."

WRONG EXAMPLES (DO NOT DO THIS):
❌ "**Live bait** (most effective)" - has asterisks
❌ "# Bass Bait Selection" - has hashtag
❌ "- Shiners" - has bullet point
❌ "Quick Answer:" - has section header

Speak naturally. No formatting. Ever.` + webContext;
    
    // Enhance system prompt with matched skills
    if (matchedSkills.length > 0) {
      systemPrompt = buildSystemPromptWithSkills(systemPrompt, matchedSkills);
    }

    // If streaming is requested, use streaming API
    if (stream) {
      return handleStreamingResponse({
        message,
        systemPrompt,
        agentUsed,
        agentCreated,
        suggestedAgent,
        suggestedSkill,
        userId,
        conversationId,
        voiceEnabled,
      });
    }

    // Non-streaming fallback (use corrected message)
    const claudeResponse = await sendMessageHaiku(correctedMessage, {
      systemPrompt,
      enableCaching: !!agentUsed,
      temperature: userTemperature, // Use user's temperature preference
      apiKey: userApiKey, // Use user's custom API key if they have one
    });

    // Strip any markdown that slipped through (safety net)
    let cleanedContent = claudeResponse.content
      .replace(/\*\*/g, '')  // Remove bold
      .replace(/\*/g, '')    // Remove italic
      .replace(/#{1,6}\s?/g, '') // Remove headers
      .replace(/^-{3,}$/gm, '')  // Remove horizontal rules (---)
      .replace(/^={3,}$/gm, '')  // Remove horizontal rules (===)
      .replace(/^\|\s*.+\s*\|$/gm, '') // Remove table rows
      .replace(/^-\s/gm, '')    // Remove bullet points at start of line
      .replace(/`{1,3}/g, '')   // Remove code blocks
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Convert links to text

    response = response + cleanedContent;

    // Update agent metrics if one was used
    if (agentUsed) {
      await incrementQuestionsHandled(agentUsed._id!.toString());
    }

    // Calculate cost
    const cost = (claudeResponse.usage.inputTokens * 0.001 + 
                  claudeResponse.usage.outputTokens * 0.005 +
                  claudeResponse.usage.cachedTokens * 0.0001) / 1000;

    // Log usage
    await logUsage({
      userId,
      timestamp: new Date(),
      service: "claude-haiku",
      endpoint: "/api/chat",
      requestType: "chat",
      tokens: {
        input: claudeResponse.usage.inputTokens,
        output: claudeResponse.usage.outputTokens,
        cached: claudeResponse.usage.cachedTokens,
      },
      characters: 0,
      cost,
      success: true,
      metadata: {
        model: "haiku",
        agentId: agentUsed?._id?.toString(),
        cachingEnabled: !!agentUsed,
      },
    });

    // Record usage for trial users (those without custom API keys)
    if (!hasCustomKey) {
      const totalTokens = claudeResponse.usage.inputTokens + claudeResponse.usage.outputTokens;
      await recordUsage(userId, totalTokens, cost);
    }

    // Save to conversation history
    const sessionId = conversationId || `session_${Date.now()}_${userId}`;
    
    if (!conversationId) {
      await createConversation(sessionId, userId, userId);
    }

    await addMessage(sessionId, userId, {
      role: "user",
      content: message,
      agentUsed: agentUsed?._id?.toString() || null,
      timestamp: new Date(),
      voiceEnabled: voiceEnabled || false,
    });

    await addMessage(sessionId, userId, {
      role: "assistant",
      content: response,
      agentUsed: agentUsed?._id?.toString() || null,
      timestamp: new Date(),
      voiceEnabled: voiceEnabled || false,
    });

    return NextResponse.json({
      response,
      agentUsed: agentUsed ? {
        id: agentUsed._id?.toString(),
        name: agentUsed.name,
        description: agentUsed.description,
      } : null,
      agentCreated,
      // Return full agent data when created
      newAgent: agentCreated && agentUsed ? agentUsed : null,
      // Suggest agent creation if applicable
      suggestedAgent,
      sessionId,
      usage: {
        tokens: claudeResponse.usage,
        cost,
      },
    });
  } catch (error) {
    console.error("❌ Chat API error:", error);
    console.error("❌ Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("❌ Error message:", error instanceof Error ? error.message : String(error));
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      { status: 500 }
    );
  }
}

// Helper function for streaming responses
async function handleStreamingResponse(params: {
  message: string;
  systemPrompt: string;
  agentUsed: any;
  agentCreated: boolean;
  suggestedAgent: any;
  suggestedSkill: any;
  userId: string;
  conversationId: string;
  voiceEnabled: boolean;
}) {
  const {
    message,
    systemPrompt,
    agentUsed,
    agentCreated,
    suggestedAgent,
    suggestedSkill,
    userId,
    conversationId,
    voiceEnabled,
  } = params;

  const encoder = new TextEncoder();
  let fullResponse = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send agent suggestion if applicable
        if (suggestedAgent) {
          console.log("📤 Sending agent suggestion to client:", suggestedAgent.topic);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "agent_suggestion",
                suggestion: suggestedAgent,
              })}\n\n`
            )
          );
        } else {
          console.log("📭 No agent suggestion to send");
        }

        // Note: Skill suggestions are handled earlier in the flow (before response generation)
        // to allow user to decide before the agent responds
        
        // Send agent info if one is being used
        if (agentUsed) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: agentCreated ? "agent_created" : "agent_used",
                agent: {
                  id: agentUsed._id?.toString(),
                  name: agentUsed.name,
                  description: agentUsed.description,
                },
              })}\n\n`
            )
          );
        }

        // Stream the response
        const { anthropic: streamUserApiKey } = await getApiKeys(userId);
        const streamUserSettings = await getUserSettings(userId);
        const streamTemperature = streamUserSettings?.ai?.temperature ?? 0.3;
        
        const streamResponse = await streamMessageHaiku(message, {
          systemPrompt,
          enableCaching: !!agentUsed,
          temperature: streamTemperature, // Use user's temperature preference
          apiKey: streamUserApiKey, // Use user's custom API key if they have one
        });

        for await (const chunk of streamResponse) {
          if (chunk.type === "content_block_delta") {
            let text = chunk.delta.text;
            
            // Strip markdown formatting in real-time (safety net)
            text = text
              .replace(/\*\*/g, '')  // Remove bold
              .replace(/\*/g, '')    // Remove italic
              .replace(/#{1,6}\s?/g, '') // Remove headers
              .replace(/^-{3,}$/gm, '')  // Remove horizontal rules (---)
              .replace(/^={3,}$/gm, '')  // Remove horizontal rules (===)
              .replace(/^\|\s*.+\s*\|$/gm, '') // Remove table rows
              .replace(/^-\s/gm, '')    // Remove bullet points at start of line
              .replace(/`{1,3}/g, '')   // Remove code blocks
              .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Convert links to text
            
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "content", text })}\n\n`)
            );
          } else if (chunk.type === "message_start") {
            totalInputTokens = chunk.message.usage.input_tokens;
          } else if (chunk.type === "message_delta") {
            totalOutputTokens = chunk.usage.output_tokens;
          }
        }

        // Update agent metrics
        if (agentUsed) {
          await incrementQuestionsHandled(agentUsed._id!.toString());
        }

        // Calculate cost
        const cost =
          (totalInputTokens * 0.001 +
            totalOutputTokens * 0.005 +
            totalCachedTokens * 0.0001) /
          1000;

        // Log usage
        await logUsage({
          userId,
          timestamp: new Date(),
          service: "claude-haiku",
          endpoint: "/api/chat",
          requestType: "chat",
          tokens: {
            input: totalInputTokens,
            output: totalOutputTokens,
            cached: totalCachedTokens,
          },
          characters: 0,
          cost,
          success: true,
          metadata: {
            model: "haiku",
            agentId: agentUsed?._id?.toString(),
            cachingEnabled: !!agentUsed,
          },
        });

        // Record usage for trial users (those without custom API keys)
        const { anthropic: currentUserApiKey } = await getApiKeys(userId);
        const isUsingTrialKey = !!currentUserApiKey && currentUserApiKey !== process.env.ANTHROPIC_API_KEY;
        if (!isUsingTrialKey) {
          const totalTokens = totalInputTokens + totalOutputTokens;
          await recordUsage(userId, totalTokens, cost);
        }

        // Save to conversation history
        const sessionId = conversationId || `session_${Date.now()}_${userId}`;

        if (!conversationId) {
          await createConversation(sessionId, userId, userId);
        }

        await addMessage(sessionId, userId, {
          role: "user",
          content: message,
          agentUsed: agentUsed?._id?.toString() || null,
          timestamp: new Date(),
          voiceEnabled: voiceEnabled || false,
        });

        await addMessage(sessionId, userId, {
          role: "assistant",
          content: fullResponse,
          agentUsed: agentUsed?._id?.toString() || null,
          timestamp: new Date(),
          voiceEnabled: voiceEnabled || false,
        });

        // Send completion event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              usage: {
                tokens: {
                  input: totalInputTokens,
                  output: totalOutputTokens,
                  cached: totalCachedTokens,
                },
                cost,
              },
              sessionId,
            })}\n\n`
          )
        );

        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
