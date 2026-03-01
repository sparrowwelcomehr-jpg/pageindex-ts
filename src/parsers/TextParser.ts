/**
 * Plain Text Document Parser
 * Handles plain text files with basic section detection
 */

import { DocumentParser } from './DocumentParser';
import { ParsedDocument, DocumentSection } from '../types';

export class TextParser extends DocumentParser {
  constructor() {
    super('text');
  }

  canParse(content: Buffer | string, mimeType?: string): boolean {
    // Text parser is the fallback - can always parse
    if (mimeType && mimeType.includes('text/plain')) {
      return true;
    }
    
    // Check if content is valid text (not binary)
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    // Check for binary content (null bytes, etc.)
    const hasBinaryContent = /[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 1000));
    return !hasBinaryContent;
  }

  async parse(content: Buffer | string, sourceUrl?: string): Promise<ParsedDocument> {
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    // Extract sections based on patterns
    const sections = this.extractTextSections(text);
    
    // Extract title
    const title = this.extractTitle(text);
    
    return {
      content: text,
      metadata: {
        title,
        wordCount: this.countWords(text),
        sourceUrl,
        documentType: 'text'
      },
      sections
    };
  }

  /**
   * Extract sections from plain text using heuristics
   */
  private extractTextSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    
    let currentIndex = 0;
    
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const trimmed = line.trim();
      
      // Heuristics for detecting headers in plain text:
      // 1. ALL CAPS lines
      // 2. Lines followed by underlines (===== or -----)
      // 3. Numbered sections (1., 2., etc.)
      // 4. Short lines followed by blank line and content
      
      // Check for ALL CAPS headers
      if (this.isAllCapsHeader(trimmed)) {
        sections.push({
          level: 1,
          title: this.titleCase(trimmed),
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber: lineNumber + 1
        });
      }
      
      // Check for underlined headers
      if (lineNumber < lines.length - 1) {
        const nextLine = lines[lineNumber + 1].trim();
        if (nextLine.match(/^[=]+$/) && trimmed.length > 0) {
          sections.push({
            level: 1,
            title: trimmed,
            content: '',
            startIndex: currentIndex,
            endIndex: currentIndex + line.length + nextLine.length + 1,
            lineNumber: lineNumber + 1
          });
        } else if (nextLine.match(/^[-]+$/) && trimmed.length > 0) {
          sections.push({
            level: 2,
            title: trimmed,
            content: '',
            startIndex: currentIndex,
            endIndex: currentIndex + line.length + nextLine.length + 1,
            lineNumber: lineNumber + 1
          });
        }
      }
      
      // Check for numbered sections
      const numberedMatch = trimmed.match(/^(\d+\.)+\s*(.+)$/);
      if (numberedMatch) {
        const depth = (numberedMatch[1].match(/\./g) || []).length;
        sections.push({
          level: Math.min(depth, 6),
          title: numberedMatch[2].trim(),
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber: lineNumber + 1
        });
      }
      
      currentIndex += line.length + 1;
    }
    
    // Remove duplicate sections at same position
    const uniqueSections = this.deduplicateSections(sections);
    
    // Fill content
    this.fillSectionContent(uniqueSections, text);
    
    return uniqueSections;
  }

  private isAllCapsHeader(text: string): boolean {
    return text.length > 3 && 
           text.length < 100 &&
           text === text.toUpperCase() &&
           /^[A-Z\s\d]+$/.test(text) &&
           text.split(' ').length <= 10;
  }

  private titleCase(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  private deduplicateSections(sections: DocumentSection[]): DocumentSection[] {
    const seen = new Map<number, DocumentSection>();
    
    for (const section of sections) {
      const existing = seen.get(section.startIndex);
      if (!existing || existing.title.length < section.title.length) {
        seen.set(section.startIndex, section);
      }
    }
    
    return Array.from(seen.values()).sort((a, b) => a.startIndex - b.startIndex);
  }

  private fillSectionContent(sections: DocumentSection[], text: string): void {
    for (let i = 0; i < sections.length; i++) {
      const nextSection = sections[i + 1];
      const endIndex = nextSection ? nextSection.startIndex : text.length;
      const contentStart = sections[i].endIndex + 1;
      
      if (contentStart < endIndex) {
        sections[i].content = text.substring(contentStart, endIndex).trim();
      }
      sections[i].endIndex = endIndex;
    }
  }

  private extractTitle(text: string): string {
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
