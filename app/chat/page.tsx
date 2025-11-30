"use client";

import { useState, useEffect } from "react";
import { UserMenu } from "@/components/UserMenu";
import { ChatInterface } from "@/components/ChatInterface";
import { AgentList } from "@/components/AgentList";
import { AgentEditModal } from "@/components/AgentEditModal";
import { AgentDetailModal } from "@/components/AgentDetailModal";
import { SettingsModal } from "@/components/SettingsModal";
import { TrialBanner } from "@/components/TrialBanner";
import { Brain, Menu, X, Sparkles, CheckCircle, BarChart3 } from "lucide-react";
import { Agent } from "@/types/agent";
import { useToast } from "@/contexts/ToastContext";
import Link from "next/link";

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [newAgentNotification, setNewAgentNotification] = useState<Agent | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { showToast } = useToast();

  // Load agents from API
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleCreateAgent = async () => {
    // Note: This function is not currently used in the UI
    // Agent creation happens through ChatInterface
    showToast("Agent creation happens through chat interactions", "info");
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAgents((prev) => prev.filter((agent) => agent._id?.toString() !== agentId));
        if (selectedAgent?._id?.toString() === agentId) {
          setSelectedAgent(null);
        }
      } else {
        const error = await response.json();
        showToast(`Failed to delete agent: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Delete agent error:", error);
      showToast("Failed to delete agent. Please try again.", "error");
    }
  };

  const handleEditAgent = async (updatedFields: Partial<Agent>) => {
    if (!editingAgent?._id) return;

    try {
      const response = await fetch(`/api/agents?id=${editingAgent._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents((prev) =>
          prev.map((agent) =>
            agent._id?.toString() === editingAgent._id?.toString() ? data.agent : agent
          )
        );
        showToast("Agent updated successfully!", "success");
        setEditingAgent(null);
      } else {
        const error = await response.json();
        showToast(`Failed to update agent: ${error.error}`, "error");
      }
    } catch (error) {
      console.error("Update agent error:", error);
      showToast("Failed to update agent. Please try again.", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            <Brain className="w-8 h-8 text-purple-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Companion X
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="View Usage Dashboard"
            >
              <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
                Dashboard
              </span>
            </Link>
            <UserMenu onSettingsClick={() => setIsSettingsOpen(true)} />
          </div>
        </div>
      </header>

      {/* Trial Banner */}
      <TrialBanner onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Agent List */}
        <aside
          className={`${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-30 w-80 h-full transition-transform duration-300 ease-in-out`}
        >
          <AgentList
            agents={agents}
            onSelectAgent={(agent) => {
              setViewingAgent(agent);
              setIsSidebarOpen(false);
            }}
            onCreateAgent={handleCreateAgent}
            onDeleteAgent={handleDeleteAgent}
            onEditAgent={(agent) => setEditingAgent(agent)}
            selectedAgentId={selectedAgent?._id?.toString()}
          />
        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative">
          <ChatInterface 
            onAgentCreated={(agent) => {
              setAgents((prev) => [...prev, agent]);
              setNewAgentNotification(agent);
              // Auto-hide notification after 5 seconds
              setTimeout(() => setNewAgentNotification(null), 5000);
            }} 
          />
          
          {/* Agent Created Notification */}
          {newAgentNotification && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md animate-slide-in z-10">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Agent Created!</p>
                <p className="text-sm text-green-100">{newAgentNotification.name}</p>
              </div>
              <button
                onClick={() => {
                  setViewingAgent(newAgentNotification);
                  setNewAgentNotification(null);
                }}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
              >
                View
              </button>
              <button
                onClick={() => setNewAgentNotification(null)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingAgent && (
        <AgentEditModal
          agent={editingAgent}
          isOpen={true}
          onClose={() => setEditingAgent(null)}
          onSave={handleEditAgent}
        />
      )}

      {/* Agent Detail Modal */}
      <AgentDetailModal
        agent={viewingAgent}
        isOpen={!!viewingAgent}
        onClose={() => setViewingAgent(null)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
