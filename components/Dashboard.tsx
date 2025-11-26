"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Zap, DollarSign, MessageSquare, Bot } from "lucide-react";

interface DashboardStats {
  totalAgents: number;
  totalConversations: number;
  currentCost: number;
  monthlyBudget: number;
  percentUsed: number;
  remaining: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [usageRes, agentsRes] = await Promise.all([
        fetch("/api/usage"),
        fetch("/api/agents"),
      ]);

      if (usageRes.ok && agentsRes.ok) {
        const usageData = await usageRes.json();
        const agentsData = await agentsRes.json();

        setStats({
          totalAgents: agentsData.agents?.length || 0,
          totalConversations: usageData.stats?.totalRequests || 0,
          currentCost: usageData.currentCost || 0,
          monthlyBudget: usageData.monthlyBudget || 50,
          percentUsed: usageData.percentUsed || 0,
          remaining: usageData.remaining || 50,
        });
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const budgetColor =
    stats.percentUsed >= 90
      ? "text-red-600 dark:text-red-400"
      : stats.percentUsed >= 70
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-green-600 dark:text-green-400";

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Agents */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalAgents}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI Agents</p>
        </div>

        {/* Total Conversations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <Zap className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalConversations}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Conversations</p>
        </div>

        {/* Current Cost */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            ${stats.currentCost.toFixed(2)}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
        </div>

        {/* Budget Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <h3 className={`text-2xl font-bold ${budgetColor}`}>
            {stats.percentUsed.toFixed(1)}%
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Budget Used</p>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Monthly Budget
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ${stats.remaining.toFixed(2)} remaining
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              stats.percentUsed >= 90
                ? "bg-red-500"
                : stats.percentUsed >= 70
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${Math.min(stats.percentUsed, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            ${stats.currentCost.toFixed(2)} used
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            ${stats.monthlyBudget.toFixed(2)} budget
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl p-6 hover:shadow-lg transition-all">
          <h4 className="font-semibold mb-2">Start Chatting</h4>
          <p className="text-sm opacity-90">Begin a new conversation</p>
        </button>
        <button className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl p-6 hover:shadow-lg transition-all">
          <h4 className="font-semibold mb-2">Create Agent</h4>
          <p className="text-sm opacity-90">Add a specialized AI agent</p>
        </button>
        <button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 hover:shadow-lg transition-all">
          <h4 className="font-semibold mb-2">View Usage</h4>
          <p className="text-sm opacity-90">Check detailed statistics</p>
        </button>
      </div>
    </div>
  );
}
