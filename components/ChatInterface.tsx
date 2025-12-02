"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, Download, Zap, Paperclip, X } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { VoiceControls } from "./VoiceControls";
import { ExportModal } from "./ExportModal";
import { ArtifactViewer } from "./ArtifactViewer";
import { ConversationList } from "./ConversationList";
import { Message } from "@/types/conversation";
import { Agent } from "@/types/agent";
import { generateSessionId } from "@/lib/utils/formatters";
import type { Artifact } from "@/lib/artifacts/artifactDetector";
import { getSupportedFileTypes } from "@/lib/files/fileProcessor";

interface ChatInterfaceProps {
  sessionId?: string;
  onAgentCreated?: (agent: Agent) => void;
}

export function ChatInterface({ sessionId: initialSessionId, onAgentCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId || generateSessionId());
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [agentSuggestion, setAgentSuggestion] = useState<{topic: string; reasoning: string} | null>(null);
  const [skillSuggestion, setSkillSuggestion] = useState<{agentId: string; agentName: string; skillName: string; reasoning: string} | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null); // Store question waiting for agent
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // Store files waiting for agent/skill
  
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
  
  // File upload and artifacts
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Load conversation when sessionId changes
  const loadConversation = async (convId: string) => {
    setIsLoadingConversation(true);
    try {
      const response = await fetch(`/api/conversations/${convId}`);
      if (response.ok) {
        const conversation = await response.json();
        console.log(`📚 Loaded conversation with ${conversation.messages.length} messages`);
        setMessages(conversation.messages);
        setSessionId(convId);
        
        // Extract agent info from the conversation messages
        const assistantMessage = conversation.messages.find((m: Message) => m.role === "assistant" && m.agentName);
        if (assistantMessage && assistantMessage.agentName) {
          setCurrentAgent({
            name: assistantMessage.agentName,
            description: "" // We don't have description in messages, but name is enough
          });
          console.log(`🤖 Loaded agent: ${assistantMessage.agentName}`);
        } else {
          setCurrentAgent(null);
        }
      } else {
        console.error("Failed to load conversation");
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    const newSessionId = generateSessionId();
    console.log("🆕 Starting new conversation:", newSessionId);
    setMessages([]);
    setSessionId(newSessionId);
    setInput("");
    setAttachedFiles([]);
    setAgentSuggestion(null);
    setSkillSuggestion(null);
    setCurrentAgent(null);
    setPendingQuestion(null);
    setPendingFiles([]);
    inputRef.current?.focus();
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
      console.log(`📎 Attached ${files.length} file(s):`, files.map(f => f.name));
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Handle clipboard paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setAttachedFiles(prev => [...prev, file]);
          console.log(`📋 Pasted image: ${file.name || 'clipboard-image.png'}`);
        }
      }
    }
  };

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

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      agentUsed: null,
      timestamp: new Date(),
      voiceEnabled,
    };

    // Add both user and assistant messages in a single state update to ensure correct indexing
    // This prevents race conditions when multiple messages are sent quickly
    let assistantMessageIndex = -1;
    setMessages((prev) => {
      assistantMessageIndex = prev.length + 1; // User at prev.length, assistant at prev.length + 1
      console.log(`📍 Adding user message at index ${prev.length} and assistant at index ${assistantMessageIndex}`);
      return [...prev, userMessage, assistantMessage];
    });
    
    setIsLoading(true);

    try {
      // Prepare request body (FormData if files attached, JSON otherwise)
      let requestBody: FormData | string;
      let requestHeaders: HeadersInit = {};
      
      if (attachedFiles.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('message', messageText);
        formData.append('conversationId', sessionId);
        formData.append('voiceEnabled', voiceEnabled.toString());
        formData.append('stream', 'true');
        formData.append('skipAgentMatching', skipAgentMatching.toString());
        
        // Append all files
        attachedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        requestBody = formData;
        // Don't set Content-Type header - browser will set it with boundary
      } else {
        // Use JSON for regular messages
        requestHeaders = { "Content-Type": "application/json" };
        requestBody = JSON.stringify({
          message: messageText,
          conversationId: sessionId,
          voiceEnabled,
          stream: true,
          skipAgentMatching,
        });
      }
      
      // Call the chat API with streaming
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });
      
      // Clear attached files after sending
      setAttachedFiles([]);

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({ error: "Authentication required" }));
          throw new Error(`Authentication required: ${errorData.error || 'Please log in again'}`);
        }
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
                  // Only log every 50th update to reduce console spam
                  if (fullResponse.length % 50 === 0) {
                    console.log(`📝 Updating message at index ${assistantMessageIndex}, length: ${fullResponse.length}`);
                  }
                  const newMessages = [...prev];
                  if (assistantMessageIndex >= 0 && assistantMessageIndex < prev.length) {
                    // Verify this is still an assistant message (safety check)
                    if (newMessages[assistantMessageIndex].role === "assistant") {
                      newMessages[assistantMessageIndex] = {
                        ...newMessages[assistantMessageIndex],
                        content: fullResponse,
                      };
                    } else {
                      console.error(`❌ Index ${assistantMessageIndex} is not an assistant message!`);
                    }
                  } else {
                    console.error(`❌ Invalid index ${assistantMessageIndex} for array length ${prev.length}`);
                  }
                  return newMessages;
                });
              } else if (data.type === "agent_suggestion") {
                // Show agent suggestion dialog and store the question
                console.log("📨 Received agent suggestion:", data.suggestion);
                setAgentSuggestion(data.suggestion);
                setPendingQuestion(messageText); // Store the original question
                setPendingFiles([...attachedFiles]); // Store the attached files
              } else if (data.type === "skill_suggestion") {
                // Show skill suggestion dialog and store the question
                console.log("🎓 Received skill suggestion:", data.suggestion);
                // Only set if not already showing a skill suggestion (prevent duplicates)
                setSkillSuggestion(prev => {
                  if (prev) {
                    console.log("⚠️ Skill suggestion already active, ignoring duplicate");
                    return prev;
                  }
                  return data.suggestion;
                });
                setPendingQuestion(messageText); // Store the original question
                setPendingFiles([...attachedFiles]); // Store the attached files
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
                
                // Fallback: If currentAgent wasn't set during streaming, try to get it from the last message
                setMessages((prev) => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.role === "assistant" && lastMessage.agentName) {
                    // Only set if currentAgent is not already set
                    setCurrentAgent((current) => {
                      if (!current || !current.name) {
                        console.log("🤖 Set agent from message data:", lastMessage.agentName);
                        return {
                          name: lastMessage.agentName || "",
                          description: ""
                        };
                      }
                      return current;
                    });
                  }
                  return prev;
                });
                
                // Check for artifacts in the response
                if (data.artifacts && data.artifacts.length > 0) {
                  console.log(`📦 Received ${data.artifacts.length} artifact(s)`);
                  setArtifacts(data.artifacts);
                  setShowArtifacts(true);
                }
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
      
      console.log("🎤 Voice synthesis check:", { 
        voiceEnabled, 
        hasResponse: !!fullResponse, 
        responseLength: fullResponse.length,
        isAgentCreation: isAgentCreationResponse,
        trimmedLength: fullResponse.trim().length
      });
      
      if (voiceEnabled && fullResponse && fullResponse.trim().length > 0 && !isAgentCreationResponse) {
        console.log("✅ Starting voice synthesis for:", fullResponse.substring(0, 50) + "...");
        console.log("📊 Full response length:", fullResponse.length);
        
        // Stop voice recognition before AI starts speaking to prevent feedback loop
        if (voiceControlsRef.current) {
          console.log("🎤 Stopping voice recognition before AI speaks");
          voiceControlsRef.current.stopListening();
        }
        
        // Use Web Speech API directly (no server call needed)
        try {
          speakWithWebSpeech(fullResponse);
        } catch (voiceError) {
          console.error("Voice synthesis error:", voiceError);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      // Check if it's an authentication error
      const isAuthError = error instanceof Error && error.message.includes("Authentication required");
      
      const errorMessage: Message = {
        role: "assistant",
        content: isAuthError 
          ? "Your session has expired. Please refresh the page and log in again to continue." 
          : "Sorry, I encountered an error. Please try again.",
        agentUsed: null,
        timestamp: new Date(),
        voiceEnabled: false,
      };

      setMessages((prev) => [...prev, errorMessage]);
      
      // If auth error, log for debugging
      if (isAuthError) {
        console.log("⚠️ Session expired - user needs to log in again");
      }
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
      // Remove URLs (http://, https://, www.)
      .replace(/https?:\/\/[^\s]+/g, '') // Remove http/https URLs
      .replace(/www\.[^\s]+/g, '') // Remove www URLs
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
        // Keep voice recognition stopped for 2 seconds after speech ends
        console.log("🎤 Speech ended, waiting 2s before allowing voice restart");
        setTimeout(() => {
          console.log("🎤 Voice recognition can now restart");
        }, 2000);
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
  const lastSentTranscriptRef = useRef<string>("");
  const lastSentTimeRef = useRef<number>(0);

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
      const trimmedTranscript = transcript.trim();
      const now = Date.now();
      
      // MOBILE FIX: Prevent duplicate sends
      // Skip if same transcript was sent within last 3 seconds
      if (trimmedTranscript === lastSentTranscriptRef.current && 
          now - lastSentTimeRef.current < 3000) {
        console.log("⚠️ Duplicate transcript detected, skipping:", trimmedTranscript);
        return;
      }
      
      // Clear input immediately when final
      setInput("");
      setIsListening(false);
      
      // Clear any existing timeout
      if (voiceSendTimeoutRef.current) {
        clearTimeout(voiceSendTimeoutRef.current);
      }
      
      // Wait before sending (use user's delay setting)
      voiceSendTimeoutRef.current = setTimeout(() => {
        // Double-check we haven't already sent this
        if (trimmedTranscript === lastSentTranscriptRef.current && 
            Date.now() - lastSentTimeRef.current < 3000) {
          console.log("⚠️ Duplicate transcript in timeout, skipping");
          return;
        }
        
        // Track what we're sending
        lastSentTranscriptRef.current = trimmedTranscript;
        lastSentTimeRef.current = Date.now();
        
        // Use the main sendMessage function to ensure all logic is consistent
        sendMessage(trimmedTranscript);
        
        // Clear the voice transcript after sending to prevent it from persisting
        if (voiceControlsRef.current) {
          voiceControlsRef.current.clearTranscript();
        }
      }, autoSendDelay * 1000); // Use user's delay setting (convert to ms)
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
        // BUT: Don't re-send if it was an explicit skill creation request (to prevent loops)
        console.log("📋 Pending question check:", {
          hasPendingQuestion: !!pendingQuestion,
          pendingQuestion,
        });
        
        if (pendingQuestion) {
          const isExplicitSkillRequest = (
            (pendingQuestion.toLowerCase().includes('add') || pendingQuestion.toLowerCase().includes('create')) &&
            (pendingQuestion.toLowerCase().includes('skill') || pendingQuestion.toLowerCase().includes('skills'))
          );
          
          console.log("🔍 Explicit skill request check:", {
            isExplicitSkillRequest,
            questionLower: pendingQuestion.toLowerCase(),
          });
          
          if (isExplicitSkillRequest) {
            console.log("⏭️ Skipping re-send of explicit skill request to prevent loop");
            setPendingQuestion(null);
            setPendingFiles([]);
          } else {
            console.log("🔄 Re-sending question with enhanced agent:", pendingQuestion);
            const questionToSend = pendingQuestion;
            const filesToSend = [...pendingFiles];
            setPendingQuestion(null);
            setPendingFiles([]);
            
            // Wait for skill to be fully loaded in database, then send
            // Increased timeout to ensure skill is available for matching
            setTimeout(() => {
              console.log("📤 Actually sending message now:", questionToSend);
              console.log("📎 Re-attaching files:", filesToSend.map(f => f.name));
              // Restore the files before sending
              setAttachedFiles(filesToSend);
              sendMessage(questionToSend);
            }, 1000);
          }
        } else {
          console.log("⚠️ No pending question to re-send");
          setPendingFiles([]); // Clear pending files if no question to send
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
        body: JSON.stringify({ 
          topic: agentSuggestion.topic,
          originalQuestion: pendingQuestion || "" // Send original question for context
        }),
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
          const filesToSend = [...pendingFiles];
          setPendingQuestion(null);
          setPendingFiles([]);
          
          // Wait a moment for agent to be fully loaded, then send
          setTimeout(() => {
            console.log("📎 Re-attaching files:", filesToSend.map(f => f.name));
            // Restore the files before sending
            setAttachedFiles(filesToSend);
            sendMessage(questionToSend);
          }, 500);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to create agent:", errorData);
        
        // Show error message to user
        const errorMessage: Message = {
          role: "assistant",
          content: response.status === 401 
            ? "⚠️ Your session has expired. Please refresh the page and log in again to create agents."
            : `⚠️ Failed to create agent: ${errorData.error || "Unknown error"}. Please try again.`,
          agentUsed: null,
          timestamp: new Date(),
          voiceEnabled: false,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setAgentSuggestion(null);
        setPendingQuestion(null);
        setPendingFiles([]);
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      
      // Show error message to user
      const errorMessage: Message = {
        role: "assistant",
        content: "⚠️ An unexpected error occurred while creating the agent. Please check your internet connection and try again.",
        agentUsed: null,
        timestamp: new Date(),
        voiceEnabled: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setAgentSuggestion(null);
      setPendingQuestion(null);
      setPendingFiles([]);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Conversation List Sidebar */}
      <ConversationList
        currentConversationId={sessionId}
        onSelectConversation={loadConversation}
        onNewConversation={startNewConversation}
      />
      
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Loading Overlay */}
        {isLoadingConversation && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading conversation...</p>
            </div>
          </div>
        )}
        
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

          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0 w-12 h-12 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center transition-colors disabled:cursor-not-allowed"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={getSupportedFileTypes().join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-sm"
                  >
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)}KB)
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder="Type your message... (Shift+Enter for new line, Ctrl+V to paste images)"
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
                    const filesToSend = [...pendingFiles];
                    setPendingQuestion(null);
                    setPendingFiles([]);
                    setTimeout(() => {
                      console.log("📎 Re-attaching files:", filesToSend.map(f => f.name));
                      setAttachedFiles(filesToSend);
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
                    const filesToSend = [...pendingFiles];
                    setPendingQuestion(null);
                    setPendingFiles([]);
                    setTimeout(() => {
                      console.log("📎 Re-attaching files:", filesToSend.map(f => f.name));
                      setAttachedFiles(filesToSend);
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Creating Agent...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI is generating specialized expertise and capabilities
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  This may take 10-20 seconds
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
      
      {/* Artifact Viewer */}
      {showArtifacts && artifacts.length > 0 && (
        <ArtifactViewer
          artifacts={artifacts}
          onClose={() => setShowArtifacts(false)}
        />
      )}
      </div>
    </div>
  );
}
