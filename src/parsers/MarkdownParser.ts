/**
 * Markdown Document Parser
 * Parses markdown files and extracts structured content
 */

import { DocumentParser } from './DocumentParser';
import { ParsedDocument, DocumentSection } from '../types';

export class MarkdownParser extends DocumentParser {
  constructor() {
    super('markdown');
  }

  canParse(content: Buffer | string, mimeType?: string): boolean {
    // Check MIME type
    if (mimeType && (mimeType.includes('markdown') || mimeType.includes('text/markdown'))) {
      return true;
    }
    
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    // Check for markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // Headers
      /^\s*[-*+]\s+/m,         // Unordered lists
      /^\s*\d+\.\s+/m,         // Ordered lists
      /\[.+\]\(.+\)/,          // Links
      /!\[.+\]\(.+\)/,         // Images
      /```[\s\S]*?```/,        // Code blocks
      /\*\*.+\*\*/,            // Bold
      /__.+__/,                // Bold alternate
      /\*.+\*/,                // Italic
      /_.+_/                   // Italic alternate
    ];
    
    // Return true if we find multiple markdown patterns
    const matchCount = markdownPatterns.filter(pattern => pattern.test(text)).length;
    return matchCount >= 2;
  }

  async parse(content: Buffer | string, sourceUrl?: string): Promise<ParsedDocument> {
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    // Extract sections
    const sections = this.extractMarkdownSections(text);
    
    // Extract title from first H1 or first line
    const title = this.extractTitle(text, sections);
    
    return {
      content: text,
      metadata: {
        title,
        wordCount: this.countWords(text),
        sourceUrl,
        documentType: 'markdown'
      },
      sections
    };
  }

  /**
   * Extract sections from markdown based on headers
   */
  private extractMarkdownSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    
    const headerRegex = /^(#{1,6})\s+(.+)$/;
    let currentIndex = 0;
    
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const trimmed = line.trim();
      
      const match = trimmed.match(headerRegex);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        
        sections.push({
          level,
          title,
          content: '',
          startIndex: currentIndex,
          endIndex: currentIndex + line.length,
          lineNumber: lineNumber + 1
        });
      }
      
      // Also detect setext-style headers (underlined with = or -)
      if (lineNumber > 0 && (trimmed === '===' || trimmed.match(/^=+$/) || 
                             trimmed === '---' || trimmed.match(/^-+$/))) {
        const prevLine = lines[lineNumber - 1].trim();
        if (prevLine && !prevLine.startsWith('#')) {
          const level = trimmed.startsWith('=') ? 1 : 2;
          const prevLineStart = currentIndex - lines[lineNumber - 1].length - 1;
          
          sections.push({
            level,
            title: prevLine,
            content: '',
            startIndex: prevLineStart,
            endIndex: currentIndex + line.length,
            lineNumber: lineNumber
          });
        }
      }
      
      currentIndex += line.length + 1;
    }
    
    // Sort by start index and remove duplicates
    sections.sort((a, b) => a.startIndex - b.startIndex);
    
    // Fill content for each section
    this.fillSectionContent(sections, text);
    
    return sections;
  }

  /**
   * Fill content for each section (text between this header and the next)
   */
  private fillSectionContent(sections: DocumentSection[], text: string): void {
    for (let i = 0; i < sections.length; i++) {
      const nextSection = sections[i + 1];
      const endIndex = nextSection ? nextSection.startIndex : text.length;
      const contentStart = sections[i].endIndex + 1;
      
      if (contentStart < endIndex) {
        let content = text.substring(contentStart, endIndex).trim();
        
        // Clean up markdown artifacts
        content = this.cleanContent(content);
        
        sections[i].content = content;
      }
      sections[i].endIndex = endIndex;
    }
  }

  /**
   * Clean markdown content for better readability
   */
  private cleanContent(content: string): string {
    return content
      // Remove markdown image syntax but keep alt text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]')
      // Simplify bold/italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Remove extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract document title
   */
  private extractTitle(text: string, sections: DocumentSection[]): string {
    // Look for first H1
    const h1Section = sections.find(s => s.level === 1);
    if (h1Section) {
      return h1Section.title;
    }
    
    // Look for YAML frontmatter title
    const frontmatterMatch = text.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?\n[\s\S]*?---/);
    if (frontmatterMatch) {
      return frontmatterMatch[1].trim();
    }
    
    // Use first line
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (firstLine.length > 0 && firstLine.length < 200) {
      return firstLine;
    }
    
    return 'Untitled Document';
  }
}
