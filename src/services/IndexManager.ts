/**
 * Index Manager
 * Handles storage and retrieval of indexed documents
 * Follows Single Responsibility Principle
 */

import * as fs from 'fs';
import * as path from 'path';
import { IndexedDocument, TreeNode, DocumentMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface IndexManagerConfig {
  dataDir: string;
}

export class IndexManager {
  private dataDir: string;
  private indexesDir: string;
  private cache: Map<string, IndexedDocument>;

  constructor(config: IndexManagerConfig) {
    this.dataDir = config.dataDir;
    this.indexesDir = path.join(this.dataDir, 'indexes');
    this.cache = new Map();
    
    this.ensureDirectories();
  }

  /**
   * Ensure data directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexesDir)) {
      fs.mkdirSync(this.indexesDir, { recursive: true });
    }
  }

  /**
   * Save an indexed document (Python-compatible format)
   */
  async save(
    name: string,
    tree: TreeNode[],
    metadata: DocumentMetadata
  ): Promise<IndexedDocument> {
    const id = this.generateId(name);
    const now = new Date();

    // Create document with Python-compatible field names
    const document: IndexedDocument = {
      doc_name: name,
      structure: tree,
      metadata,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Save to file
    const filePath = this.getDocumentPath(id);
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(document, null, 2),
      'utf-8'
    );

    // Update cache
    this.cache.set(id, document);

    return document;
  }

  /**
   * Get an indexed document by ID
   */
  async get(id: string): Promise<IndexedDocument | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Try to load from file
    const filePath = this.getDocumentPath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const document = JSON.parse(content) as IndexedDocument;
      
      // Update cache
      this.cache.set(id, document);
      
      return document;
    } catch (error) {
      console.error(`Failed to load document ${id}:`, error);
      return null;
    }
  }

  /**
   * Get document by name
   */
  async getByName(name: string): Promise<IndexedDocument | null> {
    const id = this.generateId(name);
    return this.get(id);
  }

  /**
   * List all indexed documents
   */
  async list(): Promise<Array<{
    id: string;
    name: string;
    metadata: DocumentMetadata;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const files = await fs.promises.readdir(this.indexesDir);
    const documents: Array<{
      id: string;
      name: string;
      metadata: DocumentMetadata;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(this.indexesDir, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const doc = JSON.parse(content) as IndexedDocument;
        
        documents.push({
          id: doc.id || this.generateId(doc.doc_name),
          name: doc.doc_name,
          metadata: doc.metadata || {} as DocumentMetadata,
          createdAt: new Date(doc.createdAt || Date.now()),
          updatedAt: new Date(doc.updatedAt || Date.now())
        });
      } catch (error) {
        console.error(`Failed to read document ${file}:`, error);
      }
    }

    return documents;
  }

  /**
   * Delete a document by ID
   */
  async delete(id: string): Promise<boolean> {
    const filePath = this.getDocumentPath(id);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      await fs.promises.unlink(filePath);
      this.cache.delete(id);
      return true;
    } catch (error) {
      console.error(`Failed to delete document ${id}:`, error);
      return false;
    }
  }

  /**
   * Update a document
   */
  async update(
    id: string,
    updates: Partial<Pick<IndexedDocument, 'doc_name' | 'structure' | 'metadata'>>
  ): Promise<IndexedDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const updated: IndexedDocument = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const filePath = this.getDocumentPath(id);
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(updated, null, 2),
      'utf-8'
    );

    this.cache.set(id, updated);
    return updated;
  }

  /**
   * Check if a document exists
   */
  async exists(id: string): Promise<boolean> {
    if (this.cache.has(id)) return true;
    
    const filePath = this.getDocumentPath(id);
    return fs.existsSync(filePath);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get tree structure for a document
   */
  async getTree(id: string): Promise<TreeNode[] | null> {
    const document = await this.get(id);
    return document?.structure || null;
  }

  /**
   * Get statistics for all documents
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalSize: number;
    documentTypes: Record<string, number>;
  }> {
    const files = await fs.promises.readdir(this.indexesDir);
    const stats = {
      totalDocuments: 0,
      totalSize: 0,
      documentTypes: {} as Record<string, number>
    };

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(this.indexesDir, file);
        const fileStat = await fs.promises.stat(filePath);
        stats.totalSize += fileStat.size;
        stats.totalDocuments++;

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const doc = JSON.parse(content) as IndexedDocument;
        const type = doc.metadata?.documentType || 'unknown';
        stats.documentTypes[type] = (stats.documentTypes[type] || 0) + 1;
      } catch (error) {
        console.error(`Failed to process ${file}:`, error);
      }
    }

    return stats;
  }

  /**
   * Generate document ID from name
   */
  private generateId(name: string): string {
    // Create URL-safe ID from name
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || uuidv4();
  }

  /**
   * Get file path for a document
   */
  private getDocumentPath(id: string): string {
    return path.join(this.indexesDir, `${id}.json`);
  }
}
