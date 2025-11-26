"use client";

import { useState } from "react";
import { Agent } from "@/types/agent";
import { X, Bot, Sparkles, Brain, MessageSquare, Target, BookOpen, FileText } from "lucide-react";
import { AgentSkillsPanel } from "./AgentSkillsPanel";

interface AgentDetailModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function AgentDetailModal({ agent, isOpen, onClose, onEdit }: AgentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "skills">("overview");

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-blue-600">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {agent.name}
              </h2>
              <p className="text-purple-100 text-sm">
                Created {new Date(agent.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "skills"
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Skills
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" ? (
            <div className="space-y-6">
          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Description
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {agent.description}
            </p>
          </div>

          {/* Expertise */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Expertise Areas
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.expertise.map((exp, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm rounded-full font-medium"
                >
                  {exp}
                </span>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                System Prompt
              </h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                {agent.systemPrompt}
              </pre>
            </div>
          </div>

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Capabilities
                </h3>
              </div>
              <ul className="space-y-2">
                {agent.capabilities.map((capability, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-purple-500 mt-1">•</span>
                    <span>{capability}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Knowledge Base */}
          {agent.knowledgeBase && agent.knowledgeBase.facts && agent.knowledgeBase.facts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Knowledge Base
                </h3>
              </div>
              <div className="space-y-3">
                {agent.knowledgeBase.facts.slice(0, 5).map((fact, index) => (
                  <div
                    key={index}
                    className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800"
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {fact}
                    </p>
                  </div>
                ))}
                {agent.knowledgeBase.facts.length > 5 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    +{agent.knowledgeBase.facts.length - 5} more facts
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conversation Style */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversation Style
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {agent.conversationStyle.tone}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vocabulary</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {agent.conversationStyle.vocabulary}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Response Length</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {agent.conversationStyle.responseLength}
                </p>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Performance
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Questions Handled</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {agent.performanceMetrics.questionsHandled}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Used</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(agent.performanceMetrics.lastUsed).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
            </div>
          ) : (
            <AgentSkillsPanel agentId={agent._id!.toString()} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              Edit Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
