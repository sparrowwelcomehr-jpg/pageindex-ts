/**
 * PageIndex Core
 * Main orchestrator class that combines all components
 * Follows Facade pattern for simplified API
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { 
  PageIndexConfig, 
  ParsedDocument, 
  IndexedDocument, 
  SearchResult, 
  SearchOptions,
  TreeNode 
} from '../types';
import { ParserFactory } from '../parsers';
import { TreeBuilder, LLMTreeBuilder, LLMTreeSearcher, IndexManager } from '../services';

export interface IndexOptions {
  name?: string;
  generateSummaries?: boolean;
  includeContent?: boolean;
  useLLMTreeBuilder?: boolean;  // Use LLM to generate structure like Python
}

export class PageIndex {
  private config: PageIndexConfig;
  private treeBuilder: TreeBuilder;
  private llmTreeBuilder: LLMTreeBuilder;
  private searcher: LLMTreeSearcher;
  private indexManager: IndexManager;

  constructor(config: PageIndexConfig) {
    this.config = {
      openaiModel: 'gpt-4o-mini',
      dataDir: './data',
      maxTokens: 4000,
      ...config
    };

    this.treeBuilder = new TreeBuilder({
      generateSummaries: true,
      maxSummaryLength: 500
    });

    // Pass llmProvider if provided, otherwise use OpenAI with API key
    this.llmTreeBuilder = new LLMTreeBuilder({
      openaiApiKey: config.openaiApiKey,
      model: this.config.openaiModel,
      llmProvider: config.llmProvider
    });

    this.searcher = new LLMTreeSearcher({
      openaiApiKey: config.openaiApiKey,
      model: this.config.openaiModel,
      llmProvider: config.llmProvider
    });

    this.indexManager = new IndexManager({
      dataDir: this.config.dataDir || './data'
    });
  }

  /**
   * Index a document from URL
   */
  async indexFromUrl(url: string, options: IndexOptions = {}): Promise<IndexedDocument> {
    // Fetch content from URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'PageIndex/1.0'
      }
    });

    const content = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || '';
    
    // Determine document name
    const urlPath = new URL(url).pathname;
    const fileName = path.basename(urlPath) || 'document';
    const name = options.name || fileName.replace(/\.[^/.]+$/, '');

    return this.indexContent(content, name, contentType, url, options);
  }

  /**
   * Index a document from file path
   */
  async indexFromFile(filePath: string, options: IndexOptions = {}): Promise<IndexedDocument> {
    const content = await fs.promises.readFile(filePath);
    const name = options.name || path.basename(filePath, path.extname(filePath));
    const ext = path.extname(filePath).toLowerCase();
    
    let contentType = 'text/plain';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.html' || ext === '.htm') contentType = 'text/html';
    else if (ext === '.md') contentType = 'text/markdown';

    return this.indexContent(content, name, contentType, filePath, options);
  }

  /**
   * Index content directly
   */
  async indexContent(
    content: Buffer | string,
    name: string,
    contentType: string = 'text/plain',
    sourceUrl?: string,
    options: IndexOptions = {}
  ): Promise<IndexedDocument> {
    // Get appropriate parser
    const parser = ParserFactory.getParser(content, contentType);
    
    // Parse document
    const parsed = await parser.parse(content, sourceUrl);

    // Build tree structure - use LLM builder if requested (matches Python behavior)
    let tree: TreeNode[];
    if (options.useLLMTreeBuilder) {
      tree = await this.llmTreeBuilder.buildTree(parsed);
    } else {
      tree = this.treeBuilder.buildTree(parsed);
    }

    // Save to index
    const document = await this.indexManager.save(
      options.name || name,
      tree,
      parsed.metadata
    );

    return document;
  }

  /**
   * Query indexed documents
   */
  async query(
    query: string,
    documentIds?: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    // Get documents to search
    let documents: IndexedDocument[] = [];
    
    if (documentIds && documentIds.length > 0) {
      // Search specific documents
      for (const id of documentIds) {
        const doc = await this.indexManager.get(id);
        if (doc) documents.push(doc);
      }
    } else {
      // Search all documents
      const list = await this.indexManager.list();
      for (const item of list) {
        const doc = await this.indexManager.get(item.id);
        if (doc) documents.push(doc);
      }
    }

    // Search each document
    for (const doc of documents) {
      const results = await this.searcher.search(query, doc.structure, options);
      
      // Add document info to results
      for (const result of results) {
        allResults.push({
          ...result,
          path: [doc.doc_name, ...result.path]
        });
      }
    }

    // Sort by score and return top K
    const topK = options.topK || 3;
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Query with detailed iteration log
   */
  async queryWithLog(
    query: string,
    documentId: string,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    iterations: Array<{
      iteration: number;
      nodesEvaluated: string[];
      selectedNodes: string[];
      reasoning: string;
      confidence: string;
      foundAnswer: boolean;
    }>;
  }> {
    const doc = await this.indexManager.get(documentId);
    if (!doc) {
      return { results: [], iterations: [] };
    }

    return this.searcher.searchWithLog(query, doc.structure, options);
  }

  /**
   * Get all indexed documents
   */
  async listDocuments(): Promise<Array<{
    id: string;
    name: string;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    return this.indexManager.list();
  }

  /**
   * Get a specific document
   */
  async getDocument(id: string): Promise<IndexedDocument | null> {
    return this.indexManager.get(id);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.indexManager.delete(id);
  }

  /**
   * Get document tree structure
   */
  async getDocumentTree(id: string): Promise<TreeNode[] | null> {
    return this.indexManager.getTree(id);
  }

  /**
   * Get tree statistics
   */
  getTreeStats(tree: TreeNode[]): {
    totalNodes: number;
    maxDepth: number;
    avgChildrenPerNode: number;
  } {
    return this.treeBuilder.getTreeStats(tree);
  }

  /**
   * Print tree structure (for debugging)
   */
  printTree(tree: TreeNode[]): string {
    return this.treeBuilder.printTree(tree);
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    documentTypes: Record<string, number>;
  }> {
    return this.indexManager.getStats();
  }

  /**
   * Update configuration
   * Note: Changing openaiModel requires creating a new PageIndex instance
   */
  updateConfig(updates: Partial<PageIndexConfig>): void {
    const { openaiModel, llmProvider, ...allowedUpdates } = updates;
    this.config = { ...this.config, ...allowedUpdates };
    
    if (openaiModel || llmProvider) {
      console.warn('Changing openaiModel or llmProvider requires creating a new PageIndex instance');
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<PageIndexConfig, 'openaiApiKey'> {
    const { openaiApiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}
