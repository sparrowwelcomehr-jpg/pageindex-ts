/**
 * Parser Factory
 * Factory pattern for creating document parsers
 * Follows Single Responsibility and Open/Closed principles
 */

import { DocumentParser } from './DocumentParser';
import { PDFParser } from './PDFParser';
import { HTMLParser } from './HTMLParser';
import { MarkdownParser } from './MarkdownParser';
import { TextParser } from './TextParser';
import { DocumentType } from '../types';

export class ParserFactory {
  private static parsers: DocumentParser[] = [];
  private static initialized = false;

  /**
   * Initialize all available parsers
   * Order matters - more specific parsers should come first
   */
  private static initialize(): void {
    if (this.initialized) return;

    this.parsers = [
      new PDFParser(),
      new HTMLParser(),
      new MarkdownParser(),
      new TextParser(), // Fallback parser - always works for text
    ];

    this.initialized = true;
  }

  /**
   * Get the appropriate parser for the given content
   */
  static getParser(content: Buffer | string, mimeType?: string): DocumentParser {
    this.initialize();

    for (const parser of this.parsers) {
      if (parser.canParse(content, mimeType)) {
        return parser;
      }
    }

    // Fallback to text parser
    return this.parsers[this.parsers.length - 1];
  }

  /**
   * Get parser by document type
   */
  static getParserByType(type: DocumentType): DocumentParser {
    this.initialize();

    const parser = this.parsers.find(p => p.getDocumentType() === type);
    if (!parser) {
      throw new Error(`No parser available for document type: ${type}`);
    }
    return parser;
  }

  /**
   * Register a custom parser
   * Allows extending the system without modifying existing code (Open/Closed)
   */
  static registerParser(parser: DocumentParser, priority: 'high' | 'low' = 'high'): void {
    this.initialize();

    if (priority === 'high') {
      // Add before the fallback parser
      this.parsers.splice(this.parsers.length - 1, 0, parser);
    } else {
      this.parsers.push(parser);
    }
  }

  /**
   * Get all registered parsers
   */
  static getAllParsers(): DocumentParser[] {
    this.initialize();
    return [...this.parsers];
  }

  /**
   * Detect document type from file extension
   */
  static getDocumentTypeFromExtension(filename: string): DocumentType | null {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'pdf':
        return 'pdf';
      case 'html':
      case 'htm':
        return 'html';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'txt':
      case 'text':
        return 'text';
      default:
        return null;
    }
  }

  /**
   * Detect document type from MIME type
   */
  static getDocumentTypeFromMime(mimeType: string): DocumentType | null {
    const mime = mimeType.toLowerCase();
    
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('html')) return 'html';
    if (mime.includes('markdown')) return 'markdown';
    if (mime.includes('text/plain')) return 'text';
    
    return null;
  }
}
