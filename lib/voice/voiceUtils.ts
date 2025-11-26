/**
 * Voice Utilities with Automatic Fallback
 * Primary: ElevenLabs (high quality)
 * Fallback: Web Speech API (free)
 */

import { synthesizeSpeechElevenLabs, checkCharacterLimit, calculateElevenLabsCost } from "./elevenlabs";
import { synthesizeSpeechWebSpeech, getBestVoice, isWebSpeechSupported } from "./webSpeech";

export interface VoiceSynthesisResult {
  audio?: ArrayBuffer;
  service: "elevenlabs" | "web-speech";
  cost: number;
  charactersUsed: number;
  success: boolean;
  error?: string;
}

/**
 * Synthesize speech with automatic fallback
 * Tries ElevenLabs first, falls back to Web Speech if:
 * - ElevenLabs quota exceeded
 * - ElevenLabs API error
 * - User budget exceeded
 */
export async function synthesizeSpeech(
  text: string,
  userId: string,
  customApiKey?: string,
  customVoiceId?: string
): Promise<VoiceSynthesisResult> {
  const characterCount = text.length;

  console.log("Attempting voice synthesis with ElevenLabs...");
  
  // Try ElevenLabs first
  try {
    const elevenLabsResult = await tryElevenLabs(text, userId, characterCount, customApiKey, customVoiceId);
    if (elevenLabsResult.success) {
      console.log("ElevenLabs synthesis successful!");
      return elevenLabsResult;
    }
  } catch (error) {
    console.error("ElevenLabs failed, falling back to Web Speech:", error);
  }

  // Fallback to Web Speech
  return await tryWebSpeech(text, characterCount);
}

/**
 * Try ElevenLabs synthesis
 */
async function tryElevenLabs(
  text: string,
  userId: string,
  characterCount: number,
  customApiKey?: string,
  customVoiceId?: string
): Promise<VoiceSynthesisResult> {
  const apiKey = customApiKey || process.env.ELEVENLABS_API_KEY;
  const voiceId = customVoiceId || process.env.ELEVENLABS_VOICE_ID;

  console.log("ElevenLabs API Key present:", !!apiKey);
  console.log("ElevenLabs Voice ID present:", !!voiceId);

  if (!apiKey || !voiceId) {
    throw new Error("ElevenLabs not configured");
  }

  // Check character limit
  const limitCheck = await checkCharacterLimit(apiKey, characterCount);
  if (!limitCheck.hasEnough) {
    console.log(
      `ElevenLabs limit reached (${limitCheck.remaining}/${limitCheck.limit} remaining)`
    );
    throw new Error("Character limit exceeded");
  }

  // Budget checking will be done server-side in the API route
  // Client-side voice utils don't need to check budget

  // Synthesize with ElevenLabs
  const audio = await synthesizeSpeechElevenLabs(text, {
    apiKey,
    voiceId,
  });

  const cost = calculateElevenLabsCost(characterCount);

  return {
    audio,
    service: "elevenlabs",
    cost,
    charactersUsed: characterCount,
    success: true,
  };
}

/**
 * Try Web Speech API (client-side fallback)
 * Note: This should only be called from the client side
 */
async function tryWebSpeech(
  text: string,
  characterCount: number
): Promise<VoiceSynthesisResult> {
  // Check if we're on the server side
  if (typeof window === "undefined") {
    // Return success but indicate client-side handling needed
    return {
      service: "web-speech",
      cost: 0,
      charactersUsed: characterCount,
      success: true,
    };
  }

  if (!isWebSpeechSupported()) {
    return {
      service: "web-speech",
      cost: 0,
      charactersUsed: characterCount,
      success: false,
      error: "Web Speech API not supported in this browser",
    };
  }

  try {
    const voice = getBestVoice("en-US");
    
    await synthesizeSpeechWebSpeech(text, {
      voice: voice || undefined,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    });

    return {
      service: "web-speech",
      cost: 0,
      charactersUsed: characterCount,
      success: true,
    };
  } catch (error) {
    return {
      service: "web-speech",
      cost: 0,
      charactersUsed: characterCount,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Speech-to-Text using Web Speech API
 * (Browser native, free)
 */
export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export class SpeechRecognitionManager {
  private recognition: any;
  private isListening: boolean = false;
  private onResult?: (result: SpeechRecognitionResult) => void;
  private onError?: (error: string) => void;

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      if (this.onResult) {
        this.onResult({ transcript, confidence, isFinal });
      }
    };

    this.recognition.onerror = (event: any) => {
      // Suppress "no-speech" errors as they're normal when user doesn't speak
      if (event.error === "no-speech") {
        return; // Silently ignore
      }
      
      // Log other errors
      console.error("Speech recognition error:", event.error);
      if (this.onError) {
        this.onError(event.error);
      }
    };

    this.recognition.onend = () => {
      console.log("🔚 Recognition ended");
      this.isListening = false;
      
      // Auto-restart if we were listening (keeps session alive)
      // This prevents the "mic stops working" issue after a few uses
      if (this.onResult) {
        console.log("🔄 Auto-restarting recognition to keep session alive");
        setTimeout(() => {
          if (!this.isListening && this.onResult) {
            try {
              this.recognition.start();
              this.isListening = true;
            } catch (e) {
              console.log("Could not auto-restart:", e);
            }
          }
        }, 100);
      }
    };
  }

  /**
   * Start listening for speech
   */
  startListening(
    onResult: (result: SpeechRecognitionResult) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.recognition) {
      if (onError) {
        onError("Speech recognition not supported");
      }
      return;
    }

    this.onResult = onResult;
    this.onError = onError;

    // CRITICAL: Always stop first to prevent "already started" errors
    try {
      if (this.isListening) {
        console.log("🛑 Stopping existing recognition before starting new one");
        this.recognition.stop();
      }
    } catch (e) {
      // Ignore errors from stopping
      console.log("Ignored stop error:", e);
    }

    // Wait a tiny bit for stop to complete, then start
    setTimeout(() => {
      try {
        console.log("▶️ Starting speech recognition");
        this.recognition.start();
        this.isListening = true;
      } catch (error) {
        // Handle "already started" error by forcing a restart
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("already started")) {
          console.log("⚠️ Recognition already started, forcing restart...");
          try {
            this.recognition.stop();
            setTimeout(() => {
              this.recognition.start();
              this.isListening = true;
            }, 100);
          } catch (retryError) {
            console.error("Failed to restart recognition:", retryError);
            if (onError) {
              onError("Failed to start speech recognition");
            }
          }
        } else {
          console.error("Failed to start recognition:", error);
          if (onError) {
            onError(errorMsg);
          }
        }
      }
    }, 50); // Small delay to ensure clean stop
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Check if speech recognition is supported
   */
  static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }
}

/**
 * Simple one-time speech recognition
 */
export function recognizeSpeech(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognitionManager.isSupported()) {
      reject(new Error("Speech recognition not supported"));
      return;
    }

    const manager = new SpeechRecognitionManager();
    let finalTranscript = "";

    manager.startListening(
      (result) => {
        if (result.isFinal) {
          finalTranscript = result.transcript;
          manager.stopListening();
          resolve(finalTranscript);
        }
      },
      (error) => {
        manager.stopListening();
        reject(new Error(error));
      }
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      manager.stopListening();
      if (finalTranscript) {
        resolve(finalTranscript);
      } else {
        reject(new Error("Speech recognition timeout"));
      }
    }, 30000);
  });
}
