/**
 * Export conversation to CSV format
 */

import { Message } from "@/types/conversation";

export interface CSVExportOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeAgentInfo?: boolean;
}

export function exportToCSV(
  messages: Message[],
  options: CSVExportOptions = {}
) {
  const {
    title = "AI Conversation",
    includeTimestamps = true,
    includeAgentInfo = true,
  } = options;

  // CSV Header
  let csv = "Index,Role,Content,";
  if (includeTimestamps) csv += "Timestamp,";
  if (includeAgentInfo) csv += "Agent,";
  csv += "Voice Enabled\n";

  // CSV Rows
  messages.forEach((message, index) => {
    const escapedContent = `"${message.content.replace(/"/g, '""')}"`;
    
    let row = `${index + 1},${message.role},${escapedContent},`;
    
    if (includeTimestamps) {
      const timestamp = message.timestamp
        ? new Date(message.timestamp).toISOString()
        : "";
      row += `"${timestamp}",`;
    }
    
    if (includeAgentInfo) {
      row += `"${message.agentName || ""}",`;
    }
    
    row += `${message.voiceEnabled ? "Yes" : "No"}\n`;
    
    csv += row;
  });

  // Create and download file
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
