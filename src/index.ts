/**
 * PageIndex — Vectorless RAG using LLM-based tree search
 * @packageDocumentation
 */

import express, { Express } from 'express';
import cors from 'cors';
import * as path from 'path';
import { PageIndex } from './core';
import { createRouter, errorHandler, notFoundHandler, requestLogger } from './api';

export { PageIndex, type IndexOptions } from './core';

/**
 * Server configuration for {@link createServer}
 */
export interface ServerConfig {
  port: number;
  host: string;
  openaiApiKey: string;
  openaiModel: string;
  dataDir: string;
}

/**
 * Create and configure the Express server
 */
export function createServer(config: ServerConfig): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogger);

  const pageIndex = new PageIndex({
    openaiApiKey: config.openaiApiKey,
    openaiModel: config.openaiModel,
    dataDir: config.dataDir
  });

  app.use('/api', createRouter(pageIndex));

  app.get('/', (req, res) => {
    res.json({
      name: 'PageIndex API',
      version: '1.0.0',
      description: 'Vectorless RAG using LLM-based tree search',
      endpoints: {
        health: 'GET /api/health',
        index: 'POST /api/documents/index',
        indexContent: 'POST /api/documents/index-content',
        query: 'POST /api/documents/query',
        queryLog: 'POST /api/documents/query-log',
        list: 'GET /api/documents',
        get: 'GET /api/documents/:id',
        tree: 'GET /api/documents/:id/tree',
        delete: 'DELETE /api/documents/:id',
        stats: 'GET /api/stats'
      }
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
