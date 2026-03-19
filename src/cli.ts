#!/usr/bin/env node
/**
 * CLI entry — starts the PageIndex HTTP server.
 * Library consumers should import from the package root instead.
 */

import * as path from 'path';
import dotenv from 'dotenv';
import { createServer } from './index';

dotenv.config();

async function main(): Promise<void> {
  const config = {
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

main().catch(console.error);
