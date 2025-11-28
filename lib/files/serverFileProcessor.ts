/**
 * Server-Side File Processing
 * Handles PDF and DOCX extraction using Node.js libraries
 */

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Extract text from Excel file
 */
export async function extractExcelText(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let result = `[Excel Document: ${fileName}]\n\n`;
    
    // Process each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(sheet);
      
      result += `--- Sheet ${index + 1}: ${sheetName} ---\n`;
      result += csvData + '\n\n';
    });
    
    return result;
  } catch (error) {
    console.error('Excel extraction error:', error);
    return `[Excel Document: ${fileName}]\nError extracting data from Excel file. The file may be corrupted.`;
  }
}

/**
 * Extract text from PDF file
 * Note: PDF extraction is currently disabled due to Node.js compatibility issues
 */
export async function extractPdfText(buffer: Buffer, fileName: string): Promise<string> {
  return `[PDF Document: ${fileName}]\n\nPDF text extraction is currently unavailable. Please copy and paste the text content from your PDF, or I can help you with the document in another format.`;
}

/**
 * Extract text from DOCX file
 */
export async function extractDocxText(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return `[Word Document: ${fileName}]\n\n${result.value}`;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    return `[Word Document: ${fileName}]\nError extracting text from DOCX. The file may be corrupted.`;
  }
}

/**
 * Process file on server and extract text content
 */
export async function processFileOnServer(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;
  
  // Get file as buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await extractPdfText(buffer, file.name);
  }
  
  // DOCX files
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    return await extractDocxText(buffer, file.name);
  }
  
  // Excel files
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls')
  ) {
    return await extractExcelText(buffer, file.name);
  }
  
  // For other files, just read as text
  return await file.text();
}
