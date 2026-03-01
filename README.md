# PageIndex TypeScript

A TypeScript implementation of PageIndex - vectorless RAG using LLM-based tree search for intelligent document retrieval.

## Overview

PageIndex is a novel approach to RAG (Retrieval-Augmented Generation) that doesn't use vector embeddings. Instead, it:

1. **Parses documents** into hierarchical tree structures based on headers/sections
2. **Uses LLM reasoning** to navigate the tree and find relevant content
3. **Iteratively searches** deeper into the tree until finding the answer

This approach provides more accurate retrieval for structured documents and allows the AI to explain its reasoning.

## Features

- **Multiple Document Formats**: PDF, HTML, Markdown, Plain Text
- **LLM-Powered Search**: Uses GPT models to reason about document structure
- **REST API**: Full-featured Express.js API
- **Hierarchical Indexing**: Builds tree structures from document sections
- **Iterative Search**: Drills down through tree levels to find answers

## Architecture

```
src/
├── types/           # TypeScript type definitions
├── parsers/         # Document parsers (Strategy pattern)
│   ├── DocumentParser.ts    # Abstract base class
│   ├── PDFParser.ts         # PDF parsing
│   ├── HTMLParser.ts        # HTML parsing
│   ├── MarkdownParser.ts    # Markdown parsing
│   └── ParserFactory.ts     # Factory for parsers
├── services/        # Core services
│   ├── TreeBuilder.ts       # Builds hierarchical trees
│   ├── LLMTreeSearcher.ts   # AI-powered search
│   └── IndexManager.ts      # Document storage
├── core/            # Main orchestrator
│   └── PageIndex.ts         # Facade pattern
├── api/             # REST API
│   ├── DocumentController.ts
│   ├── routes.ts
│   └── middleware.ts
└── index.ts         # Server entry point
```

## Installation

```bash
# Clone and enter directory
cd pageindex-ts

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
```

## Configuration

Edit `.env` file:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
DATA_DIR=./data
```

## Usage

### Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### API Endpoints

#### Index a Document from URL

```bash
curl -X POST http://localhost:3000/api/documents/index \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/document.html", "name": "my-doc"}'
```

#### Index Content Directly

```bash
curl -X POST http://localhost:3000/api/documents/index-content \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# My Document\n\n## Section 1\n\nContent here...",
    "name": "my-document",
    "contentType": "text/markdown"
  }'
```

#### Query Documents

```bash
curl -X POST http://localhost:3000/api/documents/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the main feature?",
    "documentIds": ["my-doc"],
    "options": {"topK": 3, "includeReasoning": true}
  }'
```

#### Query with Iteration Log

```bash
curl -X POST http://localhost:3000/api/documents/query-log \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does pricing work?",
    "documentId": "my-doc"
  }'
```

#### List Documents

```bash
curl http://localhost:3000/api/documents
```

#### Get Document Tree

```bash
curl http://localhost:3000/api/documents/my-doc/tree
```

#### Delete Document

```bash
curl -X DELETE http://localhost:3000/api/documents/my-doc
```

## Programmatic Usage

```typescript
import { PageIndex } from './core';

const pageIndex = new PageIndex({
  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiModel: 'gpt-4o-mini',
  dataDir: './data'  // Indexes saved to ./data/indexes/
});

// Index from URL
const doc = await pageIndex.indexFromUrl('https://example.com/doc.html', {
  name: 'my-doc'
});

// Index from local file (PDF, HTML, Markdown)
const pdfDoc = await pageIndex.indexFromFile('/path/to/document.pdf', {
  name: 'my-pdf',
  useLLMTreeBuilder: true  // Use AI to detect document structure
});

// Query
const results = await pageIndex.query('What is the main feature?', ['my-doc'], {
  topK: 3,
  includeReasoning: true
});

console.log(results);
```

### Index Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | filename | Document identifier |
| `useLLMTreeBuilder` | boolean | `false` | Use AI to detect structure (recommended for PDFs) |

### Index Storage

Indexes are saved as JSON files to `{dataDir}/indexes/`. Each document creates one file:

```
data/
└── indexes/
    ├── my-doc.json
    ├── my-pdf.json
    └── ...
```

## How It Works

### 1. Document Parsing

Documents are parsed based on their type:
- **PDF**: Extracts text and detects headers via heuristics
- **HTML**: Uses Cheerio to extract headers and content
- **Markdown**: Parses standard markdown headers
- **Text**: Detects headers via patterns (ALL CAPS, numbered sections, etc.)

### 2. Tree Building

Two methods are available:

**Simple TreeBuilder** (`useLLMTreeBuilder: false`):
- Parses document headers (H1-H6, # markdown, etc.)
- Fast, no API calls needed
- Best for well-structured documents with clear headers

**LLM TreeBuilder** (`useLLMTreeBuilder: true`):
- Uses AI to detect document structure
- Better for PDFs and documents without clear headers
- Generates summaries for each section

Sections are organized into a hierarchical tree based on header levels:

```
Document
├── H1: Introduction
│   ├── H2: Overview
│   └── H2: Getting Started
├── H1: Features
│   ├── H2: Feature A
│   └── H2: Feature B
└── H1: FAQ
    ├── H2: Question 1
    └── H2: Question 2
```

### 3. LLM Tree Search

When you query:

1. **Iteration 1**: LLM sees all top-level nodes, selects most relevant
2. **Iteration 2**: LLM sees children of selected nodes
3. **Iteration N**: Continues until answer is found or max iterations reached

The LLM provides:
- **Selected nodes**: Which sections to explore
- **Reasoning**: Why these sections were chosen
- **Confidence**: LOW, MEDIUM, or HIGH
- **foundAnswer**: Whether the answer was found

## Extending

### Add a Custom Parser

```typescript
import { DocumentParser } from './parsers/DocumentParser';

class XMLParser extends DocumentParser {
  constructor() {
    super('xml' as any);
  }

  canParse(content: Buffer | string, mimeType?: string): boolean {
    const text = content.toString();
    return text.includes('<?xml') || mimeType?.includes('xml');
  }

  async parse(content: Buffer | string, sourceUrl?: string) {
    // Parse XML and extract sections
    // Return ParsedDocument
  }
}

// Register parser
ParserFactory.registerParser(new XMLParser(), 'high');
```

### Add a Custom LLM Provider

By default, PageIndex uses OpenAI. You can implement a custom LLM provider for Anthropic, local models, or any other LLM:

```typescript
import { LLMProvider, LLMMessage, LLMRequestOptions } from './types';

// Example: Anthropic Claude provider
class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: LLMMessage[], options?: LLMRequestOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options?.maxTokens || 2000,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,  // Claude handles system differently
        content: m.content
      }))
    });
    return response.content[0].text;
  }
}

// Use with PageIndex
const pageIndex = new PageIndex({
  llmProvider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY!),
  dataDir: './data'
});
```

The `LLMProvider` interface:

```typescript
interface LLMProvider {
  chat(messages: LLMMessage[], options?: LLMRequestOptions): Promise<string>;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;  // Request JSON output if supported
}
```

## License

MIT
