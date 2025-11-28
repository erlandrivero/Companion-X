/**
 * Export conversation to Markdown format
 */

import { Message } from "@/types/conversation";

export interface MarkdownExportOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeAgentInfo?: boolean;
}

export function exportToMarkdown(
  messages: Message[],
  options: MarkdownExportOptions = {}
) {
  const {
    title = "AI Conversation",
    includeTimestamps = true,
    includeAgentInfo = true,
  } = options;

  let markdown = `# ${title}\n\n`;
  markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
  markdown += `---\n\n`;

  messages.forEach((message, index) => {
    const role = message.role === "user" ? "👤 You" : "🤖 Assistant";
    
    markdown += `## ${role}\n\n`;
    
    if (includeTimestamps && message.timestamp) {
      markdown += `*${new Date(message.timestamp).toLocaleString()}*\n\n`;
    }
    
    if (includeAgentInfo && message.agentName) {
      markdown += `*Agent: ${message.agentName}*\n\n`;
    }
    
    markdown += `${message.content}\n\n`;
    
    if (index < messages.length - 1) {
      markdown += `---\n\n`;
    }
  });

  // Create and download file
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
