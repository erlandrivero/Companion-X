"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  agentsSuggested: string[];
}

interface ConversationListProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Reload conversations when current conversation changes (e.g., new conversation created)
  useEffect(() => {
    if (currentConversationId) {
      // Debounce to avoid excessive reloads
      const timer = setTimeout(() => {
        loadConversations();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation
    
    if (!confirm("Delete this conversation?")) return;
    
    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      
      if (response.ok) {
        setConversations(conversations.filter(c => c.id !== id));
        
        // If we deleted the current conversation, start a new one
        if (currentConversationId === id) {
          onNewConversation();
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 mt-4 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="New conversation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Conversations
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="New conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start chatting to create one!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  currentConversationId === conv.id
                    ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {conv.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {conv.preview}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{conv.messageCount} messages</span>
                      <span>•</span>
                      <span>{formatDate(conv.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
