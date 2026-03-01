/**
 * Document Controller
 * Handles HTTP requests for document operations
 * Follows Single Responsibility Principle
 */

import { Request, Response, NextFunction } from 'express';
import { PageIndex } from '../core';
import { SearchOptions } from '../types';

export class DocumentController {
  private pageIndex: PageIndex;

  constructor(pageIndex: PageIndex) {
    this.pageIndex = pageIndex;
  }

  /**
   * Index a document from URL
   * POST /api/documents/index
   */
  indexFromUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { url, name } = req.body;

      if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      const document = await this.pageIndex.indexFromUrl(url, { name });

      res.status(201).json({
        success: true,
        message: 'Document indexed successfully',
        document: {
          id: document.id,
          name: document.doc_name,
          metadata: document.metadata,
          createdAt: document.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Index content directly
   * POST /api/documents/index-content
   */
  indexContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { content, name, contentType } = req.body;

      if (!content || !name) {
        res.status(400).json({ error: 'Content and name are required' });
        return;
      }

      const document = await this.pageIndex.indexContent(
        content,
        name,
        contentType || 'text/plain'
      );

      res.status(201).json({
        success: true,
        message: 'Document indexed successfully',
        document: {
          id: document.id,
          name: document.doc_name,
          metadata: document.metadata,
          createdAt: document.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Query documents
   * POST /api/documents/query
   */
  query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, documentIds, options } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const searchOptions: SearchOptions = {
        topK: options?.topK || 3,
        maxIterations: options?.maxIterations || 5,
        includeReasoning: options?.includeReasoning ?? true
      };

      const results = await this.pageIndex.query(query, documentIds, searchOptions);

      res.json({
        success: true,
        query,
        results,
        count: results.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Query with detailed log
   * POST /api/documents/query-log
   */
  queryWithLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, documentId, options } = req.body;

      if (!query || !documentId) {
        res.status(400).json({ error: 'Query and documentId are required' });
        return;
      }

      const searchOptions: SearchOptions = {
        topK: options?.topK || 3,
        maxIterations: options?.maxIterations || 5
      };

      const result = await this.pageIndex.queryWithLog(query, documentId, searchOptions);

      res.json({
        success: true,
        query,
        documentId,
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all documents
   * GET /api/documents
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documents = await this.pageIndex.listDocuments();

      res.json({
        success: true,
        documents,
        count: documents.length
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific document
   * GET /api/documents/:id
   */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const document = await this.pageIndex.getDocument(id);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({
        success: true,
        document
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get document tree structure
   * GET /api/documents/:id/tree
   */
  getTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const tree = await this.pageIndex.getDocumentTree(id);

      if (!tree) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const stats = this.pageIndex.getTreeStats(tree);

      res.json({
        success: true,
        tree,
        stats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a document
   * DELETE /api/documents/:id
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await this.pageIndex.deleteDocument(id);

      if (!deleted) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get storage statistics
   * GET /api/stats
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.pageIndex.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  };
}
