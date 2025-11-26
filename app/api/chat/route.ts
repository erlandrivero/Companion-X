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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // For local testing without auth, use a default user
    const userId = session?.user?.email || "demo@localhost.dev";
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
        matchedSkills = await matchSkillsToMessage(correctedMessage, agentSkills);
      }
    }

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

`;

    let systemPrompt = agentUsed?.systemPrompt 
      ? formattingRules + agentUsed.systemPrompt
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

WRONG EXAMPLES (DO NOT DO THIS):
❌ "**Live bait** (most effective)" - has asterisks
❌ "# Bass Bait Selection" - has hashtag
❌ "- Shiners" - has bullet point
❌ "Quick Answer:" - has section header

Speak naturally. No formatting. Ever.`;
    
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

        // Send skill suggestion if applicable
        if (suggestedSkill) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "skill_suggestion",
                suggestion: suggestedSkill,
              })}\n\n`
            )
          );
        }

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
