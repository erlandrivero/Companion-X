"use client";

import { useState } from "react";
import { X, Copy, Download, Check, Code2, FileText, Eye } from "lucide-react";
import type { Artifact } from "@/lib/artifacts/artifactDetector";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ArtifactViewerProps {
  artifacts: Artifact[];
  onClose: () => void;
}

export function ArtifactViewer({ artifacts, onClose }: ArtifactViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  if (artifacts.length === 0) return null;
  
  const currentArtifact = artifacts[selectedIndex];
  const canPreview = currentArtifact.type === 'html' || currentArtifact.type === 'svg';
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    const blob = new Blob([currentArtifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentArtifact.fileName || 'artifact.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-1/2 lg:w-2/5 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {currentArtifact.type === 'code' || currentArtifact.type === 'react' ? (
            <Code2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          ) : (
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          )}
          <h2 className="text-lg font-semibold">{currentArtifact.title}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-lg transition-colors ${
                showPreview 
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={showPreview ? "Show code" : "Show preview"}
            >
              <Eye className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
          
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Download file"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Tabs (if multiple artifacts) */}
      {artifacts.length > 1 && (
        <div className="flex gap-2 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {artifacts.map((artifact, index) => (
            <button
              key={artifact.id}
              onClick={() => setSelectedIndex(index)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                index === selectedIndex
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {artifact.title}
            </button>
          ))}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {showPreview && canPreview ? (
          // Preview mode for HTML/SVG
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {currentArtifact.type === 'html' ? (
              <iframe
                srcDoc={currentArtifact.content}
                className="w-full h-[600px] border-0"
                sandbox="allow-scripts"
                title="HTML Preview"
              />
            ) : currentArtifact.type === 'svg' ? (
              <div 
                className="p-4 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: currentArtifact.content }}
              />
            ) : null}
          </div>
        ) : (
          // Code view with syntax highlighting
          <div className="rounded-lg overflow-hidden">
            <SyntaxHighlighter
              language={currentArtifact.language || 'text'}
              style={vscDarkPlus}
              showLineNumbers
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              {currentArtifact.content}
            </SyntaxHighlighter>
          </div>
        )}
        
        {/* Metadata */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div>Type: {currentArtifact.type}</div>
          {currentArtifact.language && <div>Language: {currentArtifact.language}</div>}
          <div>Size: {currentArtifact.content.length} characters</div>
          <div>Lines: {currentArtifact.content.split('\n').length}</div>
        </div>
      </div>
    </div>
  );
}
