"use client";

import { useState } from "react";
import { Agent } from "@/types/agent";
import { AgentCard } from "./AgentCard";
import { Plus, Search, Sparkles } from "lucide-react";

interface AgentListProps {
  agents: Agent[];
  onSelectAgent?: (agent: Agent) => void;
  onCreateAgent?: () => void;
  onDeleteAgent?: (agentId: string) => void;
  onEditAgent?: (agent: Agent) => void;
  selectedAgentId?: string;
}

export function AgentList({
  agents,
  onSelectAgent,
  onCreateAgent,
  onDeleteAgent,
  onEditAgent,
  selectedAgentId,
}: AgentListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.expertise.some((exp) =>
        exp.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Agents
          </h2>
          <button
            onClick={onCreateAgent}
            className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            title="Create new agent"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredAgents.length === 0 ? (
          <div className="text-center py-8">
            {agents.length === 0 ? (
              <>
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  No agents yet
                </p>
                <button
                  onClick={onCreateAgent}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
                >
                  Create Your First Agent
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No agents match your search
              </p>
            )}
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <AgentCard
              key={agent._id?.toString()}
              agent={agent}
              onClick={() => onSelectAgent?.(agent)}
              onDelete={() => onDeleteAgent?.(agent._id?.toString() || "")}
              onEdit={() => onEditAgent?.(agent)}
              isActive={agent._id?.toString() === selectedAgentId}
            />
          ))
        )}
      </div>

      {/* Footer Stats */}
      {agents.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} available
          </div>
        </div>
      )}
    </div>
  );
}
