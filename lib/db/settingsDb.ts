import { getDatabase } from "../mongodb";
import { ObjectId } from "mongodb";

export interface UserSettings {
  _id?: ObjectId;
  userId: string;
  apiKeys?: {
    anthropic?: string;
    elevenLabs?: string;
    elevenLabsVoiceId?: string;
    braveSearch?: string;
  };
  voice?: {
    speed: number;
    pitch: number;
    autoSendDelay: number;
    volume: number;
    voiceService: "elevenlabs" | "web-speech" | "auto";
    selectedVoice?: string; // Web Speech Only - voice name
    autoRestartMic: boolean;
    voiceInterruption: boolean; // Web Speech Only - VAD
    continuousListening: boolean;
  };
  ai?: {
    responseLength: "concise" | "normal" | "detailed";
    temperature: number;
  };
  limits?: {
    enabled: boolean;
    maxTokensPerUser: number;
    maxRequestsPerHour: number;
    maxCostPerUser: number;
    requireAuth: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const db = await getDatabase();
    const settings = await db.collection<UserSettings>("user_settings").findOne({ userId });
    return settings;
  } catch (error) {
    console.error("Error getting user settings:", error);
    return null;
  }
}

/**
 * Save user settings
 */
export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<boolean> {
  try {
    const db = await getDatabase();
    const now = new Date();

    // Handle __KEEP_EXISTING__ and __REMOVE__ markers for API keys
    if (settings.apiKeys) {
      const existingSettings = await getUserSettings(userId);
      const apiKeys = { ...settings.apiKeys };
      
      // Handle Anthropic key
      if (apiKeys.anthropic === "__KEEP_EXISTING__") {
        apiKeys.anthropic = existingSettings?.apiKeys?.anthropic;
      } else if (apiKeys.anthropic === "__REMOVE__") {
        delete apiKeys.anthropic;
      }
      
      // Handle ElevenLabs key
      if (apiKeys.elevenLabs === "__KEEP_EXISTING__") {
        apiKeys.elevenLabs = existingSettings?.apiKeys?.elevenLabs;
      } else if (apiKeys.elevenLabs === "__REMOVE__") {
        delete apiKeys.elevenLabs;
      }
      
      // Handle ElevenLabs Voice ID
      if (apiKeys.elevenLabsVoiceId === "__KEEP_EXISTING__") {
        apiKeys.elevenLabsVoiceId = existingSettings?.apiKeys?.elevenLabsVoiceId;
      } else if (apiKeys.elevenLabsVoiceId === "__REMOVE__") {
        delete apiKeys.elevenLabsVoiceId;
      }
      
      settings.apiKeys = apiKeys;
    }

    await db.collection<UserSettings>("user_settings").updateOne(
      { userId },
      {
        $set: {
          ...settings,
          userId,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return true;
  } catch (error) {
    console.error("Error saving user settings:", error);
    return false;
  }
}

/**
 * Get API keys with fallback to environment variables
 * Priority: User settings > Environment variables > Error
 */
export async function getApiKeys(userId: string): Promise<{
  anthropic: string | undefined;
  elevenLabs: string | undefined;
  elevenLabsVoiceId: string | undefined;
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  try {
    // Try to get user's custom keys first
    const settings = await getUserSettings(userId);
    
    const anthropic = settings?.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY;
    const elevenLabs = settings?.apiKeys?.elevenLabs || process.env.ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = settings?.apiKeys?.elevenLabsVoiceId || process.env.ELEVENLABS_VOICE_ID;

    // Check for missing keys and add warnings
    if (!anthropic) {
      warnings.push("Anthropic API key not configured. AI features will not work. Please add your API key in Settings.");
    }
    
    if (!elevenLabs) {
      warnings.push("ElevenLabs API key not configured. Voice will use Web Speech fallback.");
    }

    if (!elevenLabsVoiceId && elevenLabs) {
      warnings.push("ElevenLabs Voice ID not configured. Voice will use Web Speech fallback.");
    }

    return {
      anthropic,
      elevenLabs,
      elevenLabsVoiceId,
      warnings,
    };
  } catch (error) {
    console.error("Error getting API keys:", error);
    
    // Fallback to env on error
    const anthropic = process.env.ANTHROPIC_API_KEY;
    const elevenLabs = process.env.ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID;
    
    if (!anthropic) {
      warnings.push("Anthropic API key not configured. AI features will not work.");
    }
    
    if (!elevenLabs) {
      warnings.push("ElevenLabs API key not configured. Voice will use Web Speech fallback.");
    }

    if (!elevenLabsVoiceId && elevenLabs) {
      warnings.push("ElevenLabs Voice ID not configured. Voice will use Web Speech fallback.");
    }

    return {
      anthropic,
      elevenLabs,
      elevenLabsVoiceId,
      warnings,
    };
  }
}

/**
 * Validate that required API keys are present
 * Throws error if Anthropic key is missing (required for core functionality)
 */
export async function validateApiKeys(userId: string): Promise<void> {
  const { anthropic, warnings } = await getApiKeys(userId);
  
  if (!anthropic) {
    throw new Error(
      "Anthropic API key is required. Please configure it in Settings or add ANTHROPIC_API_KEY to your .env.local file."
    );
  }

  // Log warnings for optional keys
  if (warnings.length > 0) {
    console.warn("API Key warnings:", warnings);
  }
}
