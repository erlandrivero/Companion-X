/**
 * Export conversation to JSON format
 */

import { Message } from "@/types/conversation";

export interface JSONExportOptions {
  title?: string;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
}

export function exportToJSON(
  messages: Message[],
  options: JSONExportOptions = {}
) {
  const {
    title = "AI Conversation",
    includeMetadata = true,
    prettyPrint = true,
  } = options;

  const data: any = {
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      agentUsed: msg.agentUsed,
      agentName: msg.agentName,
      voiceEnabled: msg.voiceEnabled,
    })),
  };

  if (includeMetadata) {
    data.metadata = {
      title,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      userMessageCount: messages.filter((m) => m.role === "user").length,
      assistantMessageCount: messages.filter((m) => m.role === "assistant").length,
    };
  }

  const jsonString = prettyPrint
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  // Create and download file
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
