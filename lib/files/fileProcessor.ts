/**
 * File Processing Utility
 * Extracts content from various file types for Claude context
 */

import mammoth from 'mammoth';
// @ts-ignore - pdf-parse has module resolution issues
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface ProcessedFile {
  name: string;
  type: string;
  size: number;
  content: string;
  isImage: boolean;
  base64?: string;
}

/**
 * Process uploaded file and extract content
 */
export async function processFile(file: File): Promise<ProcessedFile> {
  const isImage = file.type.startsWith('image/');
  
  // For images, convert to base64
  if (isImage) {
    const base64 = await fileToBase64(file);
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      content: `[Image: ${file.name}]`,
      isImage: true,
      base64,
    };
  }
  
  // For text-based files, extract text content
  const content = await extractTextContent(file);
  
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content,
    isImage: false,
  };
}

/**
 * Convert file to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract text content from file
 */
async function extractTextContent(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  // Plain text files
  if (
    fileType === 'text/plain' ||
    fileType === 'text/markdown' ||
    fileType === 'text/csv' ||
    fileType === 'application/json' ||
    fileType === 'application/xml' ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.xml') ||
    fileName.endsWith('.js') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('.tsx') ||
    fileName.endsWith('.jsx') ||
    fileName.endsWith('.py') ||
    fileName.endsWith('.java') ||
    fileName.endsWith('.cpp') ||
    fileName.endsWith('.c') ||
    fileName.endsWith('.go') ||
    fileName.endsWith('.rs') ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.css') ||
    fileName.endsWith('.sql')
  ) {
    return await file.text();
  }
  
  // PDF files - extract text using pdf-parse
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdfParse(buffer);
      return `[PDF Document: ${file.name}]\n\n${data.text}`;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return `[PDF Document: ${file.name}]\nError extracting text from PDF. The file may be corrupted or password-protected.`;
    }
  }
  
  // DOCX files - extract text using mammoth
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return `[Word Document: ${file.name}]\n\n${result.value}`;
    } catch (error) {
      console.error('DOCX extraction error:', error);
      return `[Word Document: ${file.name}]\nError extracting text from DOCX. The file may be corrupted.`;
    }
  }
  
  // Unsupported file type
  return `[Unsupported file type: ${file.type || 'unknown'}]\nFile name: ${file.name}\nPlease use text-based files (.txt, .md, .json, .csv, code files) or images.`;
}

/**
 * Format file content for Claude context
 */
export function formatFileForContext(processedFile: ProcessedFile): string {
  if (processedFile.isImage) {
    return `[Attached Image: ${processedFile.name}]`;
  }
  
  return `--- BEGIN FILE: ${processedFile.name} ---
${processedFile.content}
--- END FILE: ${processedFile.name} ---`;
}

/**
 * Validate file size (max 10MB for now)
 */
export function validateFileSize(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Get supported file types
 */
export function getSupportedFileTypes(): string[] {
  return [
    // Text
    '.txt', '.md', '.csv', '.json', '.xml',
    // Code
    '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs',
    '.html', '.css', '.sql', '.sh', '.yaml', '.yml',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    // Documents (limited support for now)
    '.pdf', '.docx',
  ];
}
