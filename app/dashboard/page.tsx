"use client";

import { Dashboard } from "@/components/Dashboard";
import { UserMenu } from "@/components/UserMenu";
import { TrialUsageBanner } from "@/components/TrialUsageBanner";
import { SettingsModal } from "@/components/SettingsModal";
import { Brain, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/chat"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Back to Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Usage Dashboard
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Monitor your API usage and costs
                </p>
              </div>
            </div>
          </div>

          <UserMenu onSettingsClick={() => setIsSettingsOpen(true)} />
        </div>
      </header>

      {/* Trial Usage Banner */}
      <TrialUsageBanner onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Dashboard />
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
