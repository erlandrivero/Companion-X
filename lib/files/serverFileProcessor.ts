/**
 * Server-Side File Processing
 * Handles PDF and DOCX extraction using Node.js libraries
 */

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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
 * Extract text from PDF file using pdfjs-dist
 */
export async function extractPdfText(buffer: Buffer, fileName: string): Promise<string> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    let fullText = `[PDF Document: ${fileName}]\n\n`;
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
    }
    
    // Check if we got any meaningful text
    if (fullText.replace(`[PDF Document: ${fileName}]\n\n`, '').trim().length < 50) {
      return `[PDF Document: ${fileName}]\n\nNote: This PDF appears to contain primarily images or scanned content. Text extraction works best with text-based PDFs. If this is a scanned document, please:\n1. Copy and paste the text directly, or\n2. Use OCR software to convert it to text first, or\n3. Describe what you'd like help with from the document.`;
    }
    
    return fullText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    return `[PDF Document: ${fileName}]\n\nError extracting text from PDF. The file may be:\n- Corrupted or password-protected\n- Contains only images/scans (no extractable text)\n- In an unsupported format\n\nPlease try copying and pasting the text content directly, or let me know what you need help with.`;
  }
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
