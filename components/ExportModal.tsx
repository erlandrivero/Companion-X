"use client";

import { useState } from "react";
import { X, FileText, FileDown, Loader2, FileJson, FileCode, Table } from "lucide-react";
import { Message } from "@/types/conversation";
import { useToast } from "@/contexts/ToastContext";
import { exportToPDF } from "@/lib/export/pdfExport";
import { exportToDOCX } from "@/lib/export/docxExport";
import { exportToMarkdown } from "@/lib/export/markdownExport";
import { exportToJSON } from "@/lib/export/jsonExport";
import { exportToHTML } from "@/lib/export/htmlExport";
import { exportToCSV } from "@/lib/export/csvExport";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  conversationTitle?: string;
}

export function ExportModal({
  isOpen,
  onClose,
  messages,
  conversationTitle = "Conversation",
}: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeAgentInfo, setIncludeAgentInfo] = useState(true);
  const [customTitle, setCustomTitle] = useState(conversationTitle);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      exportToPDF(messages, {
        title: customTitle,
        includeTimestamps,
        includeAgentInfo,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("Failed to export PDF. Please try again.", "error");
      setIsExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    setIsExporting(true);
    try {
      await exportToDOCX(messages, {
        title: customTitle,
        includeTimestamps,
        includeAgentInfo,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("DOCX export error:", error);
      showToast("Failed to export DOCX. Please try again.", "error");
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = () => {
    setIsExporting(true);
    try {
      exportToMarkdown(messages, {
        title: customTitle,
        includeTimestamps,
        includeAgentInfo,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Markdown export error:", error);
      showToast("Failed to export Markdown. Please try again.", "error");
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      exportToJSON(messages, {
        title: customTitle,
        includeMetadata: true,
        prettyPrint: true,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("JSON export error:", error);
      showToast("Failed to export JSON. Please try again.", "error");
      setIsExporting(false);
    }
  };

  const handleExportHTML = () => {
    setIsExporting(true);
    try {
      exportToHTML(messages, {
        title: customTitle,
        includeTimestamps,
        includeAgentInfo,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("HTML export error:", error);
      showToast("Failed to export HTML. Please try again.", "error");
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      exportToCSV(messages, {
        title: customTitle,
        includeTimestamps,
        includeAgentInfo,
      });
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error("CSV export error:", error);
      showToast("Failed to export CSV. Please try again.", "error");
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileDown className="w-5 h-5 text-purple-500" />
            Export Conversation
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isExporting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isExporting}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                disabled={isExporting}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include timestamps
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAgentInfo}
                onChange={(e) => setIncludeAgentInfo(e.target.checked)}
                className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500"
                disabled={isExporting}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include agent information
              </span>
            </label>
          </div>

          {/* Stats */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Total messages:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {messages.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>User messages:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {messages.filter((m) => m.role === "user").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Assistant messages:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {messages.filter((m) => m.role === "assistant").length}
                </span>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </button>

            <button
              onClick={handleExportDOCX}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              DOCX
            </button>

            <button
              onClick={handleExportMarkdown}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
              Markdown
            </button>

            <button
              onClick={handleExportHTML}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
              HTML
            </button>

            <button
              onClick={handleExportJSON}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              JSON
            </button>

            <button
              onClick={handleExportCSV}
              disabled={isExporting || messages.length === 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
              CSV
            </button>
          </div>

          {messages.length === 0 && (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              No messages to export
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
