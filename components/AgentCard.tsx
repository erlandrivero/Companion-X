"use client";

import { Agent } from "@/types/agent";
import { Bot, TrendingUp, Clock, Zap, Trash2, Edit } from "lucide-react";
import { formatRelativeTime, formatNumber } from "@/lib/utils/formatters";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { useState } from "react";

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  isActive?: boolean;
}

export function AgentCard({ agent, onClick, onDelete, onEdit, isActive = false }: AgentCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    onDelete?.();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <div
      className={`group relative w-full text-left p-4 rounded-lg transition-all ${
        isActive
          ? "bg-purple-100 dark:bg-purple-900 border-2 border-purple-500"
          : "bg-white dark:bg-gray-800 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
      }`}
    >
      <button onClick={onClick} className="w-full text-left">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white break-words">
              {agent.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 break-words">
              {agent.description}
            </p>
          </div>
        </div>

      {/* Expertise Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {agent.expertise.slice(0, 3).map((exp, index) => (
          <span
            key={index}
            className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
          >
            {exp}
          </span>
        ))}
        {agent.expertise.length > 3 && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
            +{agent.expertise.length - 3}
          </span>
        )}
      </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Zap className="w-3 h-3" />
            <span>{formatNumber(agent.performanceMetrics.questionsHandled)}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <TrendingUp className="w-3 h-3" />
            <span>{(agent.performanceMetrics.successRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(agent.performanceMetrics.lastUsed)}</span>
          </div>
        </div>
      </button>

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={handleEdit}
            className="p-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
            title="Edit agent"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="p-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            title="Delete agent"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Agent?"
        message="Are you sure you want to delete this agent? All conversations and data associated with this agent will be permanently removed."
        itemName={agent.name}
        type="agent"
      />
    </div>
  );
}
