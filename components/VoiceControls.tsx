"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { SpeechRecognitionManager } from "@/lib/voice/voiceUtils";
import { synthesizeSpeechWebSpeech, getBestVoice, stopSpeech } from "@/lib/voice/webSpeech";

interface VoiceControlsProps {
  onTranscript?: (text: string, isFinal?: boolean) => void;
  onSpeakText?: string;
  disabled?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
  isAudioPlaying?: boolean;
  onVoiceInterrupt?: () => void; // Called when user starts speaking during AI voice
  // Voice settings from user preferences
  voiceSpeed?: number;
  voicePitch?: number;
  selectedVoiceName?: string;
  voiceService?: "elevenlabs" | "web-speech" | "auto";
}

export const VoiceControls = forwardRef<{ restartListening: () => void }, VoiceControlsProps>(
  function VoiceControls({
    onTranscript,
    onSpeakText,
    disabled = false,
    onListeningChange,
    onVolumeChange,
    volume: externalVolume = 1.0,
    isAudioPlaying = false,
    onVoiceInterrupt,
    voiceSpeed: propVoiceSpeed,
    voicePitch: propVoicePitch,
    selectedVoiceName,
    voiceService: propVoiceService = "auto",
  }, ref) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceService, setVoiceService] = useState<"elevenlabs" | "web-speech" | null>(null);
  const [volume, setVolume] = useState(externalVolume || 1.0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Sync external volume
  useEffect(() => {
    if (externalVolume !== undefined) {
      setVolume(externalVolume);
    }
  }, [externalVolume]);
  
  const recognitionManager = useRef<SpeechRecognitionManager | null>(null);
  const vadRecognitionManager = useRef<SpeechRecognitionManager | null>(null); // For background VAD
  const fullTranscriptRef = useRef<string>("");

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== "undefined" && SpeechRecognitionManager.isSupported()) {
      recognitionManager.current = new SpeechRecognitionManager();
      vadRecognitionManager.current = new SpeechRecognitionManager();
    }

    return () => {
      // Cleanup
      if (recognitionManager.current) {
        recognitionManager.current.stopListening();
      }
      if (vadRecognitionManager.current) {
        vadRecognitionManager.current.stopListening();
      }
      stopSpeech();
    };
  }, []);

  // Background VAD - always listening when audio is playing
  useEffect(() => {
    if (!vadRecognitionManager.current) return;

    if (isAudioPlaying && !isListening) {
      // Start background listening for interruption
      vadRecognitionManager.current.startListening(
        (result) => {
          // Any speech detected - interrupt!
          if (result.transcript.trim().length > 0) {
            console.log("VAD detected speech, interrupting AI voice");
            if (onVoiceInterrupt) {
              onVoiceInterrupt();
            }
            // Stop VAD and start main listening
            vadRecognitionManager.current?.stopListening();
            startListening();
          }
        },
        (error) => {
          console.error("VAD error:", error);
        }
      );
    } else {
      // Stop background listening
      vadRecognitionManager.current.stopListening();
    }

    return () => {
      vadRecognitionManager.current?.stopListening();
    };
  }, [isAudioPlaying, isListening]);

  /**
   * Start listening for speech input
   */
  const startListening = () => {
    if (!recognitionManager.current) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    // Stop VAD if running
    if (vadRecognitionManager.current) {
      vadRecognitionManager.current.stopListening();
    }

    // CRITICAL: Stop any playing voice FIRST
    stopSpeech(); // Stop Web Speech
    window.speechSynthesis.cancel(); // Extra safety
    setIsSpeaking(false);

    setError(null);
    setTranscript("");
    fullTranscriptRef.current = "";

    recognitionManager.current.startListening(
      (result) => {
        // Accumulate final results
        if (result.isFinal) {
          fullTranscriptRef.current += " " + result.transcript;
          const finalText = fullTranscriptRef.current.trim();
          setTranscript(finalText);
          // Send final transcript to parent
          if (onTranscript) {
            onTranscript(finalText, true);
          }
        } else {
          // Show interim results
          const interimText = (fullTranscriptRef.current + " " + result.transcript).trim();
          setTranscript(interimText);
          // Send interim transcript to parent for real-time display
          if (onTranscript) {
            onTranscript(interimText, false);
          }
        }
      },
      (error) => {
        setError(error);
        setIsListening(false);
        if (onListeningChange) {
          onListeningChange(false);
        }
      }
    );

    setIsListening(true);
    if (onListeningChange) {
      onListeningChange(true);
    }
  };

  /**
   * Stop listening
   */
  const stopListening = () => {
    if (recognitionManager.current) {
      recognitionManager.current.stopListening();
    }
    setIsListening(false);
    if (onListeningChange) {
      onListeningChange(false);
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    restartListening: () => {
      console.log("🎤 Restarting listening, current state:", isListening);
      // Force stop first, then start
      if (isListening) {
        stopListening();
        // Wait a bit before restarting
        setTimeout(() => {
          startListening();
        }, 100);
      } else {
        startListening();
      }
    }
  }));

  /**
   * Speak text using voice synthesis
   */
  const speakText = async (text: string) => {
    if (!text) return;

    setIsSpeaking(true);
    setError(null);

    try {
      // Check if user has forced Web Speech mode
      const forceWebSpeech = propVoiceService === "web-speech";
      
      if (forceWebSpeech) {
        console.log("🎤 Voice service set to Web Speech Only, skipping ElevenLabs");
        // Skip ElevenLabs and go straight to Web Speech
        setVoiceService("web-speech");
        
        // Get the selected voice or best voice
        let voice: SpeechSynthesisVoice | null = null;
        if (selectedVoiceName) {
          // Find voice by name
          const voices = window.speechSynthesis.getVoices();
          console.log("🎤 Looking for voice:", selectedVoiceName);
          console.log("🎤 Available voices:", voices.map(v => v.name));
          
          // Try exact match first
          voice = voices.find(v => v.name === selectedVoiceName) || null;
          
          // If not found, try partial match
          if (!voice) {
            voice = voices.find(v => v.name.includes(selectedVoiceName) || selectedVoiceName.includes(v.name)) || null;
          }
          
          console.log("🎤 Using selected voice:", selectedVoiceName, voice ? `✓ Found: ${voice.name}` : "✗ not found");
        }
        
        if (!voice) {
          voice = await getBestVoice("en-US");
          console.log("🎤 Using best voice (fallback):", voice?.name);
        }
        
        await synthesizeSpeechWebSpeech(text, {
          voice: voice || undefined,
          rate: propVoiceSpeed || 1.0,
          pitch: propVoicePitch || 1.0,
          volume: volume,
        });
        
        setIsSpeaking(false);
        
        // Auto-restart listening after voice finishes
        setTimeout(() => {
          if (!isListening) {
            startListening();
          }
        }, 500);
        
        return;
      }
      
      // Try server-side synthesis first (ElevenLabs)
      const response = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const service = response.headers.get("X-Voice-Service");
      setVoiceService(service as "elevenlabs" | "web-speech");

      if (response.ok && service === "elevenlabs") {
        // Play ElevenLabs audio
        const audioData = await response.arrayBuffer();
        const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setError("Failed to play audio");
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        // Use Web Speech API (client-side)
        setVoiceService("web-speech");
        
        // Get the selected voice or best voice
        let voice: SpeechSynthesisVoice | null = null;
        if (selectedVoiceName) {
          // Find voice by name
          const voices = window.speechSynthesis.getVoices();
          console.log("🎤 Looking for voice:", selectedVoiceName);
          console.log("🎤 Available voices:", voices.map(v => v.name));
          
          // Try exact match first
          voice = voices.find(v => v.name === selectedVoiceName) || null;
          
          // If not found, try partial match
          if (!voice) {
            voice = voices.find(v => v.name.includes(selectedVoiceName) || selectedVoiceName.includes(v.name)) || null;
          }
          
          console.log("🎤 Using selected voice:", selectedVoiceName, voice ? `✓ Found: ${voice.name}` : "✗ not found");
        }
        
        if (!voice) {
          voice = await getBestVoice("en-US");
          console.log("🎤 Using best voice (fallback):", voice?.name);
        }
        
        await synthesizeSpeechWebSpeech(text, {
          voice: voice || undefined,
          rate: propVoiceSpeed || 1.0,
          pitch: propVoicePitch || 1.0,
          volume: volume,
        });
        
        setIsSpeaking(false);
        
        // Auto-restart listening after voice finishes
        setTimeout(() => {
          if (!isListening) {
            startListening();
          }
        }, 500);
      }
    } catch (error) {
      console.error("Speech synthesis error:", error);
      setError(error instanceof Error ? error.message : "Speech synthesis failed");
      setIsSpeaking(false);
    }
  };

  /**
   * Stop speaking
   */
  const stopSpeaking = () => {
    stopSpeech();
    setIsSpeaking(false);
  };

  // Auto-speak when onSpeakText prop changes
  useEffect(() => {
    if (onSpeakText) {
      // This would be triggered by parent component
    }
  }, [onSpeakText]);

  return (
    <div className="flex items-center gap-2">
      {/* Microphone Button */}
      <button
        onClick={() => {
          // If audio is playing (from parent) or speaking (local), stop and listen
          if (isAudioPlaying || isSpeaking) {
            stopSpeaking();
            // Notify parent to stop audio
            if (onListeningChange) {
              onListeningChange(true); // This will trigger parent to stop audio
            }
            setTimeout(() => startListening(), 100); // Small delay to ensure voice stops
          } else if (isListening) {
            stopListening();
          } else {
            startListening();
          }
        }}
        disabled={disabled}
        className={`p-3 rounded-full transition-all ${
          isListening
            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
            : (isAudioPlaying || isSpeaking)
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-purple-500 hover:bg-purple-600 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={(isAudioPlaying || isSpeaking) ? "Stop voice & listen" : isListening ? "Stop listening" : "Start listening"}
      >
        {isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Volume Control */}
      <div className="relative">
        <button
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          disabled={disabled}
          className={`p-3 rounded-full transition-all ${
            volume > 0
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-400 hover:bg-gray-500 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={`Volume: ${Math.round(volume * 100)}%`}
        >
          {isSpeaking ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : volume > 0 ? (
            <Volume2 className="w-5 h-5" />
          ) : (
            <VolumeX className="w-5 h-5" />
          )}
        </button>

        {/* Volume Slider */}
        {showVolumeSlider && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                if (onVolumeChange) {
                  onVolumeChange(newVolume);
                }
              }}
              className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="text-xs text-center mt-1 text-gray-600 dark:text-gray-400">
              {Math.round(volume * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Status Indicators */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        {isListening && (
          <div className="text-xs text-red-500 font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Listening...
          </div>
        )}
        
        {isSpeaking && voiceService && (
          <div className="text-xs text-blue-500 font-medium flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            {voiceService === "elevenlabs" ? "ElevenLabs" : "Web Speech"}
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 truncate max-w-[200px]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
});
