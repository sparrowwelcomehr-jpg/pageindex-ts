/**
 * ============================================================================
 *                         PageIndex TypeScript Demo
 * ============================================================================
 * 
 * A vectorless RAG (Retrieval-Augmented Generation) library that uses
 * hierarchical tree structures and LLM reasoning for document search.
 * 
 * INSTALLATION:
 * -------------
 *   npm install pageindex-ts
 *   # or
 *   yarn add pageindex-ts
 * 
 * ENVIRONMENT SETUP:
 * ------------------
 *   Create a .env file with your OpenAI API key:
 *   OPENAI_API_KEY=sk-your-api-key-here
 * 
 * SUPPORTED FORMATS:
 * ------------------
 *   - PDF (.pdf)
 *   - HTML (.html, .htm)
 *   - Markdown (.md)
 *   - Plain Text (.txt)
 * 
 * RUN THIS DEMO:
 * --------------
 *   npx ts-node test/demo.ts
 * 
 * ============================================================================
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import PageIndex components
import { PageIndex } from '../src/core';
import { ParserFactory } from '../src/parsers';
import { TreeBuilder } from '../src/services';

// Sample files directory
const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
const DATA_DIR = path.join(__dirname, '..', 'data');

// ============================================================================
// PART 1: PARSING WITHOUT API KEY
// ============================================================================

async function part1_ParsingWithoutAPI() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PART 1: PARSING DOCUMENTS (No API Key Required)          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // --- Markdown Parsing ---
  console.log('\n' + '─'.repeat(60));
  console.log('1.1 MARKDOWN PARSING');
  console.log('─'.repeat(60));

  const markdownPath = path.join(SAMPLES_DIR, 'joyzai-product.md');
  if (fs.existsSync(markdownPath)) {
    const content = fs.readFileSync(markdownPath, 'utf-8');
    const parser = ParserFactory.getParser(content, 'text/markdown');
    const parsed = await parser.parse(content);
    
    console.log(`\n📄 File: joyzai-product.md`);
    console.log(`   Sections found: ${parsed.sections.length}`);
    console.log(`   Word count: ${parsed.metadata.wordCount}`);
    console.log('\n   Section hierarchy:');
    parsed.sections.slice(0, 8).forEach(s => {
      console.log(`   ${'  '.repeat(s.level - 1)}• [H${s.level}] ${s.title}`);
    });
    if (parsed.sections.length > 8) {
      console.log(`   ... and ${parsed.sections.length - 8} more sections`);
    }
  } else {
    console.log('⚠️  joyzai-product.md not found in samples/');
  }

  // --- HTML Parsing ---
  console.log('\n' + '─'.repeat(60));
  console.log('1.2 HTML PARSING');
  console.log('─'.repeat(60));

  const htmlPath = path.join(SAMPLES_DIR, 'api-docs.html');
  if (fs.existsSync(htmlPath)) {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const parser = ParserFactory.getParser(content, 'text/html');
    const parsed = await parser.parse(content);
    
    console.log(`\n📄 File: api-docs.html`);
    console.log(`   Sections found: ${parsed.sections.length}`);
    console.log(`   Title: ${parsed.metadata.title}`);
    console.log('\n   Section hierarchy:');
    parsed.sections.slice(0, 10).forEach(s => {
      console.log(`   ${'  '.repeat(s.level - 1)}• [H${s.level}] ${s.title}`);
    });
    if (parsed.sections.length > 10) {
      console.log(`   ... and ${parsed.sections.length - 10} more sections`);
    }
  } else {
    console.log('⚠️  api-docs.html not found in samples/');
  }

  // --- PDF Parsing ---
  console.log('\n' + '─'.repeat(60));
  console.log('1.3 PDF PARSING');
  console.log('─'.repeat(60));

  const pdfFiles = fs.existsSync(SAMPLES_DIR) 
    ? fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.pdf'))
    : [];

  if (pdfFiles.length > 0) {
    const pdfPath = path.join(SAMPLES_DIR, pdfFiles[0]);
    const content = fs.readFileSync(pdfPath);
    const parser = ParserFactory.getParser(content, 'application/pdf');
    
    try {
      const parsed = await parser.parse(content);
      
      console.log(`\n📄 File: ${pdfFiles[0]}`);
      console.log(`   Pages: ${parsed.metadata.pageCount}`);
      console.log(`   Word count: ${parsed.metadata.wordCount}`);
      console.log(`   Sections detected: ${parsed.sections.length}`);
      console.log('\n   Detected sections:');
      parsed.sections.slice(0, 8).forEach(s => {
        console.log(`   ${'  '.repeat(s.level - 1)}• [L${s.level}] ${s.title}`);
      });
    } catch (error) {
      console.log(`⚠️  Failed to parse PDF: ${(error as Error).message}`);
    }
  } else {
    console.log('⚠️  No PDF files found in samples/');
  }

  // --- Building Tree from Parsed Content ---
  console.log('\n' + '─'.repeat(60));
  console.log('1.4 TREE BUILDING (Simple - No LLM)');
  console.log('─'.repeat(60));

  const mdContent = fs.existsSync(markdownPath) 
    ? fs.readFileSync(markdownPath, 'utf-8') 
    : '';
  
  if (mdContent) {
    const parser = ParserFactory.getParser(mdContent, 'text/markdown');
    const parsed = await parser.parse(mdContent);
    const treeBuilder = new TreeBuilder();
    const tree = treeBuilder.buildTree(parsed);
    
    console.log('\n📁 Tree structure from joyzai-product.md:');
    console.log(treeBuilder.printTree(tree));
    
    const stats = treeBuilder.getTreeStats(tree);
    console.log('Statistics:', stats);
  }
}

// ============================================================================
// PART 2: INDEXING WITH API KEY
// ============================================================================

async function part2_IndexingWithAPI() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PART 2: INDEXING DOCUMENTS (Requires API Key)            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  OPENAI_API_KEY not set - skipping Part 2');
    return;
  }

  const pageIndex = new PageIndex({
    openaiApiKey: apiKey,
    dataDir: DATA_DIR
  });

  // --- Index Markdown (Simple TreeBuilder) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.1 INDEX MARKDOWN (Simple TreeBuilder - no LLM)');
  console.log('─'.repeat(60));

  const markdownPath = path.join(SAMPLES_DIR, 'joyzai-product.md');
  if (fs.existsSync(markdownPath)) {
    const doc = await pageIndex.indexFromFile(markdownPath, {
      name: 'joyzai-simple',
      useLLMTreeBuilder: false
    });
    console.log(`\n✅ Indexed: ${doc.doc_name}`);
    console.log(`   Method: Simple TreeBuilder (header-based)`);
    console.log(`   Top-level nodes: ${doc.structure.length}`);
    
    const treeBuilder = new TreeBuilder();
    console.log('\n   Structure:');
    console.log(treeBuilder.printTree(doc.structure));
  }

  // --- Index Markdown (LLM TreeBuilder) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.2 INDEX MARKDOWN (LLM TreeBuilder - AI-powered)');
  console.log('─'.repeat(60));

  if (fs.existsSync(markdownPath)) {
    const doc = await pageIndex.indexFromFile(markdownPath, {
      name: 'joyzai-llm',
      useLLMTreeBuilder: true
    });
    console.log(`\n✅ Indexed: ${doc.doc_name}`);
    console.log(`   Method: LLM TreeBuilder (AI-detected structure)`);
    console.log(`   Top-level nodes: ${doc.structure.length}`);
    
    const treeBuilder = new TreeBuilder();
    console.log('\n   Structure:');
    console.log(treeBuilder.printTree(doc.structure));
  }

  // --- Index HTML (Simple TreeBuilder) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.3 INDEX HTML (Simple TreeBuilder)');
  console.log('─'.repeat(60));

  const htmlPath = path.join(SAMPLES_DIR, 'api-docs.html');
  if (fs.existsSync(htmlPath)) {
    const doc = await pageIndex.indexFromFile(htmlPath, {
      name: 'api-docs-simple',
      useLLMTreeBuilder: false
    });
    console.log(`\n✅ Indexed: ${doc.doc_name}`);
    console.log(`   Method: Simple TreeBuilder (header-based)`);
    console.log(`   Top-level nodes: ${doc.structure.length}`);
  }

  // --- Index HTML (LLM TreeBuilder) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.4 INDEX HTML (LLM TreeBuilder)');
  console.log('─'.repeat(60));

  if (fs.existsSync(htmlPath)) {
    const doc = await pageIndex.indexFromFile(htmlPath, {
      name: 'api-docs-llm',
      useLLMTreeBuilder: true
    });
    console.log(`\n✅ Indexed: ${doc.doc_name}`);
    console.log(`   Method: LLM TreeBuilder (AI-detected structure)`);
    console.log(`   Top-level nodes: ${doc.structure.length}`);
  }

  // --- Index PDF (Simple TreeBuilder) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.5 INDEX PDF (Simple TreeBuilder)');
  console.log('─'.repeat(60));

  const pdfFiles = fs.existsSync(SAMPLES_DIR) 
    ? fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.pdf'))
    : [];

  if (pdfFiles.length > 0) {
    const pdfPath = path.join(SAMPLES_DIR, pdfFiles[0]);
    const pdfName = pdfFiles[0].replace('.pdf', '');
    
    try {
      const doc = await pageIndex.indexFromFile(pdfPath, {
        name: `${pdfName}-simple`,
        useLLMTreeBuilder: false
      });
      console.log(`\n✅ Indexed: ${doc.doc_name}`);
      console.log(`   Method: Simple TreeBuilder (heuristic-based)`);
      console.log(`   Top-level nodes: ${doc.structure.length}`);
    } catch (error) {
      console.log(`⚠️  Failed to index PDF: ${(error as Error).message}`);
    }
  } else {
    console.log('⚠️  No PDF files found in samples/');
  }

  // --- Index PDF (LLM TreeBuilder - recommended for PDFs) ---
  console.log('\n' + '─'.repeat(60));
  console.log('2.6 INDEX PDF (LLM TreeBuilder - recommended)');
  console.log('─'.repeat(60));

  if (pdfFiles.length > 0) {
    const pdfPath = path.join(SAMPLES_DIR, pdfFiles[0]);
    const pdfName = pdfFiles[0].replace('.pdf', '');
    
    try {
      const doc = await pageIndex.indexFromFile(pdfPath, {
        name: `${pdfName}-llm`,
        useLLMTreeBuilder: true
      });
      console.log(`\n✅ Indexed: ${doc.doc_name}`);
      console.log(`   Method: LLM TreeBuilder (AI-detected structure)`);
      console.log(`   Top-level nodes: ${doc.structure.length}`);
      
      const treeBuilder = new TreeBuilder();
      console.log('\n   Structure:');
      console.log(treeBuilder.printTree(doc.structure));
    } catch (error) {
      console.log(`⚠️  Failed to index PDF: ${(error as Error).message}`);
    }
  }

  // List all indexed documents
  console.log('\n' + '─'.repeat(60));
  console.log('2.7 ALL INDEXED DOCUMENTS');
  console.log('─'.repeat(60));

  const indexedDocs = await pageIndex.listDocuments();
  console.log(`\n📚 Total indexed documents: ${indexedDocs.length}`);
  indexedDocs.forEach(doc => {
    console.log(`   • ${doc.id}`);
  });
}

// ============================================================================
// PART 3: LLM SEARCH - SINGLE DOCUMENT
// ============================================================================

async function part3_LLMSearchSingleDoc() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PART 3: LLM SEARCH - SINGLE DOCUMENT                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  OPENAI_API_KEY not set - skipping Part 3');
    return;
  }

  const pageIndex = new PageIndex({
    openaiApiKey: apiKey,
    dataDir: DATA_DIR
  });

  // --- Search in Simple-indexed document ---
  console.log('\n' + '─'.repeat(60));
  console.log('3.1 SEARCH: Simple TreeBuilder Index');
  console.log('─'.repeat(60));

  const query1 = 'What industries can use JoyzAI?';
  console.log(`\n📝 Query: "${query1}"`);
  console.log('   Document: joyzai-simple (indexed with Simple TreeBuilder)');

  const results1 = await pageIndex.queryWithLog(query1, 'joyzai-simple', {
    topK: 3,
    maxIterations: 5
  });

  console.log('\n   🔍 Search Process (LLM Tree Traversal):');
  results1.iterations.forEach(iter => {
    console.log(`\n   Iteration ${iter.iteration}:`);
    console.log(`     Nodes evaluated: ${iter.nodesEvaluated.join(', ')}`);
    console.log(`     Selected: ${iter.selectedNodes.join(', ')}`);
    console.log(`     Confidence: ${iter.confidence}`);
    console.log(`     Reasoning: ${iter.reasoning.substring(0, 100)}...`);
  });

  console.log('\n   📊 Results:');
  results1.results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
    console.log(`      Path: ${r.path.join(' > ')}`);
  });

  // --- Search in LLM-indexed document ---
  console.log('\n' + '─'.repeat(60));
  console.log('3.2 SEARCH: LLM TreeBuilder Index');
  console.log('─'.repeat(60));

  console.log(`\n📝 Query: "${query1}"`);
  console.log('   Document: joyzai-llm (indexed with LLM TreeBuilder)');

  const results2 = await pageIndex.queryWithLog(query1, 'joyzai-llm', {
    topK: 3,
    maxIterations: 5
  });

  console.log('\n   🔍 Search Process:');
  results2.iterations.forEach(iter => {
    console.log(`\n   Iteration ${iter.iteration}:`);
    console.log(`     Selected: ${iter.selectedNodes.join(', ')}`);
    console.log(`     Confidence: ${iter.confidence}`);
  });

  console.log('\n   📊 Results:');
  results2.results.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
    console.log(`      Path: ${r.path.join(' > ')}`);
  });

  // --- Deep dive search on PDF ---
  console.log('\n' + '─'.repeat(60));
  console.log('3.3 DEEP DIVE SEARCH: PDF Document');
  console.log('─'.repeat(60));

  const pdfFiles = fs.existsSync(SAMPLES_DIR) 
    ? fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.pdf'))
    : [];

  if (pdfFiles.length > 0) {
    const pdfName = pdfFiles[0].replace('.pdf', '') + '-llm';
    const pdfQuery = 'What are the different types of receptors?';
    
    console.log(`\n📝 Query: "${pdfQuery}"`);
    console.log(`   Document: ${pdfName}`);

    try {
      const pdfResults = await pageIndex.queryWithLog(pdfQuery, pdfName, {
        topK: 3,
        maxIterations: 5
      });

      console.log('\n   🔍 Search Process (Deep Dive):');
      pdfResults.iterations.forEach(iter => {
        console.log(`\n   Iteration ${iter.iteration}:`);
        console.log(`     Nodes evaluated: ${iter.nodesEvaluated.slice(0, 5).join(', ')}${iter.nodesEvaluated.length > 5 ? '...' : ''}`);
        console.log(`     Selected: ${iter.selectedNodes.join(', ')}`);
        console.log(`     Found answer: ${iter.foundAnswer}`);
      });

      console.log('\n   📊 Results:');
      pdfResults.results.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
        console.log(`      Path: ${r.path.join(' > ')}`);
        if (r.content) {
          console.log(`      Content: ${r.content.substring(0, 100)}...`);
        }
      });
    } catch (error) {
      console.log(`⚠️  Search failed: ${(error as Error).message}`);
    }
  }
}

// ============================================================================
// PART 4: LLM SEARCH - MULTI-DOCUMENT
// ============================================================================

async function part4_LLMSearchMultiDoc() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PART 4: LLM SEARCH - MULTI-DOCUMENT                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  OPENAI_API_KEY not set - skipping Part 4');
    return;
  }

  const pageIndex = new PageIndex({
    openaiApiKey: apiKey,
    dataDir: DATA_DIR
  });

  // Get all indexed documents
  const indexedDocs = await pageIndex.listDocuments();
  const docIds = indexedDocs.map(d => d.id);

  console.log(`\n📚 Searching across ${docIds.length} documents:`);
  docIds.forEach(id => console.log(`   • ${id}`));

  // --- Multi-doc search 1 ---
  console.log('\n' + '─'.repeat(60));
  console.log('4.1 MULTI-DOC SEARCH: "How to get started?"');
  console.log('─'.repeat(60));

  const query1 = 'How can I get started?';
  console.log(`\n📝 Query: "${query1}"`);

  const results1 = await pageIndex.query(query1, docIds, { topK: 5 });

  console.log('\n   📊 Results across all documents:');
  results1.forEach((r, i) => {
    console.log(`\n   ${i + 1}. ${r.title}`);
    console.log(`      Score: ${r.score.toFixed(2)}`);
    console.log(`      Path: ${r.path.join(' > ')}`);
  });

  // --- Multi-doc search 2 ---
  console.log('\n' + '─'.repeat(60));
  console.log('4.2 MULTI-DOC SEARCH: "What are the features?"');
  console.log('─'.repeat(60));

  const query2 = 'What are the main features?';
  console.log(`\n📝 Query: "${query2}"`);

  const results2 = await pageIndex.query(query2, docIds, { topK: 5 });

  console.log('\n   📊 Results across all documents:');
  results2.forEach((r, i) => {
    console.log(`\n   ${i + 1}. ${r.title}`);
    console.log(`      Score: ${r.score.toFixed(2)}`);
    console.log(`      Document: ${r.path[0]}`);
  });

  // --- Comparing Simple vs LLM indexed ---
  console.log('\n' + '─'.repeat(60));
  console.log('4.3 COMPARISON: Simple vs LLM TreeBuilder (Markdown)');
  console.log('─'.repeat(60));

  const compQuery = 'What platforms does JoyzAI support?';
  console.log(`\n📝 Query: "${compQuery}"`);

  console.log('\n   Using Simple TreeBuilder index (joyzai-simple):');
  const simpleResults = await pageIndex.query(compQuery, ['joyzai-simple'], { topK: 2 });
  simpleResults.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
  });

  console.log('\n   Using LLM TreeBuilder index (joyzai-llm):');
  const llmResults = await pageIndex.query(compQuery, ['joyzai-llm'], { topK: 2 });
  llmResults.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
  });

  // --- Comparing HTML indexes ---
  console.log('\n' + '─'.repeat(60));
  console.log('4.4 COMPARISON: Simple vs LLM TreeBuilder (HTML)');
  console.log('─'.repeat(60));

  const htmlQuery = 'How do I install PageIndex?';
  console.log(`\n📝 Query: "${htmlQuery}"`);

  console.log('\n   Using Simple TreeBuilder index (api-docs-simple):');
  const htmlSimple = await pageIndex.query(htmlQuery, ['api-docs-simple'], { topK: 2 });
  htmlSimple.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
  });

  console.log('\n   Using LLM TreeBuilder index (api-docs-llm):');
  const htmlLlm = await pageIndex.query(htmlQuery, ['api-docs-llm'], { topK: 2 });
  htmlLlm.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
  });

  // --- Comparing PDF indexes ---
  console.log('\n' + '─'.repeat(60));
  console.log('4.5 COMPARISON: Simple vs LLM TreeBuilder (PDF)');
  console.log('─'.repeat(60));

  const pdfFiles = fs.existsSync(SAMPLES_DIR) 
    ? fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.pdf'))
    : [];

  if (pdfFiles.length > 0) {
    const pdfBaseName = pdfFiles[0].replace('.pdf', '');
    const pdfQuery = 'What are the types of receptors?';
    console.log(`\n📝 Query: "${pdfQuery}"`);

    console.log(`\n   Using Simple TreeBuilder index (${pdfBaseName}-simple):`);
    try {
      const pdfSimple = await pageIndex.query(pdfQuery, [`${pdfBaseName}-simple`], { topK: 2 });
      pdfSimple.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
      });
    } catch (e) {
      console.log('   (index not available)');
    }

    console.log(`\n   Using LLM TreeBuilder index (${pdfBaseName}-llm):`);
    try {
      const pdfLlm = await pageIndex.query(pdfQuery, [`${pdfBaseName}-llm`], { topK: 2 });
      pdfLlm.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
      });
    } catch (e) {
      console.log('   (index not available)');
    }
  }
}

// ============================================================================
// PART 5: ADVANCED LLM SEARCH WITH DETAILED REASONING
// ============================================================================

async function part5_AdvancedSearchWithReasoning() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PART 5: ADVANCED SEARCH WITH DETAILED REASONING          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  OPENAI_API_KEY not set - skipping Part 5');
    return;
  }

  const pageIndex = new PageIndex({
    openaiApiKey: apiKey,
    dataDir: DATA_DIR
  });

  console.log(`
This example shows how the LLM navigates the document tree:

1. LLM sees the top-level nodes (summaries only)
2. Decides which branches are most relevant to the query
3. Dives deeper into selected branches
4. Continues until it finds the answer or reaches max depth
5. Returns results with full reasoning trace
`);

  // --- Detailed reasoning example ---
  console.log('─'.repeat(60));
  console.log('DETAILED SEARCH TRACE');
  console.log('─'.repeat(60));

  const query = 'How does the chatbot handle questions it cannot answer?';
  console.log(`\n📝 Query: "${query}"`);
  console.log('   Document: joyzai-simple\n');

  const results = await pageIndex.queryWithLog(query, 'joyzai-simple', {
    topK: 2,
    maxIterations: 10
  });

  console.log('   🧠 LLM Reasoning Trace:');
  console.log('   ' + '─'.repeat(55));

  results.iterations.forEach(iter => {
    console.log(`\n   📍 ITERATION ${iter.iteration}`);
    console.log(`   ├─ Nodes presented to LLM: ${iter.nodesEvaluated.length}`);
    iter.nodesEvaluated.slice(0, 5).forEach(n => {
      console.log(`   │    • ${n}`);
    });
    if (iter.nodesEvaluated.length > 5) {
      console.log(`   │    ... and ${iter.nodesEvaluated.length - 5} more`);
    }
    console.log(`   ├─ LLM selected: [${iter.selectedNodes.join(', ')}]`);
    console.log(`   ├─ Confidence: ${iter.confidence}`);
    console.log(`   ├─ Found answer: ${iter.foundAnswer ? 'YES ✓' : 'NO, going deeper...'}`);
    console.log(`   └─ Reasoning: "${iter.reasoning}"`);
  });

  console.log('\n   ' + '─'.repeat(55));
  console.log('   📊 FINAL RESULTS:');
  
  results.results.forEach((r, i) => {
    console.log(`\n   ${i + 1}. ${r.title}`);
    console.log(`      Score: ${r.score.toFixed(2)}`);
    console.log(`      Path: ${r.path.join(' → ')}`);
    if (r.content) {
      console.log(`      Content preview: "${r.content.substring(0, 150)}..."`);
    }
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   PageIndex TypeScript Demo                   ║');
  console.log('║              Vectorless RAG with LLM Reasoning                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  No OPENAI_API_KEY found in environment');
    console.log('   Parts 2-5 require an OpenAI API key to run.');
    console.log('   Create a .env file with: OPENAI_API_KEY=sk-your-key\n');
  }

  // Check for sample files
  if (fs.existsSync(SAMPLES_DIR)) {
    const files = fs.readdirSync(SAMPLES_DIR);
    console.log(`\n📁 Sample files: ${files.join(', ')}`);
  }

  try {
    // Part 1: No API key needed
    await part1_ParsingWithoutAPI();
    
    // Parts 2-5: API key required
    await part2_IndexingWithAPI();
    await part3_LLMSearchSingleDoc();
    await part4_LLMSearchMultiDoc();
    await part5_AdvancedSearchWithReasoning();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Demo completed successfully!');
    console.log('═'.repeat(60));
    console.log('\n📂 Indexes saved to: data/indexes/');
    console.log('   Run again to query existing indexes.\n');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

main();
