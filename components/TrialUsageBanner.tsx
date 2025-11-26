"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Zap, Clock, DollarSign, Settings } from "lucide-react";

interface UsageSummary {
  tokens: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  requests: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  cost: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  resetsAt: Date;
}

export function TrialUsageBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const response = await fetch("/api/usage/summary");
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error("Failed to load usage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !usage) return null;

  // Only show if user is getting close to limits (>50%)
  const maxPercentage = Math.max(
    usage.tokens.percentage,
    usage.requests.percentage,
    usage.cost.percentage
  );

  if (maxPercentage < 50) return null;

  const isNearLimit = maxPercentage >= 80;
  const isAtLimit = maxPercentage >= 95;

  return (
    <div
      className={`mx-6 mt-4 rounded-lg border p-4 ${
        isAtLimit
          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          : isNearLimit
          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              isAtLimit
                ? "text-red-600 dark:text-red-400"
                : isNearLimit
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          />
          <div className="flex-1">
            <h3
              className={`font-semibold text-sm ${
                isAtLimit
                  ? "text-red-800 dark:text-red-200"
                  : isNearLimit
                  ? "text-yellow-800 dark:text-yellow-200"
                  : "text-blue-800 dark:text-blue-200"
              }`}
            >
              {isAtLimit
                ? "Trial Limit Reached"
                : isNearLimit
                ? "Trial Limit Warning"
                : "Trial Usage"}
            </h3>
            <p
              className={`text-xs mt-1 ${
                isAtLimit
                  ? "text-red-700 dark:text-red-300"
                  : isNearLimit
                  ? "text-yellow-700 dark:text-yellow-300"
                  : "text-blue-700 dark:text-blue-300"
              }`}
            >
              {isAtLimit
                ? "You've reached your daily trial limit. Add your own API key to continue."
                : isNearLimit
                ? `You've used ${maxPercentage}% of your daily trial. Add your own API key for unlimited access.`
                : `You're using the free trial (${maxPercentage}% used today).`}
            </p>

            {showDetails && (
              <div className="mt-3 space-y-2">
                {/* Tokens */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Tokens
                    </span>
                    <span className="font-medium">
                      {usage.tokens.used.toLocaleString()} / {usage.tokens.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        usage.tokens.percentage >= 95
                          ? "bg-red-600"
                          : usage.tokens.percentage >= 80
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(usage.tokens.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Requests */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Requests (hourly)
                    </span>
                    <span className="font-medium">
                      {usage.requests.used} / {usage.requests.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        usage.requests.percentage >= 95
                          ? "bg-red-600"
                          : usage.requests.percentage >= 80
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(usage.requests.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Cost */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Cost
                    </span>
                    <span className="font-medium">
                      ${usage.cost.used.toFixed(2)} / ${usage.cost.limit.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        usage.cost.percentage >= 95
                          ? "bg-red-600"
                          : usage.cost.percentage >= 80
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.min(usage.cost.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Resets at {new Date(usage.resetsAt).toLocaleTimeString()} (midnight UTC)
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs px-3 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
          <button
            onClick={onOpenSettings}
            className={`text-xs px-3 py-1 rounded flex items-center gap-1 transition-colors ${
              isAtLimit
                ? "bg-red-600 hover:bg-red-700 text-white"
                : isNearLimit
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <Settings className="w-3 h-3" />
            Add API Key
          </button>
        </div>
      </div>
    </div>
  );
}
