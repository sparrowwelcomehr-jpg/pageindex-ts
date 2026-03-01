/**
 * PDF Document Parser
 * Uses pdf-parse library to extract text from PDFs
 * Preserves page boundaries for proper indexing
 */

import { DocumentParser } from './DocumentParser';
import { ParsedDocument, DocumentSection } from '../types';
import pdf from 'pdf-parse';

export class PDFParser extends DocumentParser {
  constructor() {
    super('pdf');
  }

  canParse(content: Buffer | string, mimeType?: string): boolean {
    // Check MIME type
    if (mimeType && mimeType.includes('pdf')) {
      return true;
    }
    
    // Check for PDF magic number (%PDF-)
    if (Buffer.isBuffer(content)) {
      const header = content.slice(0, 5).toString('utf-8');
      return header === '%PDF-';
    }
    
    return false;
  }

  async parse(content: Buffer | string, sourceUrl?: string): Promise<ParsedDocument> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    
    try {
      // Custom page render function to capture per-page text
      const pages: string[] = [];
      let currentPage = '';
      
      const options = {
        pagerender: function(pageData: any) {
          return pageData.getTextContent()
            .then(function(textContent: any) {
              let text = '';
              let lastY: number | null = null;
              
              for (const item of textContent.items) {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                  text += '\n';
                } else if (lastY !== null && text.length > 0 && !text.endsWith(' ') && !text.endsWith('\n')) {
                  text += ' ';
                }
                text += item.str;
                lastY = item.transform[5];
              }
              
              pages.push(text);
              return text;
            });
        }
      };

      const data = await pdf(buffer, options);
      
      // Join pages with form feed character for page boundaries
      const text = pages.join('\f');
      const sections = this.extractPDFSections(text);
      
      return {
        content: text,
        metadata: {
          title: data.info?.Title || this.extractTitleFromContent(pages[0] || text),
          author: data.info?.Author,
          pageCount: data.numpages,
          wordCount: this.countWords(text),
          sourceUrl,
          documentType: 'pdf'
        },
        sections
      };
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
    }
  }

  /**
   * Extract sections from PDF text
   * PDFs often don't have markdown-style headers, so we use heuristics
   */
  private extractPDFSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    
    let currentIndex = 0;
    let lineNumber = 0;
    
    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();
      
      // Heuristics for detecting headers in PDFs:
      // 1. All caps lines (likely section headers)
      // 2. Short lines followed by longer content
      // 3. Lines that end without punctuation and are followed by content
      
      const isAllCaps = trimmed.length > 3 && 
                        trimmed === trimmed.toUpperCase() && 
                        /^[A-Z\s\d]+$/.test(trimmed);
      
      const isShortLine = trimmed.length > 2 && 
                          trimmed.length < 80 && 
                          !trimmed.endsWith('.') &&
                          !trimmed.endsWith(',');
      
      // Check for numbered sections like "1.", "1.1", "Chapter 1"
      const isNumberedHeader = /^(\d+\.|\d+\.\d+|chapter\s+\d+|section\s+\d+)/i.test(trimmed);
      
      if (isAllCaps || isNumberedHeader) {
        // Determine level based on pattern
        let level = 1;
        if (/^\d+\.\d+/.test(trimmed)) level = 2;
        if (/^\d+\.\d+\.\d+/.test(trimmed)) level = 3;
        
        sections.push({
          level,
          title: this.cleanTitle(trimmed),
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber
        });
      }
      
      currentIndex += line.length + 1;
    }
    
    // Fill content for each section
    this.fillSectionContent(sections, text);
    
    return sections;
  }

  private cleanTitle(title: string): string {
    // Remove numbering prefixes for cleaner titles
    return title
      .replace(/^\d+\.\d+\.\d+\s*/, '')
      .replace(/^\d+\.\d+\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^chapter\s+\d+\s*[:.-]?\s*/i, '')
      .replace(/^section\s+\d+\s*[:.-]?\s*/i, '')
      .trim();
  }

  private fillSectionContent(sections: DocumentSection[], text: string): void {
    for (let i = 0; i < sections.length; i++) {
      const nextSection = sections[i + 1];
      const endIndex = nextSection ? nextSection.startIndex : text.length;
      const startIndex = sections[i].endIndex + 1;
      
      if (startIndex < endIndex) {
        sections[i].content = text.substring(startIndex, endIndex).trim();
      }
      sections[i].endIndex = endIndex;
    }
  }

  private extractTitleFromContent(text: string): string {
    // Use first non-empty line as title
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 200) {
        return trimmed;
      }
    }
    return 'Untitled Document';
  }
}
