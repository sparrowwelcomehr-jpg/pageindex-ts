/**
 * Document Parser Interface
 * Following Interface Segregation Principle (ISP) and Dependency Inversion (DIP)
 */

import { ParsedDocument, DocumentType } from '../types';

/**
 * Abstract base class for document parsers
 * Follows Open/Closed Principle - open for extension, closed for modification
 */
export abstract class DocumentParser {
  protected documentType: DocumentType;

  constructor(documentType: DocumentType) {
    this.documentType = documentType;
  }

  /**
   * Check if this parser can handle the given content/file
   */
  abstract canParse(content: Buffer | string, mimeType?: string): boolean;

  /**
   * Parse the document content
   */
  abstract parse(content: Buffer | string, sourceUrl?: string): Promise<ParsedDocument>;

  /**
   * Get the document type this parser handles
   */
  getDocumentType(): DocumentType {
    return this.documentType;
  }

  /**
   * Extract sections with headers from text content
   */
  protected extractSections(text: string): { level: number; title: string; content: string; startIndex: number; endIndex: number; lineNumber: number }[] {
    const sections: { level: number; title: string; content: string; startIndex: number; endIndex: number; lineNumber: number }[] = [];
    const lines = text.split('\n');
    
    let currentIndex = 0;
    let lineNumber = 0;
    
    // Regex patterns for different header formats
    const markdownHeaderRegex = /^(#{1,6})\s+(.+)$/;
    const htmlHeaderRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/i;
    
    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      // Check for markdown headers
      const mdMatch = trimmedLine.match(markdownHeaderRegex);
      if (mdMatch) {
        sections.push({
          level: mdMatch[1].length,
          title: mdMatch[2].trim(),
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber
        });
      }
      
      // Check for HTML headers
      const htmlMatch = trimmedLine.match(htmlHeaderRegex);
      if (htmlMatch) {
        sections.push({
          level: parseInt(htmlMatch[1], 10),
          title: htmlMatch[2].trim(),
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber
        });
      }
      
      currentIndex += line.length + 1; // +1 for newline
    }
    
    // Fill in content for each section
    for (let i = 0; i < sections.length; i++) {
      const nextSection = sections[i + 1];
      const endIndex = nextSection ? nextSection.startIndex : text.length;
      sections[i].content = text.substring(sections[i].endIndex + 1, endIndex).trim();
      sections[i].endIndex = endIndex;
    }
    
    return sections;
  }

  /**
   * Count words in text
   */
  protected countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}
