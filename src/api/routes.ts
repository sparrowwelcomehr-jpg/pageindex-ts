/**
 * API Routes
 * Defines all REST API endpoints
 */

import { Router } from 'express';
import { DocumentController } from './DocumentController';
import { PageIndex } from '../core';

export function createRouter(pageIndex: PageIndex): Router {
  const router = Router();
  const controller = new DocumentController(pageIndex);

  // Document indexing
  router.post('/documents/index', controller.indexFromUrl);
  router.post('/documents/index-content', controller.indexContent);

  // Querying
  router.post('/documents/query', controller.query);
  router.post('/documents/query-log', controller.queryWithLog);

  // Document management
  router.get('/documents', controller.list);
  router.get('/documents/:id', controller.get);
  router.get('/documents/:id/tree', controller.getTree);
  router.delete('/documents/:id', controller.delete);

  // Statistics
  router.get('/stats', controller.getStats);

  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}
