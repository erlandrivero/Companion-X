/**
 * Artifact Detection and Processing
 * Detects when Claude generates substantial content that should be displayed as artifacts
 */

export type ArtifactType = 
  | 'code'
  | 'html'
  | 'react'
  | 'markdown'
  | 'mermaid'
  | 'svg'
  | 'json'
  | 'csv';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  fileName?: string;
}

/**
 * Detect if response contains artifacts
 */
export function detectArtifacts(response: string): Artifact[] {
  const artifacts: Artifact[] = [];
  
  // Detect code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
  let match;
  let index = 0;
  
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1] || 'text';
    const content = match[2].trim();
    
    // Only create artifact if code block is substantial (>50 characters)
    if (content.length > 50) {
      const artifactType = determineArtifactType(language, content);
      
      artifacts.push({
        id: `artifact-${Date.now()}-${index}`,
        type: artifactType,
        title: generateTitle(artifactType, language),
        content,
        language,
        fileName: generateFileName(artifactType, language),
      });
      
      index++;
    }
  }
  
  return artifacts;
}

/**
 * Determine artifact type based on language and content
 */
function determineArtifactType(language: string, content: string): ArtifactType {
  const lowerLang = language.toLowerCase();
  
  // React/JSX
  if (lowerLang === 'jsx' || lowerLang === 'tsx' || content.includes('import React')) {
    return 'react';
  }
  
  // HTML
  if (lowerLang === 'html' || content.includes('<!DOCTYPE') || content.includes('<html')) {
    return 'html';
  }
  
  // Markdown
  if (lowerLang === 'markdown' || lowerLang === 'md') {
    return 'markdown';
  }
  
  // Mermaid diagrams
  if (lowerLang === 'mermaid') {
    return 'mermaid';
  }
  
  // SVG
  if (lowerLang === 'svg' || content.includes('<svg')) {
    return 'svg';
  }
  
  // JSON
  if (lowerLang === 'json') {
    return 'json';
  }
  
  // CSV
  if (lowerLang === 'csv') {
    return 'csv';
  }
  
  // Default to code
  return 'code';
}

/**
 * Generate title for artifact
 */
function generateTitle(type: ArtifactType, language?: string): string {
  switch (type) {
    case 'react':
      return 'React Component';
    case 'html':
      return 'HTML Document';
    case 'markdown':
      return 'Markdown Document';
    case 'mermaid':
      return 'Diagram';
    case 'svg':
      return 'SVG Graphic';
    case 'json':
      return 'JSON Data';
    case 'csv':
      return 'CSV Data';
    case 'code':
      return language ? `${language.toUpperCase()} Code` : 'Code';
    default:
      return 'Document';
  }
}

/**
 * Generate file name for download
 */
function generateFileName(type: ArtifactType, language?: string): string {
  const timestamp = Date.now();
  
  switch (type) {
    case 'react':
      return `component-${timestamp}.tsx`;
    case 'html':
      return `document-${timestamp}.html`;
    case 'markdown':
      return `document-${timestamp}.md`;
    case 'mermaid':
      return `diagram-${timestamp}.mmd`;
    case 'svg':
      return `graphic-${timestamp}.svg`;
    case 'json':
      return `data-${timestamp}.json`;
    case 'csv':
      return `data-${timestamp}.csv`;
    case 'code':
      const ext = getFileExtension(language);
      return `code-${timestamp}.${ext}`;
    default:
      return `file-${timestamp}.txt`;
  }
}

/**
 * Get file extension for language
 */
function getFileExtension(language?: string): string {
  if (!language) return 'txt';
  
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rs',
    ruby: 'rb',
    php: 'php',
    swift: 'swift',
    kotlin: 'kt',
    sql: 'sql',
    bash: 'sh',
    shell: 'sh',
    yaml: 'yml',
  };
  
  return extensions[language.toLowerCase()] || language.toLowerCase();
}

/**
 * Remove artifacts from response text (for clean chat display)
 */
export function removeArtifactsFromResponse(response: string): string {
  // Remove code blocks that are artifacts
  return response.replace(/```(\w+)?\n[\s\S]+?```/g, (match, language) => {
    const content = match.replace(/```\w*\n/, '').replace(/```$/, '').trim();
    
    // Keep small code blocks inline, remove large ones (they're in artifacts)
    if (content.length > 50) {
      return `[See artifact: ${generateTitle(determineArtifactType(language || '', content), language)}]`;
    }
    
    return match;
  });
}
