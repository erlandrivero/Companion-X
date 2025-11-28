import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODELS } from "../constants";

// Default Anthropic client (uses env var)
const defaultAnthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
  };
  model: string;
}

export interface ClaudeOptions {
  systemPrompt?: string;
  enableCaching?: boolean;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string; // Allow custom API key
  tools?: Anthropic.Messages.Tool[];
  images?: Array<{ base64: string; mediaType: string }>; // Vision support
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>; // Multi-turn conversation
}

/**
 * Get Anthropic client (custom key or default)
 * Priority: 1. Custom key from database, 2. Environment variable
 */
function getAnthropicClient(apiKey?: string): Anthropic {
  // If custom key provided, always use it (primary)
  if (apiKey) {
    return new Anthropic({ apiKey });
  }
  
  // Fallback to environment variable
  // If env key doesn't exist, Anthropic SDK will throw a clear error
  return defaultAnthropic;
}

/**
 * Send message using Claude Haiku (fast and cost-efficient)
 * Use for: chat conversations, agent matching, quick responses
 */
export async function sendMessageHaiku(
  userMessage: string,
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const {
    systemPrompt,
    enableCaching = false,
    maxTokens = 4096,
    temperature = 1.0,
    apiKey,
    images = [],
    conversationHistory = [],
  } = options;

  const anthropic = getAnthropicClient(apiKey);

  try {
    const systemMessages: Anthropic.Messages.MessageCreateParams["system"] = [];

    if (systemPrompt) {
      if (enableCaching) {
        // Enable prompt caching for system prompt
        systemMessages.push({
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        });
      } else {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
        });
      }
    }

    // Build message content with images if provided
    const messageContent: Anthropic.Messages.MessageParam["content"] = [];
    
    // Add images first
    images.forEach((image) => {
      messageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: image.base64,
        },
      });
    });
    
    // Add text message
    messageContent.push({
      type: "text",
      text: userMessage,
    });

    // Build full conversation with history
    const allMessages: Anthropic.Messages.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: images.length > 0 ? messageContent : userMessage,
      },
    ];
    
    // Debug log to verify message structure
    console.log(`🔍 [sendMessageHaiku] Sending ${allMessages.length} messages to Claude:`, 
      allMessages.map((m, i) => `${i}: ${m.role}`).join(', '));

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.HAIKU,
      max_tokens: maxTokens,
      temperature,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      messages: allMessages,
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedTokens:
          (response.usage as any).cache_read_input_tokens || 0,
      },
      model: CLAUDE_MODELS.HAIKU,
    };
  } catch (error) {
    console.error("Claude Haiku error:", error);
    throw new Error(
      `Claude Haiku API error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send message with tool use (function calling)
 * Use for: structured outputs, agent matching, skill suggestions
 */
export async function sendMessageWithTools(
  userMessage: string,
  options: ClaudeOptions = {}
): Promise<ClaudeResponse & { toolUse?: any }> {
  const {
    systemPrompt,
    enableCaching = false,
    maxTokens = 4096,
    temperature = 0.3,
    apiKey,
    tools = [],
  } = options;

  const anthropic = getAnthropicClient(apiKey);

  try {
    const systemMessages: Anthropic.Messages.MessageCreateParams["system"] = [];

    if (systemPrompt) {
      systemMessages.push({
        type: "text",
        text: systemPrompt,
      });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.HAIKU,
      max_tokens: maxTokens,
      temperature,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      tools: tools.length > 0 ? tools : undefined,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // Extract text content and tool use
    let content = "";
    let toolUse: any = null;

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolUse = {
          name: block.name,
          input: block.input,
        };
      }
    }

    return {
      content,
      toolUse,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedTokens:
          (response.usage as any).cache_read_input_tokens || 0,
      },
      model: CLAUDE_MODELS.HAIKU,
    };
  } catch (error) {
    console.error("Claude tool use error:", error);
    throw new Error(
      `Claude tool use API error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send message using Claude Sonnet (high quality, more expensive)
 * Use for: agent creation, agent evolution, complex reasoning
 */
export async function sendMessageSonnet(
  userMessage: string,
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const {
    systemPrompt,
    enableCaching = true, // Default to true for Sonnet (expensive model)
    maxTokens = 8192,
    temperature = 1.0,
    apiKey,
  } = options;

  const anthropic = getAnthropicClient(apiKey);

  try {
    const systemMessages: Anthropic.Messages.MessageCreateParams["system"] = [];

    if (systemPrompt) {
      if (enableCaching) {
        // Enable prompt caching for system prompt
        systemMessages.push({
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        });
      } else {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
        });
      }
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.SONNET,
      max_tokens: maxTokens,
      temperature,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedTokens:
          (response.usage as any).cache_read_input_tokens || 0,
      },
      model: CLAUDE_MODELS.SONNET,
    };
  } catch (error) {
    console.error("Claude Sonnet error:", error);
    throw new Error(
      `Claude Sonnet API error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Stream message using Claude Haiku (for real-time responses)
 * Use for: chat conversations with streaming UI
 */
export async function streamMessageHaiku(
  userMessage: string,
  options: ClaudeOptions = {}
): Promise<AsyncIterable<any>> {
  const {
    systemPrompt,
    enableCaching = false,
    maxTokens = 4096,
    temperature = 1.0,
    apiKey,
    images = [],
    conversationHistory = [],
  } = options;

  const anthropic = getAnthropicClient(apiKey);

  try {
    const systemMessages: Anthropic.Messages.MessageCreateParams["system"] = [];

    if (systemPrompt) {
      if (enableCaching) {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        });
      } else {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
        });
      }
    }

    // Build message content with images if provided
    const messageContent: Anthropic.Messages.MessageParam["content"] = [];
    
    // Add images first
    images.forEach((image) => {
      messageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: image.base64,
        },
      });
    });
    
    // Add text message
    messageContent.push({
      type: "text",
      text: userMessage,
    });

    // Build full conversation with history
    const allMessages: Anthropic.Messages.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: images.length > 0 ? messageContent : userMessage,
      },
    ];
    
    // Debug log to verify message structure
    console.log(`🔍 [streamMessageHaiku] Sending ${allMessages.length} messages to Claude:`, 
      allMessages.map((m, i) => `${i}: ${m.role}`).join(', '));
    console.log(`📝 [streamMessageHaiku] Message details:`, 
      allMessages.map((m, i) => ({
        index: i,
        role: m.role,
        contentPreview: typeof m.content === 'string' ? m.content.substring(0, 100) : '[complex content]'
      })));

    const stream = await anthropic.messages.stream({
      model: CLAUDE_MODELS.HAIKU,
      max_tokens: maxTokens,
      temperature,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      messages: allMessages,
    });

    return stream;
  } catch (error) {
    console.error("Claude Haiku streaming error:", error);
    throw new Error(
      `Claude Haiku streaming API error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send multi-turn conversation using Claude Haiku
 */
export async function sendConversationHaiku(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const {
    systemPrompt,
    enableCaching = false,
    maxTokens = 4096,
    temperature = 1.0,
    apiKey,
  } = options;

  const anthropic = getAnthropicClient(apiKey);

  try {
    const systemMessages: Anthropic.Messages.MessageCreateParams["system"] = [];

    if (systemPrompt) {
      if (enableCaching) {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        });
      } else {
        systemMessages.push({
          type: "text",
          text: systemPrompt,
        });
      }
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.HAIKU,
      max_tokens: maxTokens,
      temperature,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedTokens:
          (response.usage as any).cache_read_input_tokens || 0,
      },
      model: CLAUDE_MODELS.HAIKU,
    };
  } catch (error) {
    console.error("Claude Haiku conversation error:", error);
    throw new Error(
      `Claude Haiku API error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Test Claude API connection
 */
export async function testClaudeConnection(): Promise<boolean> {
  try {
    const response = await sendMessageHaiku("Hello! Please respond with 'OK'.", {
      maxTokens: 10,
    });
    return response.content.length > 0;
  } catch (error) {
    console.error("Claude connection test failed:", error);
    return false;
  }
}

/**
 * Get estimated cost for a request
 */
export function estimateRequestCost(
  inputTokens: number,
  outputTokens: number,
  model: "haiku" | "sonnet",
  cachedTokens: number = 0
): number {
  const costs = {
    haiku: { input: 1.0, output: 5.0, cached: 0.1 },
    sonnet: { input: 3.0, output: 15.0, cached: 0.3 },
  };

  const modelCosts = costs[model];
  const inputCost = ((inputTokens - cachedTokens) / 1_000_000) * modelCosts.input;
  const cachedCost = (cachedTokens / 1_000_000) * modelCosts.cached;
  const outputCost = (outputTokens / 1_000_000) * modelCosts.output;

  return inputCost + cachedCost + outputCost;
}
