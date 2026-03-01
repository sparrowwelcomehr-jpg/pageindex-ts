/**
 * LLM Tree Builder Service
 * Uses LLM to generate hierarchical tree structures from documents
 * Matches Python PageIndex library algorithm exactly
 */

import { TreeNode, ParsedDocument, LLMProvider } from '../types';
import { OpenAIProvider } from './OpenAIProvider';

export interface LLMTreeBuilderConfig {
  openaiApiKey?: string;
  model?: string;
  llmProvider?: LLMProvider;  // Custom LLM provider
}

interface TocItem {
  structure: string;  // e.g., "1", "1.1", "1.2"
  title: string;
  physical_index: number;
}

export class LLMTreeBuilder {
  private llmProvider: LLMProvider;
  private nodeIdCounter: number = 0;

  constructor(config: LLMTreeBuilderConfig) {
    // Use custom provider if provided, otherwise default to OpenAI
    if (config.llmProvider) {
      this.llmProvider = config.llmProvider;
    } else if (config.openaiApiKey) {
      this.llmProvider = new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: config.model || 'gpt-4o-mini'
      });
    } else {
      throw new Error('Either llmProvider or openaiApiKey must be provided');
    }
  }

  /**
   * Build a hierarchical tree from a parsed document using LLM
   * This matches Python PageIndex's approach
   */
  async buildTree(document: ParsedDocument): Promise<TreeNode[]> {
    this.nodeIdCounter = 0;

    // Split content into pages (for PDFs, we have page breaks; for others, use chunks)
    const pages = this.splitIntoPages(document.content, document.metadata.pageCount);
    
    // Generate TOC using LLM (like Python's generate_toc_init)
    const tocItems = await this.generateTocFromContent(pages);
    
    // Convert flat TOC to hierarchical tree (like Python's post_processing)
    const flatNodes = this.tocToFlatNodes(tocItems, pages.length);
    
    // Build hierarchical tree from flat nodes based on structure index
    const tree = this.buildHierarchyFromStructure(flatNodes);
    
    // Generate summaries for each node using LLM
    await this.generateSummaries(tree, pages);
    
    return tree;
  }

  /**
   * Split content into pages
   */
  private splitIntoPages(content: string, pageCount?: number): string[] {
    // If we have page breaks (from PDF), use them
    if (content.includes('\f')) {
      return content.split('\f').filter(p => p.trim().length > 0);
    }
    
    // Otherwise, split into chunks of roughly equal size
    const targetPages = pageCount || Math.max(1, Math.ceil(content.length / 3000));
    const chunkSize = Math.ceil(content.length / targetPages);
    const pages: string[] = [];
    
    for (let i = 0; i < content.length; i += chunkSize) {
      pages.push(content.slice(i, i + chunkSize));
    }
    
    return pages;
  }

  /**
   * Generate TOC structure from content using LLM
   * Matches Python's generate_toc_init
   */
  private async generateTocFromContent(pages: string[]): Promise<TocItem[]> {
    const allTocItems: TocItem[] = [];
    
    // Process pages in groups to fit context window
    const maxPagesPerGroup = 5;
    const groups = this.groupPages(pages, maxPagesPerGroup);
    
    console.log(`[LLMTreeBuilder] Processing ${pages.length} pages in ${groups.length} groups`);
    
    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const groupText = groups[groupIdx].text;
      const startPage = groups[groupIdx].startPage;
      
      console.log(`[LLMTreeBuilder] Processing group ${groupIdx + 1}/${groups.length} (pages ${startPage}-${startPage + maxPagesPerGroup - 1})`);
      
      if (groupIdx === 0) {
        // Initial TOC generation
        const items = await this.generateTocInit(groupText, startPage);
        console.log(`[LLMTreeBuilder] Group ${groupIdx + 1} returned ${items.length} items:`, items.map(i => i.title).join(', '));
        allTocItems.push(...items);
      } else {
        // Continue TOC generation
        const items = await this.generateTocContinue(allTocItems, groupText, startPage);
        console.log(`[LLMTreeBuilder] Group ${groupIdx + 1} returned ${items.length} items:`, items.map(i => i.title).join(', '));
        allTocItems.push(...items);
      }
    }
    
    console.log(`[LLMTreeBuilder] Total TOC items: ${allTocItems.length}`);
    return allTocItems;
  }

  /**
   * Group pages with physical index tags
   */
  private groupPages(pages: string[], maxPagesPerGroup: number): Array<{ text: string; startPage: number }> {
    const groups: Array<{ text: string; startPage: number }> = [];
    
    for (let i = 0; i < pages.length; i += maxPagesPerGroup) {
      const groupPages = pages.slice(i, i + maxPagesPerGroup);
      let text = '';
      
      groupPages.forEach((page, idx) => {
        const pageNum = i + idx + 1;
        text += `<physical_index_${pageNum}>\n${page}\n</physical_index_${pageNum}>\n\n`;
      });
      
      groups.push({ text, startPage: i + 1 });
    }
    
    return groups;
  }

  /**
   * Initial TOC generation using LLM
   * Matches Python's generate_toc_init
   */
  private async generateTocInit(text: string, startPage: number): Promise<TocItem[]> {
    const prompt = `You are an expert document analyzer. Your task is to identify the main sections and subsections from this document text.

Look for:
- Major headings and titles (often in ALL CAPS or on their own line)
- Section headers like "SUMMARIZED FINANCIAL RESULTS", "DISCUSSION OF...", "GUIDANCE AND OUTLOOK"
- The document title at the beginning
- Subsections indicated by clear topic changes or headers

The structure index represents hierarchy:
- "1", "2", "3" for main sections
- "1.1", "1.2" for subsections
- "1.1.1" for sub-subsections

The provided text contains tags like <physical_index_X> to indicate page numbers.

Return a JSON array of sections found:
[
    {
        "structure": "<hierarchy index, e.g., '1', '1.1', '2'>",
        "title": "<exact section title from the text, cleaned of extra whitespace>",
        "physical_index": <page number where section starts, as integer>
    }
]

Important:
- Include the main document title as section "1"
- Look for ALL CAPS headers as major sections
- Return an empty array [] ONLY if there are truly no identifiable sections
- Clean up titles by removing extra tabs/spaces but keep the original wording

Directly return the JSON array only. No other text.

Text to analyze:
${text}`;

    try {
      const content = await this.llmProvider.chat(
        [
          { role: 'system', content: 'You are a precise document structure analyzer. Always output valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.1, jsonMode: true }
      );

      if (!content) return [];

      const parsed = JSON.parse(content);
      // Handle both array and object responses
      const items = Array.isArray(parsed) ? parsed : (parsed.sections || parsed.items || parsed.toc || []);
      
      return items.map((item: any) => ({
        structure: String(item.structure || '1'),
        title: String(item.title || '').replace(/[\t\s]+/g, ' ').trim(),
        physical_index: typeof item.physical_index === 'number' ? item.physical_index : parseInt(item.physical_index) || startPage
      })).filter((item: TocItem) => item.title.length > 0);
    } catch (error) {
      console.error('Error generating TOC:', error);
      return [];
    }
  }

  /**
   * Continue TOC generation for subsequent pages
   */
  private async generateTocContinue(existingToc: TocItem[], text: string, startPage: number): Promise<TocItem[]> {
    const lastStructureIdx = existingToc.length > 0 ? existingToc[existingToc.length - 1].structure : '0';
    
    const prompt = `You are continuing to analyze a document and extract section headers.

Previous sections already found:
${JSON.stringify(existingToc.slice(-5).map(t => ({ structure: t.structure, title: t.title })), null, 2)}

The last structure index was: ${lastStructureIdx}

Continue extracting NEW sections from the following text pages. Only return sections NOT already listed above.

Look for:
- Major headings in ALL CAPS
- Section headers indicating new topics
- Headers like "OTHER FINANCIAL INFORMATION", "CONDENSED CONSOLIDATED STATEMENTS", etc.

The text contains <physical_index_X> tags indicating page numbers.

Return a JSON array of NEW sections only:
[
    {
        "structure": "<continue numbering from ${lastStructureIdx}>",
        "title": "<section title, cleaned of extra whitespace>",
        "physical_index": <page number as integer>
    }
]

Return {"sections": []} if no new sections found.

Text to analyze:
${text}`;

    try {
      const content = await this.llmProvider.chat(
        [
          { role: 'system', content: 'You are a precise document structure analyzer. Output only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.1, jsonMode: true }
      );

      if (!content) return [];

      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.toc || parsed.sections || []);
      
      return items.map((item: any) => ({
        structure: String(item.structure || ''),
        title: String(item.title || '').replace(/\s+/g, ' ').trim(),
        physical_index: typeof item.physical_index === 'number' ? item.physical_index : parseInt(item.physical_index) || startPage
      })).filter((item: TocItem) => item.title.length > 0);
    } catch (error) {
      console.error('Error continuing TOC:', error);
      return [];
    }
  }

  /**
   * Convert TOC items to flat nodes with start/end indices
   */
  private tocToFlatNodes(tocItems: TocItem[], totalPages: number): Array<TocItem & { end_index: number }> {
    return tocItems.map((item, idx) => {
      const nextItem = tocItems[idx + 1];
      return {
        ...item,
        end_index: nextItem ? nextItem.physical_index - 1 : totalPages
      };
    });
  }

  /**
   * Build hierarchical tree from flat structure using structure index
   * Matches Python's post_processing
   */
  private buildHierarchyFromStructure(flatNodes: Array<TocItem & { end_index: number }>): TreeNode[] {
    if (flatNodes.length === 0) return [];

    const tree: TreeNode[] = [];
    const nodeStack: { node: TreeNode; level: number }[] = [];

    for (const item of flatNodes) {
      const level = (item.structure.match(/\./g) || []).length;
      
      const node: TreeNode = {
        node_id: this.generateNodeId(),
        title: item.title,
        summary: '', // Will be filled by generateSummaries
        start_index: item.physical_index,
        end_index: item.end_index,
        nodes: []
      };

      // Find the appropriate parent
      while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= level) {
        nodeStack.pop();
      }

      if (nodeStack.length === 0) {
        // Top-level node
        tree.push(node);
      } else {
        // Child of the last node in stack
        nodeStack[nodeStack.length - 1].node.nodes.push(node);
      }

      nodeStack.push({ node, level });
    }

    // Update end_index for parent nodes based on children
    this.updateParentEndIndices(tree);

    return tree;
  }

  /**
   * Update parent end_index to include all children
   */
  private updateParentEndIndices(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.nodes.length > 0) {
        this.updateParentEndIndices(node.nodes);
        const maxChildEnd = Math.max(...node.nodes.map(n => n.end_index));
        node.end_index = Math.max(node.end_index, maxChildEnd);
      }
    }
  }

  /**
   * Generate summaries for all nodes using LLM
   */
  private async generateSummaries(tree: TreeNode[], pages: string[]): Promise<void> {
    const allNodes = this.flattenTree(tree);
    
    // Generate summaries in batches
    const batchSize = 5;
    for (let i = 0; i < allNodes.length; i += batchSize) {
      const batch = allNodes.slice(i, i + batchSize);
      await Promise.all(batch.map(node => this.generateNodeSummary(node, pages)));
    }
  }

  /**
   * Generate summary for a single node
   */
  private async generateNodeSummary(node: TreeNode, pages: string[]): Promise<void> {
    // Get content for this node's page range
    const startIdx = Math.max(0, node.start_index - 1);
    const endIdx = Math.min(pages.length, node.end_index);
    const nodeContent = pages.slice(startIdx, endIdx).join('\n\n').slice(0, 4000);

    const prompt = `Summarize the following section titled "${node.title}" in 2-3 sentences. Focus on the key information and main points.

Content:
${nodeContent}

Provide a concise summary:`;

    try {
      const content = await this.llmProvider.chat(
        [
          { role: 'system', content: 'You are a precise document summarizer. Be concise and informative.' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.3, maxTokens: 300 }
      );

      node.summary = content?.trim() || '';
    } catch (error) {
      console.error(`Error generating summary for "${node.title}":`, error);
      node.summary = nodeContent.slice(0, 300) + '...';
    }
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    const id = this.nodeIdCounter.toString().padStart(4, '0');
    this.nodeIdCounter++;
    return id;
  }

  /**
   * Flatten tree to array
   */
  private flattenTree(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    const flatten = (nodeList: TreeNode[]) => {
      for (const node of nodeList) {
        result.push(node);
        if (node.nodes.length > 0) {
          flatten(node.nodes);
        }
      }
    };
    flatten(nodes);
    return result;
  }
}
