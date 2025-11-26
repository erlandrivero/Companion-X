/**
 * AI Error Handling and Retry Logic
 */

export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class RateLimitError extends AIError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, "RATE_LIMIT", true);
    this.name = "RateLimitError";
  }
}

export class QuotaExceededError extends AIError {
  constructor(message: string = "API quota exceeded") {
    super(message, "QUOTA_EXCEEDED", false);
    this.name = "QuotaExceededError";
  }
}

export class InvalidResponseError extends AIError {
  constructor(message: string = "Invalid response from AI") {
    super(message, "INVALID_RESPONSE", true);
    this.name = "InvalidResponseError";
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a retryable error
      if (error instanceof AIError && !error.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Parse and handle Anthropic API errors
 */
export function handleAnthropicError(error: any): never {
  if (error.status === 429) {
    throw new RateLimitError(
      error.message || "Too many requests. Please try again later."
    );
  }

  if (error.status === 402 || error.status === 403) {
    throw new QuotaExceededError(
      error.message || "API quota exceeded. Please check your billing."
    );
  }

  if (error.status === 400) {
    throw new InvalidResponseError(
      error.message || "Invalid request to AI service"
    );
  }

  if (error.status === 500 || error.status === 503) {
    throw new AIError(
      error.message || "AI service temporarily unavailable",
      "SERVICE_ERROR",
      true
    );
  }

  // Generic error
  throw new AIError(
    error.message || "An error occurred with the AI service",
    "UNKNOWN_ERROR",
    false
  );
}

/**
 * Validate JSON response from AI
 */
export function validateJSONResponse(content: string): any {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new InvalidResponseError("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    if (error instanceof InvalidResponseError) {
      throw error;
    }
    throw new InvalidResponseError(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Sanitize user input before sending to AI
 */
export function sanitizeInput(input: string): string {
  // Remove excessive whitespace
  let sanitized = input.trim().replace(/\s+/g, " ");

  // Limit length
  const maxLength = 10000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof AIError) {
    return error.retryable;
  }

  // Network errors are generally retryable
  if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
    return true;
  }

  return false;
}

/**
 * Log AI errors for monitoring
 */
export function logAIError(
  error: Error,
  context: {
    operation: string;
    userId?: string;
    agentId?: string;
  }
): void {
  console.error("AI Error:", {
    name: error.name,
    message: error.message,
    code: error instanceof AIError ? error.code : "UNKNOWN",
    retryable: error instanceof AIError ? error.retryable : false,
    ...context,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to send this to a monitoring service
  // like Sentry, LogRocket, etc.
}
