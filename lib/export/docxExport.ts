/**
 * DOCX Export Utility
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";
import { saveAs } from "file-saver";
import { Message } from "@/types/conversation";
import { formatDate } from "../utils/formatters";

export interface ExportOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeAgentInfo?: boolean;
}

/**
 * Export conversation to DOCX
 */
export async function exportToDOCX(
  messages: Message[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    title = "Conversation Export",
    includeTimestamps = true,
    includeAgentInfo = true,
  } = options;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Export date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported: ${formatDate(new Date())}`,
          size: 20,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Messages
  messages.forEach((message, index) => {
    // Message header
    const headerRuns: TextRun[] = [];

    if (message.role === "user") {
      headerRuns.push(
        new TextRun({
          text: "You",
          bold: true,
          color: "9333EA", // Purple
          size: 24,
        })
      );
    } else {
      headerRuns.push(
        new TextRun({
          text: "Assistant",
          bold: true,
          color: "3B82F6", // Blue
          size: 24,
        })
      );
    }

    // Timestamp
    if (includeTimestamps) {
      headerRuns.push(
        new TextRun({
          text: ` - ${formatDate(message.timestamp)}`,
          color: "999999",
          size: 18,
        })
      );
    }

    children.push(
      new Paragraph({
        children: headerRuns,
        spacing: { before: 200, after: 100 },
      })
    );

    // Agent info
    if (includeAgentInfo && message.agentUsed) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `via Agent: ${message.agentUsed}`,
              italics: true,
              color: "666666",
              size: 18,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    // Message content
    const contentLines = message.content.split("\n");
    contentLines.forEach((line, lineIndex) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || " ", // Empty line if blank
              size: 22,
            }),
          ],
          spacing: {
            after: lineIndex === contentLines.length - 1 ? 200 : 100,
          },
          indent: { left: 200 },
        })
      );
    });

    // Separator between messages
    if (index < messages.length - 1) {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: "E5E5E5",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
          spacing: { after: 200 },
        })
      );
    }
  });

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate and save
  const blob = await Packer.toBlob(doc);
  const filename = `conversation_${new Date().getTime()}.docx`;
  saveAs(blob, filename);
}

/**
 * Export conversation summary to DOCX
 */
export async function exportSummaryToDOCX(
  messages: Message[],
  summary: string,
  options: ExportOptions = {}
): Promise<void> {
  const { title = "Conversation Summary" } = options;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Summary
  children.push(
    new Paragraph({
      text: "Summary",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: summary,
          size: 22,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Statistics
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantMessages = messages.filter((m) => m.role === "assistant").length;

  children.push(
    new Paragraph({
      text: "Statistics",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Messages: ${messages.length}\n`,
          size: 22,
        }),
        new TextRun({
          text: `User Messages: ${userMessages}\n`,
          size: 22,
        }),
        new TextRun({
          text: `Assistant Messages: ${assistantMessages}\n`,
          size: 22,
        }),
        new TextRun({
          text: `Date: ${formatDate(new Date())}`,
          size: 22,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate and save
  const blob = await Packer.toBlob(doc);
  const filename = `conversation_summary_${new Date().getTime()}.docx`;
  saveAs(blob, filename);
}
