"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, DollarSign, Zap, Calendar } from "lucide-react";
import Link from "next/link";

interface UsageDetails {
  currentCost: number;
  monthlyBudget: number;
  percentUsed: number;
  remaining: number;
  stats: {
    currentMonth: {
      claudeHaikuTokens: number;
      claudeSonnetTokens: number;
      elevenLabsCharacters: number;
      totalCost: number;
      requestCount: number;
    };
  };
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const response = await fetch("/api/usage");
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Usage Statistics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Detailed breakdown of your API usage
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Current Cost</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              ${usage?.currentCost.toFixed(2) || "0.00"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This month</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Budget</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              ${usage?.monthlyBudget.toFixed(2) || "50.00"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monthly limit</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Requests</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {usage?.stats.currentMonth.requestCount || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This month</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Remaining</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              ${usage?.remaining.toFixed(2) || "50.00"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Available</p>
          </div>
        </div>

        {/* Token Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Token Usage
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Claude Haiku
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {usage?.stats.currentMonth.claudeHaikuTokens.toLocaleString() || 0} tokens
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      ((usage?.stats.currentMonth.claudeHaikuTokens || 0) / 100000) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Claude Sonnet
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {usage?.stats.currentMonth.claudeSonnetTokens.toLocaleString() || 0} tokens
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      ((usage?.stats.currentMonth.claudeSonnetTokens || 0) / 100000) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  ElevenLabs Characters
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {usage?.stats.currentMonth.elevenLabsCharacters.toLocaleString() || 0} chars
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      ((usage?.stats.currentMonth.elevenLabsCharacters || 0) / 10000) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Budget Progress
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                ${usage?.currentCost.toFixed(2)} used
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                ${usage?.monthlyBudget.toFixed(2)} budget
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${
                  (usage?.percentUsed || 0) >= 90
                    ? "bg-red-500"
                    : (usage?.percentUsed || 0) >= 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(usage?.percentUsed || 0, 100)}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {usage?.percentUsed.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">of budget used</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
