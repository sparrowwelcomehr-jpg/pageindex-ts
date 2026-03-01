/**
 * HTML Document Parser
 * Uses cheerio to parse HTML and extract structured content
 */

import { DocumentParser } from './DocumentParser';
import { ParsedDocument, DocumentSection } from '../types';
import * as cheerio from 'cheerio';
import type { Element, AnyNode } from 'domhandler';

export class HTMLParser extends DocumentParser {
  constructor() {
    super('html');
  }

  canParse(content: Buffer | string, mimeType?: string): boolean {
    // Check MIME type
    if (mimeType && (mimeType.includes('html') || mimeType.includes('text/html'))) {
      return true;
    }
    
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    // Check for HTML markers
    const htmlPatterns = [
      /<!doctype\s+html/i,
      /<html/i,
      /<head/i,
      /<body/i
    ];
    
    return htmlPatterns.some(pattern => pattern.test(text));
  }

  async parse(content: Buffer | string, sourceUrl?: string): Promise<ParsedDocument> {
    const html = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    const $ = cheerio.load(html);
    
    // Remove script, style, and other non-content elements
    $('script, style, nav, footer, header, aside, noscript, iframe').remove();
    
    // Extract title
    const title = $('title').first().text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled Document';
    
    // Convert HTML to markdown-like text with headers preserved
    const markdownContent = this.htmlToMarkdown($);
    
    // Extract sections based on headers
    const sections = this.extractHTMLSections($);
    
    return {
      content: markdownContent,
      metadata: {
        title,
        wordCount: this.countWords(markdownContent),
        sourceUrl,
        documentType: 'html'
      },
      sections
    };
  }

  /**
   * Convert HTML to markdown-like text format
   */
  private htmlToMarkdown($: cheerio.CheerioAPI): string {
    const lines: string[] = [];
    
    // Process body content - use type assertion to handle the union type
    const bodyElement = $('body');
    const rootElement = $.root();
    
    // Find all text-containing elements in order
    const elements = bodyElement.length 
      ? bodyElement.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, code, div, span, a')
      : rootElement.find('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, code, div, span, a');
    
    elements.each((_, el) => {
      const element = el as Element;
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase() || '';
      
      // Skip if this element has child headers (to avoid duplication)
      if ($el.find('h1, h2, h3, h4, h5, h6').length > 0 && !tagName.startsWith('h')) {
        return;
      }
      
      let text = '';
      
      if (tagName.startsWith('h')) {
        const level = parseInt(tagName[1], 10);
        const hashes = '#'.repeat(level);
        text = `${hashes} ${$el.text().trim()}`;
      } else if (tagName === 'li') {
        text = `- ${$el.text().trim()}`;
      } else if (tagName === 'blockquote') {
        text = `> ${$el.text().trim()}`;
      } else if (tagName === 'pre' || tagName === 'code') {
        text = '```\n' + $el.text().trim() + '\n```';
      } else if (tagName === 'p' || tagName === 'div') {
        // Only add if it has direct text content
        const directText = $el.clone().children().remove().end().text().trim();
        if (directText) {
          text = directText;
        }
      }
      
      if (text && text.trim()) {
        lines.push(text);
      }
    });
    
    // Deduplicate and clean
    const seen = new Set<string>();
    const uniqueLines: string[] = [];
    
    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      if (!seen.has(normalized) && line.trim()) {
        seen.add(normalized);
        uniqueLines.push(line);
      }
    }
    
    return uniqueLines.join('\n\n');
  }

  /**
   * Extract sections from HTML based on header elements
   */
  private extractHTMLSections($: cheerio.CheerioAPI): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const bodyElement = $('body');
    const rootElement = $.root();
    
    const fullText = bodyElement.length ? bodyElement.text() : rootElement.text();
    
    let lineNumber = 0;
    
    const headers = bodyElement.length 
      ? bodyElement.find('h1, h2, h3, h4, h5, h6')
      : rootElement.find('h1, h2, h3, h4, h5, h6');
    
    headers.each((_, el) => {
      const element = el as Element;
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase() || '';
      if (!tagName.startsWith('h')) return;
      
      const level = parseInt(tagName[1], 10);
      const title = $el.text().trim();
      
      if (!title) return;
      
      lineNumber++;
      
      // Get content until next header
      let content = '';
      let current = $el.next();
      
      while (current.length && !current.is('h1, h2, h3, h4, h5, h6')) {
        const text = current.text().trim();
        if (text) {
          content += text + '\n';
        }
        current = current.next();
      }
      
      // Calculate approximate position in text
      const startIndex = fullText.indexOf(title);
      const contentStart = startIndex + title.length;
      const contentInFull = content.trim().substring(0, 100);
      const endIndex = contentInFull ? 
        fullText.indexOf(contentInFull, contentStart) + content.length :
        contentStart;
      
      sections.push({
        level,
        title,
        content: content.trim(),
        startIndex: Math.max(0, startIndex),
        endIndex: Math.max(startIndex + 1, endIndex),
        lineNumber
      });
    });
    
    return sections;
  }
}
