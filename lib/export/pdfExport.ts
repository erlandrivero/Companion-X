/**
 * PDF Export Utility
 */

import jsPDF from "jspdf";
import { Message } from "@/types/conversation";
import { formatDate } from "../utils/formatters";

export interface ExportOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeAgentInfo?: boolean;
}

/**
 * Export conversation to PDF
 */
export function exportToPDF(
  messages: Message[],
  options: ExportOptions = {}
): void {
  const {
    title = "Conversation Export",
    includeTimestamps = true,
    includeAgentInfo = true,
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, yPosition);
  yPosition += 15;

  // Export date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Exported: ${formatDate(new Date())}`, margin, yPosition);
  yPosition += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Messages
  messages.forEach((message, index) => {
    checkPageBreak(30);

    // Message header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    
    if (message.role === "user") {
      doc.setTextColor(147, 51, 234); // Purple
      doc.text("You", margin, yPosition);
    } else {
      doc.setTextColor(59, 130, 246); // Blue
      doc.text("Assistant", margin, yPosition);
    }

    // Timestamp
    if (includeTimestamps) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      const timestamp = formatDate(message.timestamp);
      doc.text(timestamp, pageWidth - margin - doc.getTextWidth(timestamp), yPosition);
    }

    yPosition += 7;

    // Agent info
    if (includeAgentInfo && message.agentUsed) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "italic");
      doc.text(`via Agent: ${message.agentUsed}`, margin + 5, yPosition);
      yPosition += 5;
    }

    // Message content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    const lines = doc.splitTextToSize(message.content, maxWidth - 10);
    lines.forEach((line: string) => {
      checkPageBreak(7);
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });

    yPosition += 8;

    // Separator between messages
    if (index < messages.length - 1) {
      checkPageBreak(5);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
    }
  });

  // Footer on last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const filename = `conversation_${new Date().getTime()}.pdf`;
  doc.save(filename);
}

/**
 * Generate PDF preview (returns base64)
 */
export function generatePDFPreview(
  messages: Message[],
  options: ExportOptions = {}
): string {
  const doc = new jsPDF();
  // ... same logic as exportToPDF but return base64
  return doc.output("dataurlstring");
}
