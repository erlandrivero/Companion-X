"use client";

import { Message } from "@/types/conversation";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { Bot, User } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  agentName?: string;
}

// Convert URLs in text to clickable links
function linkifyText(text: string) {
  // Regex to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline break-words"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function MessageBubble({ message, agentName }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-purple-500 text-white"
            : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Content */}
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[70%]`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {isUser ? "You" : agentName || "AI Assistant"}
            </span>
            {!isUser && agentName && agentName !== "AI Assistant" && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full font-medium">
                Specialist
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>

        {/* Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-purple-500 text-white rounded-tr-sm"
              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {linkifyText(message.content)}
          </p>
        </div>

        {/* Voice Indicator */}
        {message.voiceEnabled && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Voice enabled
          </div>
        )}
      </div>
    </div>
  );
}
