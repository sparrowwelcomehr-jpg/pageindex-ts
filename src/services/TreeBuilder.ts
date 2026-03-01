/**
 * Tree Builder Service
 * Builds hierarchical tree structures from parsed documents
 * Following Single Responsibility Principle
 */

import { TreeNode, DocumentSection, ParsedDocument } from '../types';

export interface TreeBuilderOptions {
  generateSummaries?: boolean;
  maxSummaryLength?: number;
  includeContent?: boolean;
}

export class TreeBuilder {
  private nodeIdCounter: number = 0;
  private options: TreeBuilderOptions;

  constructor(options: TreeBuilderOptions = {}) {
    this.options = {
      generateSummaries: true,
      maxSummaryLength: 500,
      includeContent: false,
      ...options
    };
  }

  /**
   * Build a hierarchical tree from a parsed document
   */
  buildTree(document: ParsedDocument): TreeNode[] {
    this.nodeIdCounter = 0;
    
    if (document.sections.length === 0) {
      // No sections found - create a single root node
      return [{
        node_id: this.generateNodeId(),
        title: document.metadata.title || 'Document',
        summary: this.createSummary(document.content),
        content: this.options.includeContent ? document.content : undefined,
        start_index: 1,
        end_index: 1,
        nodes: []
      }];
    }

    // Sort sections by start index
    const sortedSections = [...document.sections].sort(
      (a, b) => a.startIndex - b.startIndex
    );

    // Build hierarchical tree recursively
    return this.buildHierarchy(sortedSections, 0, sortedSections.length, document.content);
  }

  /**
   * Build hierarchy recursively based on section levels
   */
  private buildHierarchy(
    sections: DocumentSection[],
    start: number,
    end: number,
    fullContent: string
  ): TreeNode[] {
    if (start >= end) return [];

    const nodes: TreeNode[] = [];
    let i = start;

    while (i < end) {
      const section = sections[i];
      const currentLevel = section.level;

      // Find the range of child sections (sections with higher level numbers)
      let childEnd = i + 1;
      while (childEnd < end && sections[childEnd].level > currentLevel) {
        childEnd++;
      }

      // Get content for this section
      const nextSection = sections[i + 1];
      const contentEnd = nextSection ? nextSection.startIndex : section.endIndex;
      const sectionContent = fullContent.substring(section.startIndex, contentEnd);

      // Build children recursively
      const childNodes = this.buildHierarchy(sections, i + 1, childEnd, fullContent);

      // Create node (using snake_case to match Python)
      const node: TreeNode = {
        node_id: this.generateNodeId(),
        title: section.title,
        summary: this.createSummary(section.content || sectionContent),
        content: this.options.includeContent ? sectionContent : undefined,
        start_index: section.lineNumber || i + 1,
        end_index: childNodes.length > 0 ? this.getMaxEndIndex(childNodes) : (section.lineNumber || i + 1),
        nodes: childNodes
      };

      nodes.push(node);
      i = childEnd;
    }

    return nodes;
  }

  /**
   * Get max end_index from child nodes
   */
  private getMaxEndIndex(nodes: TreeNode[]): number {
    let maxIdx = 0;
    for (const node of nodes) {
      maxIdx = Math.max(maxIdx, node.end_index);
      if (node.nodes.length > 0) {
        maxIdx = Math.max(maxIdx, this.getMaxEndIndex(node.nodes));
      }
    }
    return maxIdx;
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
   * Create summary from content
   */
  private createSummary(content: string): string {
    if (!this.options.generateSummaries || !content) {
      return '';
    }

    // Clean and truncate content for summary
    let summary = content
      .replace(/\s+/g, ' ')
      .replace(/[#*_`]/g, '')
      .trim();

    const maxLength = this.options.maxSummaryLength || 500;
    
    if (summary.length > maxLength) {
      // Try to break at a sentence boundary
      const truncated = summary.substring(0, maxLength);
      const lastSentence = truncated.lastIndexOf('. ');
      
      if (lastSentence > maxLength / 2) {
        summary = truncated.substring(0, lastSentence + 1);
      } else {
        summary = truncated + '...';
      }
    }

    return summary;
  }

  /**
   * Flatten tree to array of nodes (useful for search)
   */
  flattenTree(nodes: TreeNode[]): TreeNode[] {
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

  /**
   * Find a node by ID in the tree
   */
  findNodeById(nodes: TreeNode[], nodeId: string): TreeNode | null {
    for (const node of nodes) {
      if (node.node_id === nodeId) {
        return node;
      }
      if (node.nodes.length > 0) {
        const found = this.findNodeById(node.nodes, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get path to a node (breadcrumb trail)
   */
  getNodePath(nodes: TreeNode[], nodeId: string, path: string[] = []): string[] | null {
    for (const node of nodes) {
      const currentPath = [...path, node.title];
      
      if (node.node_id === nodeId) {
        return currentPath;
      }
      
      if (node.nodes.length > 0) {
        const found = this.getNodePath(node.nodes, nodeId, currentPath);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get all children IDs of a node (recursive)
   */
  getAllChildrenIds(node: TreeNode): string[] {
    const ids: string[] = [];
    
    const collect = (n: TreeNode) => {
      for (const child of n.nodes) {
        ids.push(child.node_id);
        collect(child);
      }
    };

    collect(node);
    return ids;
  }

  /**
   * Calculate tree statistics
   */
  getTreeStats(nodes: TreeNode[]): {
    totalNodes: number;
    maxDepth: number;
    avgChildrenPerNode: number;
  } {
    let totalNodes = 0;
    let maxDepth = 0;
    let totalChildren = 0;
    let nonLeafNodes = 0;

    const analyze = (nodeList: TreeNode[], depth: number) => {
      for (const node of nodeList) {
        totalNodes++;
        maxDepth = Math.max(maxDepth, depth);
        
        if (node.nodes.length > 0) {
          totalChildren += node.nodes.length;
          nonLeafNodes++;
          analyze(node.nodes, depth + 1);
        }
      }
    };

    analyze(nodes, 1);

    return {
      totalNodes,
      maxDepth,
      avgChildrenPerNode: nonLeafNodes > 0 ? totalChildren / nonLeafNodes : 0
    };
  }

  /**
   * Print tree structure (for debugging)
   */
  printTree(nodes: TreeNode[], indent: number = 0): string {
    let output = '';
    const prefix = '  '.repeat(indent);

    for (const node of nodes) {
      output += `${prefix}[${node.node_id}] ${node.title}\n`;
      if (node.nodes.length > 0) {
        output += this.printTree(node.nodes, indent + 1);
      }
    }

    return output;
  }
}
