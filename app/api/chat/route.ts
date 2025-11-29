import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeQuestion, shouldCreateNewAgent } from "@/lib/ai/agentMatcher";
import { analyzeQuestionWithSkills } from "@/lib/ai/agentMatcherV2";
import { generateAgentProfile } from "@/lib/ai/agentCreator";
import { sendMessageHaiku, streamMessageHaiku } from "@/lib/ai/claude";
import { getUserAgents } from "@/lib/db/agentDb";
import { createAgent, incrementQuestionsHandled } from "@/lib/db/agentDb";
import { createConversation, addMessage, getConversation } from "@/lib/db/conversationDb";
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
import { validateFileSize } from "@/lib/files/fileProcessor";
import { processFileOnServer } from "@/lib/files/serverFileProcessor";
import { detectArtifacts } from "@/lib/artifacts/artifactDetector";

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
    // Handle both JSON and FormData (for file uploads)
    const contentType = request.headers.get('content-type') || '';
    let message: string;
    let conversationId: string | undefined;
    let voiceEnabled = false;
    let stream = false;
    let skipAgentMatching = false;
    let uploadedFiles: File[] = [];
    let fileContext = '';
    let imageFiles: Array<{name: string; base64: string; mediaType: string}> = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      message = formData.get('message') as string;
      conversationId = formData.get('conversationId') as string | undefined;
      voiceEnabled = formData.get('voiceEnabled') === 'true';
      stream = formData.get('stream') === 'true';
      skipAgentMatching = formData.get('skipAgentMatching') === 'true';
      
      // Process uploaded files
      const files = formData.getAll('files') as File[];
      for (const file of files) {
        try {
          // Validate file size
          const validation = validateFileSize(file);
          if (!validation.valid) {
            return NextResponse.json(
              { error: validation.error },
              { status: 400 }
            );
          }
          
          uploadedFiles.push(file);
          
          // Check if file is an image
          const isImage = file.type.startsWith('image/');
          
          if (isImage) {
            // Process images for vision API
            const arrayBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            imageFiles.push({
              name: file.name,
              base64,
              mediaType: file.type,
            });
            fileContext += `[Image: ${file.name}]\n\n`;
          } else {
            // Process other files normally
            const fileContent = await processFileOnServer(file);
            fileContext += `--- BEGIN FILE: ${file.name} ---\n${fileContent}\n--- END FILE: ${file.name} ---\n\n`;
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          return NextResponse.json(
            { error: `Failed to process file: ${file.name}` },
            { status: 500 }
          );
        }
      }
      
      if (uploadedFiles.length > 0) {
        console.log(`📎 Processed ${uploadedFiles.length} file(s):`, uploadedFiles.map(f => f.name));
      }
    } else {
      // Handle regular JSON request
      const body = await request.json();
      message = body.message;
      conversationId = body.conversationId;
      voiceEnabled = body.voiceEnabled || false;
      stream = body.stream || false;
      skipAgentMatching = body.skipAgentMatching || false;
    }

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
    const { anthropic: userApiKey, warnings } = await getApiKeys(userId);
    const hasCustomKey = !!userApiKey && userApiKey !== process.env.ANTHROPIC_API_KEY;
    
    console.log("🔑 User:", userId);
    console.log("🔑 Has custom API key:", hasCustomKey);
    console.log("🔑 User key exists:", !!userApiKey);
    console.log("🔑 User key length:", userApiKey?.length || 0);
    console.log("🔑 User key starts with:", userApiKey?.substring(0, 10) || "N/A");
    console.log("🔑 API key warnings:", warnings);
    console.log("🔑 Env key exists:", !!process.env.ANTHROPIC_API_KEY);
    console.log("🔑 Env key length:", process.env.ANTHROPIC_API_KEY?.length || 0);
    
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

      console.log("🔍 Before analyzeQuestionWithSkills:", {
        hasUserApiKey: !!userApiKey,
        userApiKeyLength: userApiKey?.length || 0,
        agentsCount: agents.length,
        skillsCount: allSkills.length,
      });

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
      needsClarification: matchResult.needsClarification,
      agentCount: agents.length,
    });

    // If Claude is asking for clarification, respond directly without suggesting agent
    if (matchResult.needsClarification && matchResult.suggestion) {
      console.log("💬 Claude needs clarification - responding directly");
      response = matchResult.suggestion;
      
      // Return the clarification message
      return NextResponse.json({
        response,
        agentUsed: null,
        agentCreated: false,
        suggestedAgent: null,
        suggestedSkill: null,
      });
    }

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
    
    // Detect if user is asking about prices, costs, or hotel information
    const messageLowerForPricing = correctedMessage.toLowerCase();
    const isAskingAboutPricing = messageLowerForPricing.includes('price') || 
                                  messageLowerForPricing.includes('cost') ||
                                  messageLowerForPricing.includes('room') ||
                                  messageLowerForPricing.includes('hotel') ||
                                  messageLowerForPricing.includes('booking') ||
                                  messageLowerForPricing.includes('rate') ||
                                  messageLowerForPricing.includes('how much');
    
    // Primary search - general information (more results for pricing queries)
    const primarySearchCount = isAskingAboutPricing ? 8 : 3;
    const searchResults = await searchWeb(correctedMessage, primarySearchCount, braveApiKey);
    
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
      
      // Strategy 1: UNRESTRICTED search for very recent articles (catches custom domains)
      const query1Unrestricted = `"${fullName}" article published`;
      console.log("  Strategy 1 (unrestricted, recent):", query1Unrestricted);
      publishedResults = await searchWeb(query1Unrestricted, 10, braveApiKey, "pm"); // Past month - most recent
      
      // Strategy 2: If no results, try with site restrictions
      if (publishedResults.results.length === 0) {
        const query1 = `"${fullName}" (site:medium.com OR site:*.medium.com OR article OR blog)`;
        console.log("  Strategy 2 (site-restricted, recent):", query1);
        publishedResults = await searchWeb(query1, 5, braveApiKey, "pm");
      }
      
      // Strategy 3: If still no recent articles, try past year unrestricted
      if (publishedResults.results.length === 0) {
        console.log("  Strategy 3 (unrestricted, past year):", query1Unrestricted);
        publishedResults = await searchWeb(query1Unrestricted, 10, braveApiKey, "py"); // Past year, more results
      }
      
      // Strategy 3: First and last name separately (if no results from strategy 1 & 2)
      if (publishedResults.results.length === 0) {
        const query2 = `${firstName} ${lastName} site:medium.com`;
        console.log("  Strategy 3 (name parts):", query2);
        const results2 = await searchWeb(query2, 10, braveApiKey, "py");
        publishedResults = results2;
      }
      
      // Strategy 4: Just last name + medium (if still no results)
      if (publishedResults.results.length === 0) {
        const query3 = `${lastName} site:medium.com author`;
        console.log("  Strategy 4 (last name):", query3);
        const results3 = await searchWeb(query3, 10, braveApiKey, "py");
        publishedResults = results3;
      }
      
      // Strategy 5: Broader Medium search with context (last resort)
      if (publishedResults.results.length === 0) {
        const query4 = `${fullName} medium article AI data`;
        console.log("  Strategy 5 (broad):", query4);
        const results4 = await searchWeb(query4, 10, braveApiKey, "py");
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
    
    // Additional search for pricing/hotel information if detected
    let pricingResults: Awaited<ReturnType<typeof searchWeb>> = { results: [], query: '', totalResults: 0 };
    if (isAskingAboutPricing) {
      const pricingQuery = `${correctedMessage} booking.com OR hotels.com OR tripadvisor OR expedia 2024 2025`;
      console.log("💰 Searching for pricing information:", pricingQuery);
      pricingResults = await searchWeb(pricingQuery, 5, braveApiKey);
    }
    
    // Combine all results, removing duplicates by URL
    const seenUrls = new Set<string>();
    const uniqueResults = [
      ...searchResults.results,
      ...publishedResults.results,
      ...academicResults.results,
      ...pricingResults.results
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
    
    const isAskingForLatest = correctedMessage.toLowerCase().includes('latest') || 
                               correctedMessage.toLowerCase().includes('last') ||
                               correctedMessage.toLowerCase().includes('recent') ||
                               correctedMessage.toLowerCase().includes('newest');
    
    const webContext = allResults.results.length > 0 
      ? `\n\n=== CURRENT WEB SEARCH RESULTS ===
${formatSearchResults(allResults)}

MANDATORY INSTRUCTIONS - YOU MUST FOLLOW THESE:
1. The search results above contain REAL, CURRENT information from the web
2. When the user asks about publications or articles, YOU MUST list the specific articles from the search results above
3. DO NOT give generic responses - USE THE ACTUAL TITLES AND URLS from the search results
4. ${isAskingForLatest ? 'THE USER ASKED FOR THE LATEST/LAST/MOST RECENT ARTICLE - Look at the search results and identify which article appears to be the MOST RECENT (look for dates, "ago" indicators, or position in results). START with that article.' : 'Format: "Here are the articles I found: [Article Title 1] at [URL1], [Article Title 2] at [URL2]"'}
5. If Medium articles appear in search results, LIST EACH ONE with its title and URL
6. NEVER say "I don't have access" or "check my profile" when search results are provided - CITE THE RESULTS DIRECTLY
7. The URLs in the search results are REAL and CURRENT - include them in your response
8. Example response: "I found these Medium articles: Understanding AI Ethics https://medium.com/@author/ai-ethics-123 and Machine Learning Basics https://medium.com/@author/ml-basics-456"
${isAskingForLatest ? '\n⚠️ CRITICAL: User specifically asked for LATEST/LAST/RECENT - prioritize the most recent article from the search results!' : ''}
${isAskingAboutPricing ? '\n\n💰 PRICING INFORMATION INSTRUCTIONS:\n- The user is asking about PRICES, COSTS, or HOTEL RATES\n- The search results above contain REAL pricing information from booking sites\n- YOU MUST extract and provide the specific prices, room types, and rates mentioned in the search results\n- Include the booking site URLs where users can verify and book\n- DO NOT say you cannot provide prices - the search results contain this information\n- Example: "Based on current rates, the Monte Carlo Hotel offers rooms starting at 500 euros per night for a standard room. You can check availability at https://booking.com/monte-carlo or https://hotels.com/monte-carlo"' : ''}

CRITICAL: If search results are provided above, you MUST reference them specifically in your answer.`
      : "";
    
    console.log(`📊 Web search: ${allResults.results.length} unique results (${searchResults.results.length} general, ${publishedResults.results.length} published, ${academicResults.results.length} academic${isAskingAboutPricing ? `, ${pricingResults.results.length} pricing` : ''})`);

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

CONVERSATION CONTEXT AWARENESS:
- You have access to the full conversation history
- If the user changes topics (e.g., from data analytics to weather), recognize the shift and adapt your expertise accordingly
- Don't assume the new question relates to previous topics unless explicitly connected
- Each question should be answered on its own merits while being aware of conversation flow
- Example: If discussing data mining, then user asks "What's the weather?", treat it as a new topic about weather, not data

`;

    // Add file context if files were uploaded
    const fileContextSection = fileContext ? `\n\n=== UPLOADED FILES ===\n${fileContext}\nThe user has uploaded the above file(s). Reference them in your response as needed.\n` : '';
    
    let systemPrompt = agentUsed?.systemPrompt 
      ? formattingRules + agentUsed.systemPrompt + webContext + fileContextSection
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

    // Load conversation history if conversationId exists
    let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (conversationId) {
      const conversation = await getConversation(conversationId, userId);
      if (conversation && conversation.messages) {
        // Convert messages to Claude format, filtering out system messages
        // Limit to last 20 messages (10 exchanges) to prevent token overflow
        conversationHistory = conversation.messages
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .slice(-20)
          .map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));
        console.log(`📚 Loaded ${conversationHistory.length} messages from conversation history`);
        console.log(`📝 History preview:`, conversationHistory.slice(-2).map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
        console.log(`🆕 Current message: ${message.substring(0, 50)}...`);
      }
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
        imageFiles,
        conversationHistory,
      });
    }

    // Non-streaming fallback (use corrected message)
    const claudeResponse = await sendMessageHaiku(correctedMessage, {
      systemPrompt,
      enableCaching: !!agentUsed,
      temperature: userTemperature, // Use user's temperature preference
      apiKey: userApiKey, // Use user's custom API key if they have one
      conversationHistory, // Pass conversation history for context
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
  conversationId?: string;
  voiceEnabled: boolean;
  imageFiles?: Array<{name: string; base64: string; mediaType: string}>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
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
    imageFiles = [],
    conversationHistory = [],
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
          images: imageFiles, // Pass images for vision
          conversationHistory, // Pass conversation history for context
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

        // Detect artifacts in the response
        const artifacts = detectArtifacts(fullResponse);
        
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
              artifacts: artifacts.length > 0 ? artifacts : undefined,
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
