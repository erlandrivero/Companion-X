/**
 * Typo and Voice Recognition Error Correction
 * Handles common voice misrecognition patterns and typos
 */

interface CorrectionResult {
  correctedText: string;
  corrections: Array<{ original: string; corrected: string; confidence: number }>;
  hasMajorCorrections: boolean;
}

/**
 * Common voice recognition errors and their corrections
 */
const VOICE_CORRECTIONS: Record<string, string> = {
  // Homophones (words that sound the same)
  "there": "their|there|they're",
  "your": "your|you're",
  "its": "its|it's",
  "to": "to|too|two",
  "for": "for|four",
  "won": "won|one",
  "know": "know|no",
  "by": "by|buy|bye",
  "here": "here|hear",
  "write": "write|right",
  "where": "where|wear|we're",
  
  // Common voice misrecognitions
  "base": "bass|base",
  "best bait": "bass bait",
  "best fishing": "bass fishing",
  "tablo": "tableau",
  "table low": "tableau",
  "power be i": "power bi",
  "power bee": "power bi",
  "sequel": "sql",
  "my sequel": "mysql",
  "no sequel": "nosql",
  "pie chart": "pie chart|python",
  "date of": "data|date of",
  "date up": "data|date up",
  "machine learning": "machine learning|machine lurning",
  "neural network": "neural network|neural net work",
  "deep learning": "deep learning|deep lurning",
  
  // Technical terms
  "a i": "ai",
  "m l": "ml",
  "g p t": "gpt",
  "a p i": "api",
  "u i": "ui",
  "u x": "ux",
  "c s s": "css",
  "h t m l": "html",
  "j s": "js",
  "s q l": "sql",
};

/**
 * Domain-specific context patterns
 */
const CONTEXT_PATTERNS = [
  // Fishing context
  {
    keywords: ["fish", "fishing", "lake", "water", "rod", "reel"],
    corrections: {
      "base": "bass",
      "best": "bass",
      "base bait": "bass bait",
      "best bait": "bass bait",
    }
  },
  // Data/BI context
  {
    keywords: ["data", "chart", "dashboard", "report", "analysis", "visual"],
    corrections: {
      "tablo": "tableau",
      "table low": "tableau",
      "power be": "power bi",
      "power bee": "power bi",
      "date of": "data",
      "date up": "data",
    }
  },
  // Programming context
  {
    keywords: ["code", "program", "function", "variable", "script"],
    corrections: {
      "pie chart": "python",
      "pie thon": "python",
      "java script": "javascript",
      "type script": "typescript",
    }
  },
  // AI/ML context
  {
    keywords: ["model", "train", "predict", "algorithm", "neural"],
    corrections: {
      "machine learning": "machine learning",
      "machine lurning": "machine learning",
      "deep learning": "deep learning",
      "deep lurning": "deep learning",
    }
  }
];

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Detect context from message content
 */
function detectContext(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detectedContexts: string[] = [];

  for (const pattern of CONTEXT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword)) {
        detectedContexts.push(JSON.stringify(pattern.corrections));
        break;
      }
    }
  }

  return detectedContexts;
}

/**
 * Apply context-aware corrections
 */
function applyContextCorrections(text: string, contexts: string[]): string {
  let corrected = text;

  for (const contextStr of contexts) {
    const corrections = JSON.parse(contextStr);
    for (const [wrong, right] of Object.entries(corrections)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, right as string);
    }
  }

  return corrected;
}

/**
 * Fix common spacing issues in voice recognition
 */
function fixSpacing(text: string): string {
  return text
    // Fix letter spacing (a i -> ai, m l -> ml)
    .replace(/\b([a-z])\s+([a-z])\b/gi, '$1$2')
    // Fix common compounds
    .replace(/data\s+base/gi, 'database')
    .replace(/data\s+set/gi, 'dataset')
    .replace(/machine\s+learning/gi, 'machine learning')
    .replace(/deep\s+learning/gi, 'deep learning')
    .replace(/neural\s+network/gi, 'neural network')
    // Fix "best" -> "bass" in fishing context
    .replace(/\bbest\s+(bait|fishing|lure)/gi, 'bass $1');
}

/**
 * Main correction function
 */
export function correctTyposAndVoiceErrors(text: string): CorrectionResult {
  const corrections: Array<{ original: string; corrected: string; confidence: number }> = [];
  let correctedText = text;

  // Step 1: Fix spacing issues
  const spacingFixed = fixSpacing(correctedText);
  if (spacingFixed !== correctedText) {
    corrections.push({
      original: correctedText,
      corrected: spacingFixed,
      confidence: 0.9
    });
    correctedText = spacingFixed;
  }

  // Step 2: Detect context
  const contexts = detectContext(correctedText);

  // Step 3: Apply context-aware corrections
  if (contexts.length > 0) {
    const contextCorrected = applyContextCorrections(correctedText, contexts);
    if (contextCorrected !== correctedText) {
      corrections.push({
        original: correctedText,
        corrected: contextCorrected,
        confidence: 0.85
      });
      correctedText = contextCorrected;
    }
  }

  // Step 4: Apply general voice corrections
  for (const [wrong, right] of Object.entries(VOICE_CORRECTIONS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    if (regex.test(correctedText)) {
      const options = right.split('|');
      // Use first option as default (most common)
      const replacement = options[0];
      const newText = correctedText.replace(regex, replacement);
      
      if (newText !== correctedText) {
        corrections.push({
          original: wrong,
          corrected: replacement,
          confidence: 0.7
        });
        correctedText = newText;
      }
    }
  }

  // Determine if there were major corrections
  const hasMajorCorrections = corrections.some(c => c.confidence >= 0.8);

  return {
    correctedText,
    corrections,
    hasMajorCorrections
  };
}

/**
 * Smart correction that preserves original if confidence is low
 */
export function smartCorrect(text: string, minConfidence: number = 0.7): string {
  const result = correctTyposAndVoiceErrors(text);
  
  // Only apply corrections if we're confident
  const highConfidenceCorrections = result.corrections.filter(c => c.confidence >= minConfidence);
  
  if (highConfidenceCorrections.length === 0) {
    return text; // No confident corrections, return original
  }

  return result.correctedText;
}

/**
 * Get correction suggestions without applying them
 */
export function getSuggestions(text: string): Array<{ original: string; suggestions: string[] }> {
  const suggestions: Array<{ original: string; suggestions: string[] }> = [];
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    if (VOICE_CORRECTIONS[word]) {
      suggestions.push({
        original: word,
        suggestions: VOICE_CORRECTIONS[word].split('|')
      });
    }
  }

  return suggestions;
}
