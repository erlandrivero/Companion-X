"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, Key, ExternalLink } from "lucide-react";

interface TrialBannerProps {
  onOpenSettings: () => void;
}

export function TrialBanner({ onOpenSettings }: TrialBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [usageStats, setUsageStats] = useState<{
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
    costUsed: number;
    costLimit: number;
  } | null>(null);

  useEffect(() => {
    // Fetch usage stats
    const fetchUsageStats = async () => {
      try {
        const response = await fetch("/api/usage/stats");
        if (response.ok) {
          const data = await response.json();
          setUsageStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch usage stats:", error);
      }
    };

    fetchUsageStats();
  }, []);

  if (!isVisible) return null;

  const tokensPercent = usageStats 
    ? Math.min((usageStats.tokensUsed / usageStats.tokensLimit) * 100, 100)
    : 0;

  const isNearLimit = tokensPercent > 80;
  const isAtLimit = tokensPercent >= 100;

  return (
    <div className={`border-b ${
      isAtLimit 
        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" 
        : isNearLimit
        ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
        : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            isAtLimit 
              ? "text-red-600 dark:text-red-400" 
              : isNearLimit
              ? "text-orange-600 dark:text-orange-400"
              : "text-blue-600 dark:text-blue-400"
          }`} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-sm font-semibold ${
                isAtLimit 
                  ? "text-red-900 dark:text-red-100" 
                  : isNearLimit
                  ? "text-orange-900 dark:text-orange-100"
                  : "text-blue-900 dark:text-blue-100"
              }`}>
                {isAtLimit 
                  ? "⚠️ Trial Limit Reached - Add Your API Key to Continue" 
                  : isNearLimit
                  ? "⚠️ Trial Limit Almost Reached"
                  : "🎉 You're Using Trial Mode"}
              </h3>
            </div>
            
            <p className={`text-sm mb-2 ${
              isAtLimit 
                ? "text-red-800 dark:text-red-200" 
                : isNearLimit
                ? "text-orange-800 dark:text-orange-200"
                : "text-blue-800 dark:text-blue-200"
            }`}>
              {isAtLimit
                ? "You've reached your trial limit. Add your own Anthropic API key to continue using advanced features."
                : isNearLimit
                ? "You're almost at your trial limit. Add your own API key to avoid interruptions."
                : "You have limited free credits. Add your own Anthropic API key for unlimited access."}
            </p>

            {usageStats && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={
                    isAtLimit 
                      ? "text-red-700 dark:text-red-300" 
                      : isNearLimit
                      ? "text-orange-700 dark:text-orange-300"
                      : "text-blue-700 dark:text-blue-300"
                  }>
                    {usageStats.tokensUsed.toLocaleString()} / {usageStats.tokensLimit.toLocaleString()} tokens used
                  </span>
                  <span className={
                    isAtLimit 
                      ? "text-red-700 dark:text-red-300 font-medium" 
                      : isNearLimit
                      ? "text-orange-700 dark:text-orange-300 font-medium"
                      : "text-blue-700 dark:text-blue-300"
                  }>
                    {tokensPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-white dark:bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isAtLimit 
                        ? "bg-red-600 dark:bg-red-500" 
                        : isNearLimit
                        ? "bg-orange-600 dark:bg-orange-500"
                        : "bg-blue-600 dark:bg-blue-500"
                    }`}
                    style={{ width: `${tokensPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={onOpenSettings}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isAtLimit 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : isNearLimit
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <Key className="w-4 h-4" />
                Add API Key
              </button>
              
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isAtLimit 
                    ? "bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900/70 dark:text-red-200" 
                    : isNearLimit
                    ? "bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/50 dark:hover:bg-orange-900/70 dark:text-orange-200"
                    : "bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-900/70 dark:text-blue-200"
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                Get API Key
              </a>
            </div>
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
              isAtLimit 
                ? "hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400" 
                : isNearLimit
                ? "hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                : "hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
