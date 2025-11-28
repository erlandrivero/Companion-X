/**
 * Web Speech API Integration (Fallback)
 * Free, browser-native text-to-speech
 */

export interface WebSpeechOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

const DEFAULT_OPTIONS: WebSpeechOptions = {
  lang: "en-US",
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
};

/**
 * Remove URLs from text to prevent them from being read aloud
 */
function stripUrlsFromText(text: string): string {
  // Remove URLs (http://, https://, www.)
  return text.replace(/https?:\/\/[^\s]+/g, '').replace(/www\.[^\s]+/g, '').trim();
}

/**
 * Synthesize speech using Web Speech API
 * Returns a promise that resolves when speech is complete
 */
export function synthesizeSpeechWebSpeech(
  text: string,
  options: WebSpeechOptions = DEFAULT_OPTIONS
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Web Speech API not supported in this browser"));
      return;
    }

    // Strip URLs from text before speaking
    const cleanText = stripUrlsFromText(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Apply options
    utterance.lang = options.lang || DEFAULT_OPTIONS.lang!;
    utterance.pitch = options.pitch || DEFAULT_OPTIONS.pitch!;
    utterance.rate = options.rate || DEFAULT_OPTIONS.rate!;
    utterance.volume = options.volume || DEFAULT_OPTIONS.volume!;

    // Set voice if specified
    if (options.voice) {
      utterance.voice = options.voice;
    }

    // Event handlers
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

    // Start speaking
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Get available voices from Web Speech API
 */
export function getAvailableVoicesWebSpeech(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}

/**
 * Get female voices (prefer for soft, friendly tone)
 */
export function getFemaleVoices(): SpeechSynthesisVoice[] {
  const voices = getAvailableVoicesWebSpeech();
  
  return voices.filter(
    (voice) =>
      voice.name.toLowerCase().includes("female") ||
      voice.name.toLowerCase().includes("woman") ||
      voice.name.toLowerCase().includes("samantha") ||
      voice.name.toLowerCase().includes("victoria") ||
      voice.name.toLowerCase().includes("karen") ||
      voice.name.toLowerCase().includes("zira")
  );
}

/**
 * Get best available voice for the given language
 */
export function getBestVoice(lang: string = "en-US"): SpeechSynthesisVoice | null {
  const voices = getAvailableVoicesWebSpeech();
  
  // Try to find a female voice for the language
  const femaleVoice = voices.find(
    (voice) =>
      voice.lang.startsWith(lang.split("-")[0]) &&
      (voice.name.toLowerCase().includes("female") ||
        voice.name.toLowerCase().includes("samantha"))
  );

  if (femaleVoice) return femaleVoice;

  // Fallback to any voice for the language
  const langVoice = voices.find((voice) => voice.lang.startsWith(lang.split("-")[0]));
  
  if (langVoice) return langVoice;

  // Last resort: return first available voice
  return voices[0] || null;
}

/**
 * Stop current speech synthesis
 */
export function stopSpeech(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause current speech synthesis
 */
export function pauseSpeech(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume paused speech synthesis
 */
export function resumeSpeech(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
}

/**
 * Check if speech synthesis is currently speaking
 */
export function isSpeaking(): boolean {
  if ("speechSynthesis" in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Check if Web Speech API is supported
 */
export function isWebSpeechSupported(): boolean {
  return "speechSynthesis" in window;
}

/**
 * Wait for voices to be loaded (some browsers load them asynchronously)
 */
export function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Wait for voices to load
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };

    // Timeout after 3 seconds
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 3000);
  });
}

/**
 * Chunk long text for better synthesis
 * Web Speech API works better with shorter chunks
 */
export function chunkText(text: string, maxLength: number = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Speak long text in chunks
 */
export async function speakLongText(
  text: string,
  options: WebSpeechOptions = DEFAULT_OPTIONS
): Promise<void> {
  const chunks = chunkText(text);

  for (const chunk of chunks) {
    await synthesizeSpeechWebSpeech(chunk, options);
  }
}
