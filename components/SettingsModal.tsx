"use client";

import { useState, useEffect } from "react";
import { X, Key, Zap, Mic, Palette, Shield, DollarSign } from "lucide-react";
import { waitForVoices } from "@/lib/voice/webSpeech";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"api" | "voice" | "ai" | "display" | "limits">("api");
  
  // API Keys state
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");
  const [hasExistingAnthropicKey, setHasExistingAnthropicKey] = useState(false);
  const [hasExistingElevenLabsKey, setHasExistingElevenLabsKey] = useState(false);
  const [hasExistingVoiceId, setHasExistingVoiceId] = useState(false);
  const [removeAnthropicKey, setRemoveAnthropicKey] = useState(false);
  const [removeElevenLabsKey, setRemoveElevenLabsKey] = useState(false);
  const [removeVoiceId, setRemoveVoiceId] = useState(false);
  
  // Usage Limits state
  const [enableLimits, setEnableLimits] = useState(false);
  const [maxTokensPerUser, setMaxTokensPerUser] = useState(10000);
  const [maxRequestsPerHour, setMaxRequestsPerHour] = useState(20);
  const [maxCostPerUser, setMaxCostPerUser] = useState(5.0);
  const [requireAuth, setRequireAuth] = useState(true);
  
  // Voice Settings state
  const [voiceSpeed, setVoiceSpeed] = useState(1.15);
  const [voicePitch, setVoicePitch] = useState(1.15);
  const [autoSendDelay, setAutoSendDelay] = useState(1.5);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [voiceService, setVoiceService] = useState<"elevenlabs" | "web-speech" | "auto">("auto");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [autoRestartMic, setAutoRestartMic] = useState(true);
  const [voiceInterruption, setVoiceInterruption] = useState(true);
  const [continuousListening, setContinuousListening] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // AI Settings state
  const [responseLength, setResponseLength] = useState<"concise" | "normal" | "detailed">("concise");
  const [temperature, setTemperature] = useState(0.3);
  
  // Load existing settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadAvailableVoices();
    }
  }, [isOpen]);

  const loadAvailableVoices = async () => {
    try {
      // Only run in browser
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.warn("⚠️ Speech synthesis not available");
        return;
      }
      
      console.log("🎤 Loading available voices...");
      
      // Try to get voices immediately
      let voices = window.speechSynthesis.getVoices();
      console.log("🎤 Immediate voices:", voices.length);
      
      if (voices.length > 0) {
        setAvailableVoices(voices);
        return;
      }
      
      // If no voices yet, wait for them to load
      console.log("🎤 Waiting for voices to load...");
      voices = await waitForVoices();
      console.log("🎤 Loaded voices after wait:", voices.length);
      setAvailableVoices(voices);
      
      // Set up listener for voice changes (some browsers load async)
      window.speechSynthesis.onvoiceschanged = () => {
        const newVoices = window.speechSynthesis.getVoices();
        console.log("🎤 Voices changed, now have:", newVoices.length);
        if (newVoices.length > 0) {
          setAvailableVoices(newVoices);
        }
      };
    } catch (error) {
      console.error("❌ Failed to load voices:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        
        // Load voice settings
        if (data.voice) {
          setVoiceSpeed(data.voice.speed || 1.15);
          setVoicePitch(data.voice.pitch || 1.15);
          setAutoSendDelay(data.voice.autoSendDelay || 2.0);
          setVoiceVolume(data.voice.volume || 1.0);
          setVoiceService(data.voice.voiceService || "auto");
          setSelectedVoice(data.voice.selectedVoice || "");
          setAutoRestartMic(data.voice.autoRestartMic !== false);
          setVoiceInterruption(data.voice.voiceInterruption !== false);
          setContinuousListening(data.voice.continuousListening || false);
        }
        
        // Load AI settings
        if (data.ai) {
          setResponseLength(data.ai.responseLength || "concise");
          setTemperature(data.ai.temperature || 0.3);
        }
        
        // Load usage limits
        if (data.limits) {
          setEnableLimits(data.limits.enabled || false);
          setMaxTokensPerUser(data.limits.maxTokensPerUser || 10000);
          setMaxRequestsPerHour(data.limits.maxRequestsPerHour || 20);
          setMaxCostPerUser(data.limits.maxCostPerUser || 1.0);
          setRequireAuth(data.limits.requireAuth !== false);
        }
        
        // Show if API keys are configured
        if (data.apiKeys) {
          setShowApiKeys(data.apiKeys.hasAnthropic || data.apiKeys.hasElevenLabs);
          setHasExistingAnthropicKey(data.apiKeys.hasAnthropic || false);
          setHasExistingElevenLabsKey(data.apiKeys.hasElevenLabs || false);
          setHasExistingVoiceId(data.apiKeys.hasElevenLabsVoiceId || false);
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };
  
  if (!isOpen) return null;

  const handleSave = async () => {
    // Only include API keys if they have NEW values
    // If field is empty but key exists, we preserve the existing key
    const apiKeysToSave: any = {};
    
    if (removeAnthropicKey) {
      // Explicitly remove the key
      apiKeysToSave.anthropic = "__REMOVE__";
    } else if (anthropicKey && anthropicKey.trim()) {
      // New key entered
      apiKeysToSave.anthropic = anthropicKey.trim();
    } else if (hasExistingAnthropicKey) {
      // Keep existing key (send a special marker)
      apiKeysToSave.anthropic = "__KEEP_EXISTING__";
    }
    
    if (removeElevenLabsKey) {
      apiKeysToSave.elevenLabs = "__REMOVE__";
    } else if (elevenLabsKey && elevenLabsKey.trim()) {
      apiKeysToSave.elevenLabs = elevenLabsKey.trim();
    } else if (hasExistingElevenLabsKey) {
      apiKeysToSave.elevenLabs = "__KEEP_EXISTING__";
    }
    
    if (removeVoiceId) {
      apiKeysToSave.elevenLabsVoiceId = "__REMOVE__";
    } else if (elevenLabsVoiceId && elevenLabsVoiceId.trim()) {
      apiKeysToSave.elevenLabsVoiceId = elevenLabsVoiceId.trim();
    }

    // Save settings to backend
    const settings = {
      apiKeys: Object.keys(apiKeysToSave).length > 0 ? apiKeysToSave : undefined,
      limits: enableLimits ? {
        enabled: true,
        maxTokensPerUser,
        maxRequestsPerHour,
        maxCostPerUser,
        requireAuth,
      } : { enabled: false },
      voice: { 
        speed: voiceSpeed, 
        pitch: voicePitch, 
        autoSendDelay,
        volume: voiceVolume,
        voiceService,
        selectedVoice,
        autoRestartMic,
        voiceInterruption,
        continuousListening
      },
      ai: { responseLength, temperature },
    };

    console.log("💾 Saving settings:", {
      ...settings,
      apiKeys: settings.apiKeys ? { 
        hasAnthropic: !!settings.apiKeys.anthropic,
        hasElevenLabs: !!settings.apiKeys.elevenLabs,
        hasVoiceId: !!settings.apiKeys.elevenLabsVoiceId
      } : "none"
    });

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      setSaveStatus("saving");
      
      if (response.ok) {
        console.log("✅ Settings saved successfully");
        
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("settingsUpdated"));
        
        setSaveStatus("saved");
        
        // Reset status after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        const error = await response.json();
        console.error("❌ Save failed:", error);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("❌ Failed to save settings:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-800 p-4 space-y-2">
            <button
              onClick={() => setActiveTab("api")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "api"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Key className="w-5 h-5" />
              <span className="font-medium">API Keys</span>
            </button>

            <button
              onClick={() => setActiveTab("limits")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "limits"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Usage Limits</span>
            </button>

            <button
              onClick={() => setActiveTab("voice")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "voice"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Mic className="w-5 h-5" />
              <span className="font-medium">Voice</span>
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "ai"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Zap className="w-5 h-5" />
              <span className="font-medium">AI Behavior</span>
            </button>

            <button
              onClick={() => setActiveTab("display")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "display"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Palette className="w-5 h-5" />
              <span className="font-medium">Display</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* API Keys Tab */}
            {activeTab === "api" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">API Keys</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Configure your API keys for AI services. Leave blank to use server defaults.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={showApiKeys}
                        onChange={(e) => setShowApiKeys(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Use custom API keys</span>
                    </label>
                  </div>

                  {showApiKeys && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Anthropic API Key (Claude)
                          {hasExistingAnthropicKey && !removeAnthropicKey && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ✓ Configured
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => {
                              setAnthropicKey(e.target.value);
                              // If user starts typing, cancel the removal
                              if (removeAnthropicKey) {
                                setRemoveAnthropicKey(false);
                              }
                            }}
                            placeholder={hasExistingAnthropicKey ? "••••••••••••••••" : "sk-ant-api03-..."}
                            disabled={removeAnthropicKey}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {hasExistingAnthropicKey && (
                            <button
                              type="button"
                              onClick={() => setRemoveAnthropicKey(!removeAnthropicKey)}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                removeAnthropicKey
                                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                              }`}
                            >
                              {removeAnthropicKey ? "Undo" : "Remove"}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {removeAnthropicKey ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              ⚠️ Key will be removed when you save. Click "Undo" to cancel and add a new key instead.
                            </span>
                          ) : hasExistingAnthropicKey ? (
                            "Key is saved. Enter a new key to update, or leave blank to keep current key."
                          ) : (
                            <>
                              Get your key from{" "}
                              <a
                                href="https://console.anthropic.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:underline"
                              >
                                console.anthropic.com
                              </a>
                            </>
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          ElevenLabs API Key (Voice)
                          {hasExistingElevenLabsKey && !removeElevenLabsKey && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ✓ Configured
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={elevenLabsKey}
                            onChange={(e) => {
                              setElevenLabsKey(e.target.value);
                              // If user starts typing, cancel the removal
                              if (removeElevenLabsKey) {
                                setRemoveElevenLabsKey(false);
                              }
                            }}
                            placeholder={hasExistingElevenLabsKey ? "••••••••••••••••" : "sk_..."}
                            disabled={removeElevenLabsKey}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {hasExistingElevenLabsKey && (
                            <button
                              type="button"
                              onClick={() => setRemoveElevenLabsKey(!removeElevenLabsKey)}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                removeElevenLabsKey
                                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                              }`}
                            >
                              {removeElevenLabsKey ? "Undo" : "Remove"}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {removeElevenLabsKey ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              ⚠️ Key will be removed when you save. Click "Undo" to cancel and add a new key instead.
                            </span>
                          ) : hasExistingElevenLabsKey ? (
                            "Key is saved. Enter a new key to update, or leave blank to keep current key."
                          ) : (
                            <>
                              Get your key from{" "}
                              <a
                                href="https://elevenlabs.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:underline"
                              >
                                elevenlabs.io
                              </a>
                            </>
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          ElevenLabs Voice ID
                          {hasExistingVoiceId && !removeVoiceId && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              ✓ Configured
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={elevenLabsVoiceId}
                            onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                            placeholder={hasExistingVoiceId ? "kdmDKE6EkgrWrrykO9Qt" : "kdmDKE6EkgrWrrykO9Qt"}
                            disabled={removeVoiceId}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {hasExistingVoiceId && (
                            <button
                              type="button"
                              onClick={() => setRemoveVoiceId(!removeVoiceId)}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                removeVoiceId
                                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                              }`}
                            >
                              {removeVoiceId ? "Undo" : "Remove"}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {removeVoiceId ? (
                            <span className="text-red-600 dark:text-red-400">Voice ID will be removed when you save</span>
                          ) : hasExistingVoiceId ? (
                            "Voice ID is saved. Enter a new ID to update, or leave blank to keep current."
                          ) : (
                            "Find voice IDs in your ElevenLabs dashboard under Voice Library"
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Usage Limits Tab */}
            {activeTab === "limits" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Usage Limits & Protection</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Protect your API costs by setting usage limits for business deployment.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={enableLimits}
                        onChange={(e) => setEnableLimits(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Enable usage limits</span>
                    </label>
                  </div>

                  {enableLimits && (
                    <>
                      <div>
                        <label className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={requireAuth}
                            onChange={(e) => setRequireAuth(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm font-medium">Require authentication</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">
                          Force users to sign in before using the app
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Max Tokens Per User (Daily)
                        </label>
                        <input
                          type="number"
                          value={maxTokensPerUser}
                          onChange={(e) => setMaxTokensPerUser(Number(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Limit tokens per user per day (10,000 ≈ $0.30)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Max Requests Per Hour
                        </label>
                        <input
                          type="number"
                          value={maxRequestsPerHour}
                          onChange={(e) => setMaxRequestsPerHour(Number(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Prevent abuse with rate limiting
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Max Cost Per User (Daily) - $
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={maxCostPerUser}
                          onChange={(e) => setMaxCostPerUser(Number(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Hard limit on cost per user per day
                        </p>
                      </div>

                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              Cost Protection Active
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                              Users will be blocked when they hit any limit. Limits reset daily at midnight UTC.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Voice Settings Tab */}
            {activeTab === "voice" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Voice Settings</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Customize voice synthesis behavior and personality.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Voice Service Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Voice Service</label>
                    <select
                      value={voiceService}
                      onChange={(e) => setVoiceService(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="auto">Auto (Try ElevenLabs, fallback to Web Speech)</option>
                      <option value="elevenlabs">ElevenLabs Only (Premium)</option>
                      <option value="web-speech">Web Speech Only (Free)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose your preferred voice synthesis service
                    </p>
                  </div>

                  {/* Voice Selection - Web Speech Only */}
                  {(voiceService === "web-speech" || voiceService === "auto") && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Voice Selection <span className="text-xs text-purple-600 dark:text-purple-400">(Web Speech Only)</span>
                      </label>
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                      >
                        <option value="">Default (Auto-select best voice)</option>
                        {availableVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose from available browser voices
                      </p>
                    </div>
                  )}

                  {/* Volume Control */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Volume: {Math.round(voiceVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={voiceVolume}
                      onChange={(e) => setVoiceVolume(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Muted (0%)</span>
                      <span>Max (100%)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Voice Speed: {voiceSpeed.toFixed(2)}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Slower (0.5x)</span>
                      <span>Faster (2.5x)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Voice Pitch: {voicePitch.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={voicePitch}
                      onChange={(e) => setVoicePitch(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Lower (0.5)</span>
                      <span>Higher (2.0)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Auto-Send Delay: {autoSendDelay.toFixed(1)}s
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={autoSendDelay}
                      onChange={(e) => setAutoSendDelay(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How long to wait after you stop speaking before auto-sending
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-semibold mb-3">Microphone Behavior</h4>
                  </div>

                  {/* Auto-Restart Microphone */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoRestartMic}
                        onChange={(e) => setAutoRestartMic(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Auto-restart microphone after AI speaks</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-6 mt-1">
                      Automatically turn on mic after AI finishes speaking (hands-free mode)
                    </p>
                  </div>

                  {/* Voice Interruption - Web Speech Only */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={voiceInterruption}
                        onChange={(e) => setVoiceInterruption(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">
                        Voice interruption <span className="text-xs text-purple-600 dark:text-purple-400">(Web Speech Only)</span>
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 ml-6 mt-1">
                      Interrupt AI voice by speaking (Voice Activity Detection)
                    </p>
                  </div>

                  {/* Continuous Listening Mode */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={continuousListening}
                        onChange={(e) => setContinuousListening(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Continuous listening mode</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-6 mt-1">
                      Keep microphone always on for hands-free conversation (experimental)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Settings Tab */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">AI Behavior</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Control how the AI responds to your questions.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Response Length</label>
                    <select
                      value={responseLength}
                      onChange={(e) => setResponseLength(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="concise">Concise (2-3 sentences)</option>
                      <option value="normal">Normal (1 paragraph)</option>
                      <option value="detailed">Detailed (Multiple paragraphs)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Temperature: {temperature.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Focused (0.0)</span>
                      <span>Creative (1.0)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Lower = more consistent, Higher = more creative
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Display Settings Tab */}
            {activeTab === "display" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Display Preferences</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Customize the app's appearance.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Theme</label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                      <option>System Default</option>
                      <option>Light</option>
                      <option>Dark</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">Auto-scroll to new messages</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">Show typing indicators</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              saveStatus === "saved"
                ? "bg-green-600 hover:bg-green-700"
                : saveStatus === "error"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-purple-600 hover:bg-purple-700"
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saveStatus === "saving" && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saveStatus === "saved" && "✓ Saved!"}
            {saveStatus === "error" && "✗ Failed"}
            {saveStatus === "idle" && "Save Settings"}
            {saveStatus === "saving" && "Saving..."}
          </button>
        </div>
      </div>
    </div>
  );
}
