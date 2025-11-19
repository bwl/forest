/**
 * TypeScript type definitions for Tauri commands
 *
 * These types match the Rust command signatures in src-tauri/src/commands.rs
 * and enable type-safe invocations from the React frontend.
 */

import { invoke } from '@tauri-apps/api/core';

// Browser-only dev falls back to a friendly error instead of crashing when Tauri isn't present.
const hasTauriBackend =
  typeof window !== 'undefined' &&
  typeof (window as any).__TAURI_IPC__ === 'function';

function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!hasTauriBackend) {
    return Promise.reject(
      new Error(
        [
          'Forest Desktop backend is not available.',
          'Launch via `bun run tauri dev` or the packaged app so Tauri APIs are injected.',
        ].join(' '),
      ),
    );
  }
  return invoke<T>(command, args);
}

// ===== Type Definitions =====

export interface ForestStats {
  nodes: number;
  edges: number;
  suggested: number;
}

export interface SearchResult {
  id: string;
  title: string;
  body: string;
  tags: string[];
  similarity: number;
}

export interface NodeDetail {
  id: string;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface NodeConnection {
  node_id: string;
  title: string;
  score: number;
  edge_type: string;
}

export interface NodeCreationResult {
  id: string;
  title: string;
  accepted_edges: number;
  suggested_edges: number;
}

export interface EdgeProposal {
  edge_id: string;
  source_id: string;
  source_title: string;
  target_id: string;
  target_title: string;
  score: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  position_x: number | null;
  position_y: number | null;
  connection_count: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  score: number;
}

// ===== Command Wrappers =====

/**
 * Get graph statistics (node count, edge count, suggestion count)
 */
export async function getStats(): Promise<ForestStats> {
  return safeInvoke<ForestStats>('get_stats');
}

/**
 * Search nodes using semantic similarity
 *
 * @param query - Search query text
 * @param limit - Maximum number of results to return
 */
export async function searchNodes(query: string, limit: number = 10): Promise<SearchResult[]> {
  return safeInvoke<SearchResult[]>('search_nodes', { query, limit });
}

/**
 * Get a single node by ID
 *
 * @param id - Node ID (supports short ID prefixes)
 */
export async function getNode(id: string): Promise<NodeDetail> {
  return safeInvoke<NodeDetail>('get_node', { id });
}

/**
 * Get all connected nodes for a given node
 *
 * @param id - Node ID
 * @returns Array of connected nodes with scores
 */
export async function getNodeConnections(id: string): Promise<NodeConnection[]> {
  return safeInvoke<NodeConnection[]>('get_node_connections', { id });
}

/**
 * Create a new node with optional auto-linking
 *
 * @param title - Node title
 * @param body - Node body content
 * @param tags - Optional array of tags (auto-extracted if not provided)
 * @param autoLink - Whether to auto-link against existing nodes (default: true)
 */
export async function createNode(
  title: string,
  body: string,
  tags?: string[],
  autoLink: boolean = true
): Promise<NodeCreationResult> {
  return safeInvoke<NodeCreationResult>('create_node', {
    title,
    body,
    tags: tags ?? null,
    autoLink
  });
}

/**
 * Get edge proposals (suggested edges awaiting review)
 *
 * @param limit - Maximum number of proposals to return
 */
export async function getEdgeProposals(limit: number = 20): Promise<EdgeProposal[]> {
  return safeInvoke<EdgeProposal[]>('get_edge_proposals', { limit });
}

/**
 * Accept an edge proposal (change status from suggested to accepted)
 *
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 */
export async function acceptEdge(sourceId: string, targetId: string): Promise<void> {
  return safeInvoke<void>('accept_edge', { sourceId, targetId });
}

/**
 * Reject an edge proposal (delete it)
 *
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 */
export async function rejectEdge(sourceId: string, targetId: string): Promise<void> {
  return safeInvoke<void>('reject_edge', { sourceId, targetId });
}

/**
 * Get all nodes and edges for graph visualization
 */
export async function getGraphData(): Promise<GraphData> {
  return safeInvoke<GraphData>('get_graph_data');
}

/**
 * Update node position for graph persistence
 *
 * @param id - Node ID
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export async function updateNodePosition(id: string, x: number, y: number): Promise<void> {
  return safeInvoke<void>('update_node_position', { id, x, y });
}

/**
 * Quick node creation from command palette (text only)
 *
 * @param text - Text content (smart title/body split)
 */
export async function createNodeQuick(text: string): Promise<NodeCreationResult> {
  return safeInvoke<NodeCreationResult>('create_node_quick', { text });
}

/**
 * Update node content (title, body, and/or tags)
 *
 * @param id - Node ID
 * @param title - Optional new title
 * @param body - Optional new body
 * @param tags - Optional new tags array
 */
export async function updateNode(
  id: string,
  title?: string,
  body?: string,
  tags?: string[]
): Promise<void> {
  return safeInvoke<void>('update_node', {
    id,
    title: title ?? null,
    body: body ?? null,
    tags: tags ?? null,
  });
}
