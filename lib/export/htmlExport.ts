/**
 * Export conversation to HTML format
 */

import { Message } from "@/types/conversation";

export interface HTMLExportOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeAgentInfo?: boolean;
}

export function exportToHTML(
  messages: Message[],
  options: HTMLExportOptions = {}
) {
  const {
    title = "AI Conversation",
    includeTimestamps = true,
    includeAgentInfo = true,
  } = options;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 0.9em;
        }
        .messages {
            padding: 30px;
        }
        .message {
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 12px;
            animation: fadeIn 0.5s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user {
            background: #f3f4f6;
            border-left: 4px solid #667eea;
        }
        .message.assistant {
            background: #ede9fe;
            border-left: 4px solid #764ba2;
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            font-weight: 600;
            color: #667eea;
        }
        .message.assistant .message-header {
            color: #764ba2;
        }
        .role-icon {
            font-size: 1.2em;
        }
        .timestamp {
            font-size: 0.85em;
            color: #6b7280;
            margin-left: auto;
        }
        .agent-info {
            font-size: 0.85em;
            color: #6b7280;
            font-style: italic;
            margin-bottom: 8px;
        }
        .message-content {
            color: #1f2937;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 0.9em;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p>Exported on ${new Date().toLocaleString()}</p>
        </div>
        <div class="messages">
${messages
  .map(
    (message) => `
            <div class="message ${message.role}">
                <div class="message-header">
                    <span class="role-icon">${message.role === "user" ? "👤" : "🤖"}</span>
                    <span>${message.role === "user" ? "You" : "Assistant"}</span>
                    ${
                      includeTimestamps && message.timestamp
                        ? `<span class="timestamp">${new Date(message.timestamp).toLocaleString()}</span>`
                        : ""
                    }
                </div>
                ${
                  includeAgentInfo && message.agentName
                    ? `<div class="agent-info">Agent: ${message.agentName}</div>`
                    : ""
                }
                <div class="message-content">${message.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            </div>
`
  )
  .join("")}
        </div>
        <div class="footer">
            <p>Total Messages: ${messages.length} | User: ${messages.filter((m) => m.role === "user").length} | Assistant: ${messages.filter((m) => m.role === "assistant").length}</p>
        </div>
    </div>
</body>
</html>
`;

  // Create and download file
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
