# pageindex-vectorless

Vectorless RAG: documents are parsed into section trees and an LLM walks the tree to answer queries (no embeddings). Ships as a **library** (`PageIndex`), an **Express app factory** (`createServer`), and a **CLI** that runs the HTTP API.

**npm package:** `pageindex-vectorless` · **repo:** [pageindex-ts](https://github.com/sparrowwelcomehr-jpg/pageindex-ts)

---

## Use the package (consumers)

### Install

```bash
npm install pageindex-vectorless
```

### Environment

| Variable | Required | Default |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes (for server / LLM features) | — |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |
| `PORT` | No | `3000` |
| `HOST` | No | `0.0.0.0` |
| `DATA_DIR` | No | `./data` (relative to process cwd for the CLI) |

### Run the REST server (CLI)

```bash
export OPENAI_API_KEY=sk-...
npx pageindex-vectorless
```

Or from your own `package.json` script after installing the dependency: `pageindex-vectorless` (same binary name as the package).

### Use as a library

```typescript
import { PageIndex } from 'pageindex-vectorless';

const pageIndex = new PageIndex({
  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiModel: 'gpt-4o-mini',
  dataDir: './data'
});

await pageIndex.indexFromFile('./doc.pdf', { name: 'my-doc', useLLMTreeBuilder: true });
const results = await pageIndex.query('Your question?', ['my-doc']);
```

### Mount the API in your own Express app

```typescript
import { createServer } from 'pageindex-vectorless';

const app = createServer({
  port: 3000,
  host: '0.0.0.0',
  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiModel: 'gpt-4o-mini',
  dataDir: './data'
});

app.listen(3000);
```

### API smoke test (server running on port 3000)

```bash
curl -s http://localhost:3000/api/health
curl -s -X POST http://localhost:3000/api/documents/index-content \
  -H "Content-Type: application/json" \
  -d '{"name":"demo","content":"# Hello\n\nSection body.","contentType":"text/markdown"}'
```

---

## Develop and test changes (this repo)

### Setup

```bash
git clone https://github.com/sparrowwelcomehr-jpg/pageindex-ts.git
cd pageindex-ts
npm install
cp .env.example .env   # add OPENAI_API_KEY
```

### Run from source (no build)

```bash
npm run dev
```

Same behavior as the published CLI, but executes `src/cli.ts` via `ts-node`.

### Build and run compiled output

```bash
npm run build
npm start
```

Use this to confirm what users get from `dist/` after `tsc`.

### Try the bundled demo script

Requires `OPENAI_API_KEY` and uses the library-style flow (see comments at top of the file):

```bash
npx ts-node test/demo.ts
```

### Lint

```bash
npm run lint
```

### Test the npm package locally before publishing

From the repo root:

```bash
npm run build
npm pack
```

Inspect the tarball or install it into another folder:

```bash
cd /path/to/another-project
npm install /path/to/pageindex-ts/pageindex-vectorless-1.0.1.tgz
```

Or link the package:

```bash
cd /path/to/pageindex-ts
npm run build
npm link
cd /path/to/consumer
npm link pageindex-vectorless
```

### Publish checklist

```bash
npm run build
npm publish --dry-run
npm publish
```

---

## License

MIT
