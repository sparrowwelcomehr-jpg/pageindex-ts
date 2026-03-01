/**
 * PageIndex Server
 * Main entry point for the REST API server
 */

import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import { PageIndex } from './core';
import { createRouter, errorHandler, notFoundHandler, requestLogger } from './api';

// Load environment variables
dotenv.config();

/**
 * Server configuration
 */
interface ServerConfig {
  port: number;
  host: string;
  openaiApiKey: string;
  openaiModel: string;
  dataDir: string;
}

/**
 * Create and configure the Express server
 */
function createServer(config: ServerConfig): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(requestLogger);

  // Initialize PageIndex
  const pageIndex = new PageIndex({
    openaiApiKey: config.openaiApiKey,
    openaiModel: config.openaiModel,
    dataDir: config.dataDir
  });

  // API routes
  app.use('/api', createRouter(pageIndex));

  // Root endpoint
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

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    openaiApiKey: process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data')
  };

  if (!config.openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const app = createServer(config);

  app.listen(config.port, config.host, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    PageIndex Server                        ║
║              Vectorless RAG with LLM Reasoning             ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://${config.host}:${config.port}                   ║
║  API docs at:       http://${config.host}:${config.port}/                  ║
║  Model:             ${config.openaiModel.padEnd(37)}║
║  Data directory:    ${config.dataDir.substring(0, 37).padEnd(37)}║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Run server
main().catch(console.error);

export { createServer };
