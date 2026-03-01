/**
 * LLM Tree Searcher
 * Uses LLM reasoning to navigate document tree and find relevant content
 * Core implementation of the PageIndex vectorless RAG approach
 */

import { 
  TreeNode, 
  SearchResult, 
  SearchOptions, 
  LLMSearchResponse,
  LLMProvider
} from '../types';
import { TreeBuilder } from './TreeBuilder';
import { OpenAIProvider } from './OpenAIProvider';

export interface TreeSearcherConfig {
  openaiApiKey?: string;
  model?: string;
  maxIterations?: number;
  confidenceThreshold?: number;
  llmProvider?: LLMProvider;  // Custom LLM provider
}

export class LLMTreeSearcher {
  private llmProvider: LLMProvider;
  private treeBuilder: TreeBuilder;
  private config: TreeSearcherConfig;

  constructor(config: TreeSearcherConfig) {
    this.config = {
      maxIterations: 5,
      confidenceThreshold: 0.7,
      model: 'gpt-4o-mini',
      ...config
    };

    // Use custom provider if provided, otherwise default to OpenAI
    if (config.llmProvider) {
      this.llmProvider = config.llmProvider;
    } else if (config.openaiApiKey) {
      this.llmProvider = new OpenAIProvider({
        apiKey: config.openaiApiKey,
        model: this.config.model
      });
    } else {
      throw new Error('Either llmProvider or openaiApiKey must be provided');
    }

    this.treeBuilder = new TreeBuilder();
  }

  /**
   * Search for relevant content using LLM reasoning
   */
  async search(
    query: string,
    tree: TreeNode[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK || 3;
    const maxIterations = options.maxIterations || this.config.maxIterations || 5;
    const includeReasoning = options.includeReasoning ?? true;

    const results: SearchResult[] = [];
    const visited = new Set<string>();
    const reasoningLog: string[] = [];

    // Start with root level nodes
    let currentNodes = tree;
    let iteration = 0;

    while (iteration < maxIterations && currentNodes.length > 0) {
      iteration++;

      // Filter out already visited nodes
      const availableNodes = currentNodes.filter(n => !visited.has(n.node_id));
      if (availableNodes.length === 0) break;

      // Ask LLM to evaluate which nodes are most relevant
      const response = await this.evaluateNodes(query, availableNodes, iteration);
      
      if (includeReasoning) {
        reasoningLog.push(`Iteration ${iteration}: ${response.reasoning}`);
      }

      // Mark selected nodes as visited
      for (const nodeId of response.selectedNodes) {
        visited.add(nodeId);
      }

      // If LLM found the answer, add to results
      if (response.foundAnswer || response.confidence === 'HIGH') {
        for (const nodeId of response.selectedNodes) {
          const node = this.findNode(tree, nodeId);
          if (node) {
            const path = this.treeBuilder.getNodePath(tree, nodeId) || [];
            results.push({
              node_id: node.node_id,
              title: node.title,
              content: node.content || node.summary,
              summary: node.summary,
              score: this.confidenceToScore(response.confidence),
              path,
              reasoning: includeReasoning ? reasoningLog.join('\n') : undefined
            });
          }
        }
        
        if (response.foundAnswer) break;
      }

      // Collect children of selected nodes for next iteration
      const nextNodes: TreeNode[] = [];
      for (const nodeId of response.selectedNodes) {
        const node = this.findNode(tree, nodeId);
        if (node && node.nodes.length > 0) {
          nextNodes.push(...node.nodes);
        }
      }

      currentNodes = nextNodes;

      // If confidence is LOW, also add medium confidence nodes
      if (response.confidence === 'LOW' && nextNodes.length === 0) {
        // Broaden search to siblings
        const allNodes = this.treeBuilder.flattenTree(tree);
        currentNodes = allNodes.filter(n => !visited.has(n.node_id)).slice(0, 10);
      }
    }

    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Iterative search with detailed logging (for demonstration)
   */
  async searchWithLog(
    query: string,
    tree: TreeNode[],
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    iterations: Array<{
      iteration: number;
      nodesEvaluated: string[];
      selectedNodes: string[];
      reasoning: string;
      confidence: string;
      foundAnswer: boolean;
    }>;
  }> {
    const maxIterations = options.maxIterations || this.config.maxIterations || 5;
    const iterations: Array<{
      iteration: number;
      nodesEvaluated: string[];
      selectedNodes: string[];
      reasoning: string;
      confidence: string;
      foundAnswer: boolean;
    }> = [];

    const results: SearchResult[] = [];
    const visited = new Set<string>();

    let currentNodes = tree;
    let iteration = 0;

    while (iteration < maxIterations && currentNodes.length > 0) {
      iteration++;
      
      const availableNodes = currentNodes.filter(n => !visited.has(n.node_id));
      if (availableNodes.length === 0) break;

      const response = await this.evaluateNodes(query, availableNodes, iteration);

      iterations.push({
        iteration,
        nodesEvaluated: availableNodes.map(n => `${n.node_id}: ${n.title}`),
        selectedNodes: response.selectedNodes,
        reasoning: response.reasoning,
        confidence: response.confidence,
        foundAnswer: response.foundAnswer
      });

      for (const nodeId of response.selectedNodes) {
        visited.add(nodeId);
        
        const node = this.findNode(tree, nodeId);
        if (node) {
          const path = this.treeBuilder.getNodePath(tree, nodeId) || [];
          results.push({
            node_id: node.node_id,
            title: node.title,
            content: node.content || node.summary,
            summary: node.summary,
            score: this.confidenceToScore(response.confidence),
            path
          });
        }
      }

      if (response.foundAnswer) break;

      // Get children for next iteration
      const nextNodes: TreeNode[] = [];
      for (const nodeId of response.selectedNodes) {
        const node = this.findNode(tree, nodeId);
        if (node && node.nodes.length > 0) {
          nextNodes.push(...node.nodes);
        }
      }

      currentNodes = nextNodes;
    }

    return { results, iterations };
  }

  /**
   * Ask LLM to evaluate which nodes are relevant
   */
  private async evaluateNodes(
    query: string,
    nodes: TreeNode[],
    iteration: number
  ): Promise<LLMSearchResponse> {
    const nodesDescription = nodes.map(node => ({
      id: node.node_id,
      title: node.title,
      summary: node.summary.substring(0, 300),
      hasChildren: node.nodes.length > 0
    }));

    const prompt = `You are a document analysis assistant. Your task is to identify which sections of a document are most relevant to answer a user's question.

QUESTION: "${query}"

AVAILABLE SECTIONS (Iteration ${iteration}):
${JSON.stringify(nodesDescription, null, 2)}

INSTRUCTIONS:
1. Analyze each section's title and summary
2. Select the sections most likely to contain the answer
3. If a section has children and the answer might be deeper, select it for drill-down
4. Rate your confidence: LOW, MEDIUM, or HIGH
5. Set foundAnswer to true only if you're confident the selected section(s) directly answer the question

Respond in JSON format:
{
  "selectedNodes": ["nodeId1", "nodeId2"],
  "reasoning": "Brief explanation of why these nodes were selected",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "foundAnswer": true | false
}`;

    try {
      const content = await this.llmProvider.chat(
        [
          { role: 'system', content: 'You are a precise document analysis assistant. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.1, jsonMode: true }
      );

      if (!content) {
        throw new Error('No response from LLM');
      }

      const parsed = JSON.parse(content);
      
      return {
        selectedNodes: Array.isArray(parsed.selectedNodes) ? parsed.selectedNodes : [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: this.validateConfidence(parsed.confidence),
        foundAnswer: Boolean(parsed.foundAnswer)
      };
    } catch (error) {
      console.error('LLM evaluation error:', error);
      // Fallback: select first few nodes
      return {
        selectedNodes: nodes.slice(0, 2).map(n => n.node_id),
        reasoning: 'Fallback selection due to LLM error',
        confidence: 'LOW',
        foundAnswer: false
      };
    }
  }

  /**
   * Find a node by ID in the tree
   */
  private findNode(nodes: TreeNode[], nodeId: string): TreeNode | null {
    for (const node of nodes) {
      if (node.node_id === nodeId) return node;
      if (node.nodes.length > 0) {
        const found = this.findNode(node.nodes, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Convert confidence level to numeric score
   */
  private confidenceToScore(confidence: string): number {
    switch (confidence) {
      case 'HIGH': return 1.0;
      case 'MEDIUM': return 0.7;
      case 'LOW': return 0.4;
      default: return 0.5;
    }
  }

  /**
   * Validate confidence value
   */
  private validateConfidence(value: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const upper = String(value).toUpperCase();
    if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
      return upper as 'LOW' | 'MEDIUM' | 'HIGH';
    }
    return 'MEDIUM';
  }

  /**
   * Get current configuration
   */
  getConfig(): TreeSearcherConfig {
    return { ...this.config };
  }
}
