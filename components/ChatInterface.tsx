"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, Download, Zap } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { VoiceControls } from "./VoiceControls";
import { ExportModal } from "./ExportModal";
import { Message } from "@/types/conversation";
import { Agent } from "@/types/agent";
import { generateSessionId } from "@/lib/utils/formatters";

interface ChatInterfaceProps {
  sessionId?: string;
  onAgentCreated?: (agent: Agent) => void;
}

export function ChatInterface({ sessionId: initialSessionId, onAgentCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(initialSessionId || generateSessionId());
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [agentSuggestion, setAgentSuggestion] = useState<{topic: string; reasoning: string} | null>(null);
  const [skillSuggestion, setSkillSuggestion] = useState<{agentId: string; agentName: string; skillName: string; reasoning: string} | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null); // Store question waiting for agent
  
  // Debug: Log when agentSuggestion changes
  useEffect(() => {
    if (agentSuggestion) {
      console.log("🎯 Agent suggestion state updated:", agentSuggestion);
    }
  }, [agentSuggestion]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(1.0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<{name: string; description: string} | null>(null);
  
  // Voice settings from user preferences
  const [voiceSpeed, setVoiceSpeed] = useState(1.15);
  const [voicePitch, setVoicePitch] = useState(1.15);
  const [autoSendDelay, setAutoSendDelay] = useState(2.0);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [voiceService, setVoiceService] = useState<"elevenlabs" | "web-speech" | "auto">("auto");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceControlsRef = useRef<any>(null);

  // Load voice settings from user preferences
  useEffect(() => {
    const loadVoiceSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.voice) {
            setVoiceSpeed(data.voice.speed || 1.15);
            setVoicePitch(data.voice.pitch || 1.15);
            setAutoSendDelay(data.voice.autoSendDelay || 2.0);
            setSelectedVoiceName(data.voice.selectedVoice || "");
            setVoiceService(data.voice.voiceService || "auto");
            console.log("🎤 Loaded voice settings:", {
              speed: data.voice.speed,
              pitch: data.voice.pitch,
              selectedVoice: data.voice.selectedVoice,
              voiceService: data.voice.voiceService
            });
          }
        }
      } catch (error) {
        console.error("Failed to load voice settings:", error);
      }
    };
    
    loadVoiceSettings();
    
    // Listen for settings updates
    const handleSettingsUpdate = () => {
      console.log("🔄 Settings updated, reloading voice settings...");
      loadVoiceSettings();
    };
    
    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    
    return () => {
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Function to send a message (can be called programmatically)
  const sendMessage = async (messageText: string, skipAgentMatching: boolean = false) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: messageText.trim(),
      agentUsed: null,
      timestamp: new Date(),
      voiceEnabled,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Add a placeholder assistant message for streaming
    const assistantMessageIndex = messages.length + 1;
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      agentUsed: null,
      timestamp: new Date(),
      voiceEnabled,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Call the chat API with streaming
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId: sessionId,
          voiceEnabled,
          stream: true,
          skipAgentMatching, // Flag to bypass agent matching
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let agentCreatedData: any = null;

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "content") {
                fullResponse += data.text;
                // Update the assistant message in real-time
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    ...newMessages[assistantMessageIndex],
                    content: fullResponse,
                  };
                  return newMessages;
                });
              } else if (data.type === "agent_suggestion") {
                // Show agent suggestion dialog and store the question
                console.log("📨 Received agent suggestion:", data.suggestion);
                setAgentSuggestion(data.suggestion);
                setPendingQuestion(messageText); // Store the original question
              } else if (data.type === "skill_suggestion") {
                // Show skill suggestion dialog and store the question
                console.log("🎓 Received skill suggestion:", data.suggestion);
                setSkillSuggestion(data.suggestion);
                setPendingQuestion(messageText); // Store the original question
              } else if (data.type === "waiting_for_decision") {
                // Stop loading - waiting for user to decide on agent creation
                console.log("⏸️ Waiting for user decision on agent creation");
                setIsLoading(false);
                // Remove the empty assistant message
                setMessages((prev) => {
                  if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === "") {
                    return prev.slice(0, -1);
                  }
                  return prev;
                });
              } else if (data.type === "agent_used") {
                // Display which agent is handling the request
                setCurrentAgent({
                  name: data.agent.name,
                  description: data.agent.description
                });
                console.log("🤖 Agent in use:", data.agent.name);
                
                // Update the assistant message with agent name
                setMessages((prev) => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                    updated[updated.length - 1].agentName = data.agent.name;
                    updated[updated.length - 1].agentUsed = data.agent.id;
                  }
                  return updated;
                });
              } else if (data.type === "agent_created") {
                agentCreatedData = data.agent;
                
                // Update the assistant message with agent name
                setMessages((prev) => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                    updated[updated.length - 1].agentName = data.agent.name;
                    updated[updated.length - 1].agentUsed = data.agent.id;
                  }
                  return updated;
                });
                
                // Notify parent about new agent
                if (onAgentCreated) {
                  // We'll need to fetch the full agent data
                  const agentResponse = await fetch(`/api/agents?id=${data.agent.id}`);
                  if (agentResponse.ok) {
                    const agentData = await agentResponse.json();
                    onAgentCreated(agentData.agent);
                  }
                }
              } else if (data.type === "done") {
                // Streaming complete
                console.log("Streaming complete. Usage:", data.usage);
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      // If voice is enabled, speak the response
      // BUT: Don't read agent creation details (system info, not conversational)
      const isAgentCreationResponse = fullResponse.includes("FINANCIAL ADVISOR AGENT PROFILE") || 
                                       fullResponse.includes("AGENT PROFILE") ||
                                       fullResponse.includes("CORE CAPABILITIES:") ||
                                       agentCreatedData !== null;
      
      console.log("Voice check:", { 
        voiceEnabled, 
        hasResponse: !!fullResponse, 
        responseLength: fullResponse.length,
        isAgentCreation: isAgentCreationResponse 
      });
      
      if (voiceEnabled && fullResponse && fullResponse.trim().length > 0 && !isAgentCreationResponse) {
        console.log("Starting voice synthesis for:", fullResponse.substring(0, 50) + "...");
        try {
          // Try ElevenLabs first (server-side)
          const voiceResponse = await fetch("/api/voice/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: fullResponse }),
          });

          if (voiceResponse.ok) {
            const service = voiceResponse.headers.get("X-Voice-Service");
            console.log("Voice service used:", service);
            
            if (service === "elevenlabs") {
              // Play ElevenLabs audio
              const audioData = await voiceResponse.arrayBuffer();
              const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              
              const audio = new Audio(audioUrl);
              audio.volume = 1.0;
              currentAudioRef.current = audio;
              setIsAudioPlaying(true);
              
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                setIsAudioPlaying(false);
              };
              audio.onerror = () => {
                console.error("Audio playback error, falling back to Web Speech");
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                setIsAudioPlaying(false);
                // Fallback to Web Speech
                speakWithWebSpeech(fullResponse);
              };
              
              await audio.play();
            } else {
              // Server returned Web Speech, use it client-side
              speakWithWebSpeech(fullResponse);
            }
          } else {
            // API failed, fallback to Web Speech
            speakWithWebSpeech(fullResponse);
          }
        } catch (voiceError) {
          console.error("Voice synthesis error:", voiceError);
          // Fallback to Web Speech on any error
          speakWithWebSpeech(fullResponse);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        agentUsed: null,
        timestamp: new Date(),
        voiceEnabled: false,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      
      // Don't restart listening here - let the voice finish speaking first
      // The mic will auto-restart after voice ends (handled in VoiceControls)
      if (!voiceEnabled) {
        inputRef.current?.focus();
      }
    }
  };

  // Wrapper function for sending from input field
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const messageText = input.trim();
    setInput("");
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
    }
    
    await sendMessage(messageText);
  };

  // Clean text for voice synthesis - remove special characters
  const cleanTextForVoice = (text: string): string => {
    return text
      // Remove markdown-style formatting
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '')   // Remove italic markers
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/`{1,3}/g, '') // Remove code blocks
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to just text
      // Remove special symbols that sound weird
      .replace(/[•◦▪▫]/g, '') // Remove bullet points
      .replace(/[→←↑↓]/g, '') // Remove arrows
      .replace(/[✓✗✕✖]/g, '') // Remove checkmarks
      .replace(/[™®©]/g, '') // Remove trademark symbols
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper function for Web Speech synthesis
  const speakWithWebSpeech = (text: string) => {
    try {
      // Clean the text before speaking
      const cleanedText = cleanTextForVoice(text);
      
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      
      // Use user's voice settings from preferences
      utterance.rate = voiceSpeed;
      utterance.pitch = voicePitch;
      utterance.volume = currentVolume;
      
      console.log("🎤 Voice settings applied:", {
        speed: voiceSpeed,
        pitch: voicePitch,
        volume: currentVolume
      });
      
      setIsAudioPlaying(true);
      
      utterance.onend = () => {
        setIsAudioPlaying(false);
      };
      
      utterance.onerror = () => {
        setIsAudioPlaying(false);
      };
      
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Try to use user's selected voice first
      let selectedVoice: SpeechSynthesisVoice | null = null;
      
      if (selectedVoiceName) {
        console.log("🎤 Looking for selected voice:", selectedVoiceName);
        // Try exact match
        selectedVoice = voices.find(v => v.name === selectedVoiceName) || null;
        
        // Try partial match
        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            v.name.includes(selectedVoiceName) || selectedVoiceName.includes(v.name)
          ) || null;
        }
        
        if (selectedVoice) {
          console.log("✓ Using selected voice:", selectedVoice.name, "| Lang:", selectedVoice.lang);
        } else {
          console.warn("⚠️ Selected voice not found:", selectedVoiceName);
        }
      }
      
      // Fallback to best quality voice if no selection or not found
      const bestVoice = selectedVoice || 
        // 1. Google voices (highest quality)
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en-US')) ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        
        // 2. Microsoft natural voices
        voices.find(v => v.name.includes('Natural') && v.lang.startsWith('en')) ||
        voices.find(v => (v.name.includes('Aria') || v.name.includes('Jenny')) && v.lang.startsWith('en')) ||
        
        // 3. Premium voices
        voices.find(v => (v.name.includes('Premium') || v.name.includes('Enhanced')) && v.lang.startsWith('en')) ||
        
        // 4. Any female voice (generally less robotic)
        voices.find(v => v.name.includes('Female') && v.lang.startsWith('en')) ||
        
        // 5. Fallback to any English voice
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices.find(v => v.lang.startsWith('en'));
      
      if (bestVoice) {
        if (!selectedVoice) {
          console.log("Using fallback voice:", bestVoice.name, "| Lang:", bestVoice.lang);
        }
        utterance.voice = bestVoice;
      } else {
        console.warn("No suitable voice found, using default");
      }
      
      // Log final utterance properties before speaking
      console.log("🎤 Final utterance properties:", {
        voice: utterance.voice?.name,
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume,
        lang: utterance.lang
      });
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Web Speech error:", error);
      setIsAudioPlaying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      // If listening, stop it first
      if (isListening) {
        setIsListening(false);
      }
      
      handleSend();
    }
  };

  const voiceSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVoiceTranscript = (transcript: string, isFinal: boolean = false) => {
    // If AI is speaking, interrupt it
    if (isAudioPlaying && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    // Only update input if we're still in interim mode
    // Don't update after final to avoid showing old text
    if (!isFinal) {
      setInput(transcript);
    }
    
    // If final, wait before auto-sending (gives user time to continue)
    if (isFinal && transcript.trim()) {
      // Clear input immediately when final
      setInput("");
      setIsListening(false);
      
      // Clear any existing timeout
      if (voiceSendTimeoutRef.current) {
        clearTimeout(voiceSendTimeoutRef.current);
      }
      
      // Wait before sending (use user's delay setting)
      voiceSendTimeoutRef.current = setTimeout(() => {
        // Send with the transcript value
        const userMessage: Message = {
          role: "user",
          content: transcript.trim(),
          agentUsed: null,
          timestamp: new Date(),
          voiceEnabled,
        };

        setMessages((prev) => [...prev, userMessage]);
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = '48px';
        }
        
        setIsLoading(true);

        // Add placeholder for AI response
        const assistantMessageIndex = messages.length + 1;
        const assistantMessage: Message = {
          role: "assistant",
          content: "",
          agentUsed: null,
          timestamp: new Date(),
          voiceEnabled,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Call the API
        sendVoiceMessage(transcript.trim(), assistantMessageIndex);
      }, autoSendDelay * 1000); // Use user's delay setting (convert to ms)
    }
  };

  const sendVoiceMessage = async (messageText: string, assistantMessageIndex: number) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId: sessionId,
          voiceEnabled,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let agentCreatedData: any = null;

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "content") {
                fullResponse += data.text;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    ...newMessages[assistantMessageIndex],
                    content: fullResponse,
                  };
                  return newMessages;
                });
              } else if (data.type === "agent_created") {
                agentCreatedData = data.agent;
                if (onAgentCreated) {
                  const agentResponse = await fetch(`/api/agents?id=${data.agent.id}`);
                  if (agentResponse.ok) {
                    const agentData = await agentResponse.json();
                    onAgentCreated(agentData.agent);
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      // Voice synthesis
      const isAgentCreationResponse = fullResponse.includes("AGENT PROFILE") || agentCreatedData !== null;

      if (voiceEnabled && fullResponse && fullResponse.trim().length > 0 && !isAgentCreationResponse) {
        try {
          const voiceResponse = await fetch("/api/voice/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: fullResponse }),
          });

          if (voiceResponse.ok) {
            const service = voiceResponse.headers.get("X-Voice-Service");
            console.log("Voice service used:", service);
            
            if (service === "elevenlabs") {
              const audioData = await voiceResponse.arrayBuffer();
              const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              
              const audio = new Audio(audioUrl);
              audio.volume = 1.0;
              currentAudioRef.current = audio;
              setIsAudioPlaying(true);
              
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                setIsAudioPlaying(false);
              };
              audio.onerror = () => {
                console.error("Audio playback error, falling back to Web Speech");
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                setIsAudioPlaying(false);
                speakWithWebSpeech(fullResponse);
              };
              
              await audio.play();
            } else {
              speakWithWebSpeech(fullResponse);
            }
          } else {
            console.log("ElevenLabs unavailable, using Web Speech fallback");
            speakWithWebSpeech(fullResponse);
          }
        } catch (voiceError) {
          console.log("Voice API unavailable, using Web Speech fallback:", voiceError instanceof Error ? voiceError.message : String(voiceError));
          speakWithWebSpeech(fullResponse);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        agentUsed: null,
        timestamp: new Date(),
        voiceEnabled: false,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      
      // Clear input
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = '48px';
      }
      
      // Don't restart listening here - let the voice finish speaking first
      if (!voiceEnabled) {
        inputRef.current?.focus();
      }
    }
  };

  const handleVoiceStateChange = (listening: boolean) => {
    setIsListening(listening);
    
    // If starting to listen, stop any playing audio and clear input
    if (listening) {
      window.speechSynthesis.cancel();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsAudioPlaying(false);
      
      // Clear input for fresh voice command
      setInput("");
    }
  };

  const handleVolumeChange = (volume: number) => {
    setCurrentVolume(volume);
  };

  const handleVoiceInterrupt = () => {
    // User started speaking - stop AI voice immediately
    console.log("Voice interrupted by user speech");
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsAudioPlaying(false);
  };

  const handleCreateSkill = async () => {
    if (!skillSuggestion) return;
    
    setIsCreatingSkill(true);
    try {
      // Step 1: Generate AI skill content
      console.log("🤖 Generating AI skill content...");
      const contentResponse = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_content",
          agentId: skillSuggestion.agentId,
          skillName: skillSuggestion.skillName,
          skillDescription: skillSuggestion.reasoning,
        }),
      });

      if (!contentResponse.ok) {
        throw new Error("Failed to generate skill content");
      }

      const { content } = await contentResponse.json();
      console.log("✅ AI skill content generated");

      // Generate relevant tags from skill name
      const generateTags = (skillName: string): string[] => {
        const words = skillName.toLowerCase().split(/[\s-&]+/);
        const relevantWords = words.filter(w => 
          w.length > 3 && 
          !['analysis', 'expert', 'specialist', 'the', 'and', 'for'].includes(w)
        );
        return relevantWords.slice(0, 5);
      };

      // Determine category from skill name
      const determineCategory = (skillName: string): string => {
        const name = skillName.toLowerCase();
        if (name.includes('weather') || name.includes('climate') || name.includes('meteorolog')) return 'weather';
        if (name.includes('stock') || name.includes('trading') || name.includes('finance')) return 'finance';
        if (name.includes('data') || name.includes('analytics') || name.includes('tableau')) return 'analytics';
        if (name.includes('fish') || name.includes('angling')) return 'outdoor';
        if (name.includes('real estate') || name.includes('property')) return 'real-estate';
        return 'custom';
      };

      // Step 2: Create the skill with AI-generated content
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: skillSuggestion.agentId,
          name: skillSuggestion.skillName,
          description: skillSuggestion.reasoning,
          skillContent: content, // Use AI-generated content
          version: "1.0.0",
          metadata: {
            tags: generateTags(skillSuggestion.skillName),
            category: determineCategory(skillSuggestion.skillName),
            dependencies: [],
            author: "AI Generated",
          },
        }),
      });

      if (response.ok) {
        console.log("✅ Skill created successfully");
        setSkillSuggestion(null);
        
        // Re-send the pending question with the enhanced agent
        if (pendingQuestion) {
          console.log("🔄 Re-sending question with enhanced agent:", pendingQuestion);
          const questionToSend = pendingQuestion;
          setPendingQuestion(null);
          
          // Wait a moment for skill to be fully loaded, then send
          setTimeout(() => {
            sendMessage(questionToSend);
          }, 500);
        }
      } else {
        console.error("Failed to create skill");
      }
    } catch (error) {
      console.error("Error creating skill:", error);
    } finally {
      setIsCreatingSkill(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentSuggestion) return;
    
    setIsCreatingAgent(true);
    try {
      const response = await fetch("/api/agents/create-suggested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: agentSuggestion.topic }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onAgentCreated) {
          onAgentCreated(data.agent);
        }
        setAgentSuggestion(null);
        
        // Re-send the pending question with the new agent
        if (pendingQuestion) {
          console.log("🔄 Re-sending question with new agent:", pendingQuestion);
          const questionToSend = pendingQuestion;
          setPendingQuestion(null);
          
          // Wait a moment for agent to be fully loaded, then send
          setTimeout(() => {
            sendMessage(questionToSend);
          }, 500);
        }
      } else {
        console.error("Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Assistant
              </h2>
              {currentAgent ? (
                <p className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                  Using: <span className="font-medium">{currentAgent.name}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ask me anything
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button */}
            {messages.length > 0 && (
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Export conversation"
              >
                <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}

            {/* Voice Toggle */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                voiceEnabled
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {voiceEnabled ? "Voice On" : "Voice Off"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Start a Conversation
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Ask me anything! I can help with various topics, or you can create specialized agents for specific domains.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              <button
                onClick={() => setInput("What can you help me with?")}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  What can you help me with?
                </p>
              </button>
              <button
                onClick={() => setInput("Create a financial advisor agent")}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Create a financial advisor agent
                </p>
              </button>
              <button
                onClick={() => setInput("How do I invest for retirement?")}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  How do I invest for retirement?
                </p>
              </button>
              <button
                onClick={() => setInput("Tell me about AI agents")}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Tell me about AI agents
                </p>
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble 
                key={index} 
                message={message}
                agentName={message.agentName}
              />
            ))}
            {isLoading && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
                <div className="flex flex-col items-start max-w-[70%]">
                  <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-end gap-3">
          {/* Voice Controls */}
          {voiceEnabled && (
            <VoiceControls
              ref={voiceControlsRef}
              onTranscript={handleVoiceTranscript}
              onListeningChange={handleVoiceStateChange}
              onVolumeChange={handleVolumeChange}
              onVoiceInterrupt={handleVoiceInterrupt}
              volume={currentVolume}
              isAudioPlaying={isAudioPlaying}
              disabled={isLoading}
              voiceSpeed={voiceSpeed}
              voicePitch={voicePitch}
              selectedVoiceName={selectedVoiceName}
              voiceService={voiceService}
            />
          )}

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{
                minHeight: "48px",
                maxHeight: "120px",
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        messages={messages}
        conversationTitle="AI Conversation"
      />

      {/* Agent Suggestion Dialog */}
      {agentSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-bounce-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Create Specialized Agent?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  I can create a <span className="font-semibold text-purple-600 dark:text-purple-400">{agentSuggestion.topic}</span> agent to better help with these types of questions.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  {agentSuggestion.reasoning}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  console.log("❌ User declined agent creation - using generic assistant");
                  setAgentSuggestion(null);
                  
                  // Re-send question with skipAgentMatching flag to use generic assistant
                  if (pendingQuestion) {
                    const questionToSend = pendingQuestion;
                    setPendingQuestion(null);
                    setTimeout(() => {
                      sendMessage(questionToSend, true); // true = skip agent matching
                    }, 100);
                  }
                }}
                disabled={isCreatingAgent}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Not Now
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={isCreatingAgent}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingAgent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Suggestion Dialog */}
      {skillSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-bounce-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Add New Skill?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">{skillSuggestion.agentName}</span> can learn <span className="font-semibold text-pink-600 dark:text-pink-400">{skillSuggestion.skillName}</span> to better answer these questions.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  {skillSuggestion.reasoning}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  console.log("❌ User declined skill addition - continuing without skill");
                  setSkillSuggestion(null);
                  
                  // Re-send question with skipAgentMatching flag (agent will respond without new skill)
                  if (pendingQuestion) {
                    const questionToSend = pendingQuestion;
                    setPendingQuestion(null);
                    setTimeout(() => {
                      sendMessage(questionToSend, true); // true = skip agent matching (use current agent)
                    }, 100);
                  }
                }}
                disabled={isCreatingSkill}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Not Now
              </button>
              <button
                onClick={handleCreateSkill}
                disabled={isCreatingSkill}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingSkill ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Add Skill
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Creation Loading Overlay */}
      {isCreatingAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Creating Agent...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generating specialized agent with expertise and capabilities
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Creation Loading Overlay */}
      {isCreatingSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Generating Skill Content...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is creating detailed content for this skill
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  This may take 15-30 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
