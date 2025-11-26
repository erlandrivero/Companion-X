/**
 * ElevenLabs Text-to-Speech Integration
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

/**
 * Synthesize speech using ElevenLabs API
 */
export async function synthesizeSpeechElevenLabs(
  text: string,
  config: ElevenLabsConfig,
  voiceSettings: VoiceSettings = DEFAULT_VOICE_SETTINGS
): Promise<ArrayBuffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;

  console.log("ElevenLabs synthesis attempt:");
  console.log("- URL:", url);
  console.log("- Voice ID:", config.voiceId);
  console.log("- Text length:", text.length);
  console.log("- API Key present:", !!config.apiKey);
  console.log("- API Key starts with:", config.apiKey?.substring(0, 10) + "...");

  const requestBody = {
    text,
    model_id: config.modelId || "eleven_turbo_v2_5", // Switched to Turbo v2.5 for 50% cost savings
    voice_settings: {
      stability: voiceSettings.stability,
      similarity_boost: voiceSettings.similarity_boost,
      style: voiceSettings.style,
      use_speaker_boost: voiceSettings.use_speaker_boost,
    },
  };

  console.log("Request body:", JSON.stringify(requestBody, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  console.log("ElevenLabs response status:", response.status);
  console.log("ElevenLabs response headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const error = await response.text();
    console.error("ElevenLabs API error response:", error);
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  console.log("ElevenLabs synthesis successful!");
  return await response.arrayBuffer();
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices(
  apiKey: string
): Promise<
  Array<{
    voice_id: string;
    name: string;
    category: string;
    description?: string;
  }>
> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices || [];
}

/**
 * Get user's ElevenLabs subscription info
 */
export async function getSubscriptionInfo(apiKey: string): Promise<{
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
}> {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subscription info: ${response.status}`);
  }

  return await response.json();
}

/**
 * Check if user has enough characters remaining
 */
export async function checkCharacterLimit(
  apiKey: string,
  textLength: number
): Promise<{
  hasEnough: boolean;
  remaining: number;
  limit: number;
}> {
  try {
    const info = await getSubscriptionInfo(apiKey);
    const remaining = info.character_limit - info.character_count;

    console.log("ElevenLabs subscription info:", {
      character_count: info.character_count,
      character_limit: info.character_limit,
      remaining,
      textLength,
    });

    return {
      hasEnough: remaining >= textLength,
      remaining,
      limit: info.character_limit,
    };
  } catch (error) {
    console.error("Failed to check character limit - SKIPPING CHECK:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    
    // If subscription check fails, assume we have enough (optimistic)
    // This prevents false "limit reached" errors when API is having issues
    return {
      hasEnough: true, // Changed from false to true
      remaining: -1, // Indicate unknown
      limit: -1, // Indicate unknown
    };
  }
}

/**
 * Stream audio from ElevenLabs (for longer texts)
 */
export async function* streamSpeechElevenLabs(
  text: string,
  config: ElevenLabsConfig,
  voiceSettings: VoiceSettings = DEFAULT_VOICE_SETTINGS
): AsyncGenerator<Uint8Array> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": config.apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: config.modelId || "eleven_monolingual_v1",
      voice_settings: voiceSettings,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs streaming error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Calculate cost for ElevenLabs synthesis
 */
export function calculateElevenLabsCost(characterCount: number): number {
  const monthlyLimit = parseInt(process.env.ELEVENLABS_MONTHLY_LIMIT || "30000");
  const monthlyCost = 5.0; // $5/month plan
  
  // Cost per character
  const costPerCharacter = monthlyCost / monthlyLimit;
  
  return characterCount * costPerCharacter;
}

/**
 * Test ElevenLabs connection
 */
export async function testElevenLabsConnection(apiKey: string): Promise<boolean> {
  try {
    await getAvailableVoices(apiKey);
    return true;
  } catch (error) {
    console.error("ElevenLabs connection test failed:", error);
    return false;
  }
}
