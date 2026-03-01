/**
 * Core type definitions for PageIndex
 * Following Interface Segregation Principle (ISP)
 */

// Document types supported
export type DocumentType = 'pdf' | 'html' | 'markdown' | 'text';

// Parsed document structure
export interface ParsedDocument {
  content: string;
  metadata: DocumentMetadata;
  sections: DocumentSection[];
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  createdAt?: Date;
  pageCount?: number;
  wordCount?: number;
  sourceUrl?: string;
  documentType: DocumentType;
}

export interface DocumentSection {
  level: number;  // Header level (1-6)
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
}

// Tree node structure for indexed document (matches Python PageIndex format)
export interface TreeNode {
  node_id: string;
  title: string;
  summary: string;
  content?: string;
  start_index: number;
  end_index: number;
  nodes: TreeNode[];  // 'nodes' to match Python, not 'children'
}

// Indexed document structure (matches Python PageIndex format)
export interface IndexedDocument {
  doc_name: string;  // matches Python
  structure: TreeNode[];
  metadata?: DocumentMetadata;
  // Additional fields for TS implementation
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Search result structure
export interface SearchResult {
  node_id: string;
  title: string;
  content: string;
  summary: string;
  score: number;
  path: string[];  // Breadcrumb path to this node
  reasoning?: string;
}

// Search options
export interface SearchOptions {
  topK?: number;
  maxIterations?: number;
  confidenceThreshold?: number;
  includeReasoning?: boolean;
}

// LLM response for tree search
export interface LLMSearchResponse {
  selectedNodes: string[];
  reasoning: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  foundAnswer: boolean;
}

// Configuration for the system
export interface PageIndexConfig {
  openaiApiKey?: string;
  openaiModel?: string;
  dataDir?: string;
  maxTokens?: number;
  llmProvider?: LLMProvider;  // Custom LLM provider (optional)
}

// LLM Provider interface - implement this for custom LLMs
export interface LLMProvider {
  /**
   * Send a chat completion request to the LLM
   * @param messages - Array of messages in the conversation
   * @param options - Optional parameters (temperature, max_tokens, etc.)
   * @returns The LLM's response text
   */
  chat(
    messages: LLMMessage[],
    options?: LLMRequestOptions
  ): Promise<string>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}
