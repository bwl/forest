/**
 * IForestBackend — unified interface for local and remote Forest operations.
 *
 * Both ForestClient (HTTP) and LocalBackend (direct core calls) implement this.
 * All return types use the API response types from client.ts.
 */

import type {
  CreateNodeInput,
  CreateNodeResult,
  GetNodeResult,
  ListNodesResult,
  DeleteNodeResult,
  UpdateNodeInput,
  UpdateNodeResult,
  SearchResult,
  MetadataSearchOptions,
  MetadataSearchResult,
  ListEdgesResult,
  CreateEdgeInput,
  CreateEdgeResult,
  DeleteEdgeResult,
  ExplainEdgeResult,
  ListTagsResult,
  RenameTagResult,
  GetNodesByTagResult,
  TagStatsResult,
  AddTagsResult,
  RemoveTagsResult,
  SynthesizeInput,
  SynthesizeResult,
  WriteInput,
  WriteResult,
  ImportInput,
  ImportResult,
  PathResult,
  LinkNodesInput,
  LinkNodesResult,
  NeighborhoodResult,
  ExportJsonResult,
  ListDocumentsResult,
  GetDocumentResult,
  GetDocumentChunksResult,
  DeleteDocumentResult,
  DocumentStatsResult,
  EdgeThresholdsResult,
  SuggestResultRemote,
  HealthResult,
  StatsResult,
  NodeSummary,
  ContextResultRemote,
} from './client';

export interface IForestBackend {
  readonly isRemote: boolean;

  // ── Nodes ──────────────────────────────────────────────────────────
  createNode(data: CreateNodeInput): Promise<CreateNodeResult>;
  getNode(id: string, opts?: { includeBody?: boolean; includeEdges?: boolean }): Promise<GetNodeResult>;
  listNodes(opts?: { limit?: number; offset?: number; sort?: string; order?: string }): Promise<ListNodesResult>;
  deleteNode(id: string): Promise<DeleteNodeResult>;
  updateNode(id: string, data: UpdateNodeInput): Promise<UpdateNodeResult>;

  // ── Search ─────────────────────────────────────────────────────────
  searchSemantic(q: string, opts?: { limit?: number; offset?: number; minScore?: number; tags?: string }): Promise<SearchResult>;
  searchMetadata(opts: MetadataSearchOptions): Promise<MetadataSearchResult>;

  // ── Edges ──────────────────────────────────────────────────────────
  listEdges(opts?: { limit?: number; offset?: number; nodeId?: string }): Promise<ListEdgesResult>;
  createEdge(data: CreateEdgeInput): Promise<CreateEdgeResult>;
  deleteEdge(ref: string): Promise<DeleteEdgeResult>;
  explainEdge(ref: string): Promise<ExplainEdgeResult>;

  // ── Tags ───────────────────────────────────────────────────────────
  listTags(opts?: { sort?: string; order?: string }): Promise<ListTagsResult>;
  renameTag(oldName: string, newName: string): Promise<RenameTagResult>;
  getNodesByTag(name: string, opts?: { limit?: number; offset?: number }): Promise<GetNodesByTagResult>;
  getTagStats(opts?: { focusTag?: string; minCount?: number; top?: number }): Promise<TagStatsResult>;
  addTags(nodeId: string, tags: string[]): Promise<AddTagsResult>;
  removeTags(nodeId: string, tags: string[]): Promise<RemoveTagsResult>;

  // ── Synthesize / Write ─────────────────────────────────────────────
  synthesize(data: SynthesizeInput): Promise<SynthesizeResult>;
  write(data: WriteInput): Promise<WriteResult>;

  // ── Import ─────────────────────────────────────────────────────────
  importDocument(data: ImportInput): Promise<ImportResult>;

  // ── Graph ──────────────────────────────────────────────────────────
  findPath(from: string, to: string): Promise<PathResult>;
  linkNodes(data: LinkNodesInput): Promise<LinkNodesResult>;
  getNeighborhood(id: string, opts?: { depth?: number; limit?: number }): Promise<NeighborhoodResult>;

  // ── Export ─────────────────────────────────────────────────────────
  exportJson(opts?: { body?: boolean; edges?: boolean }): Promise<ExportJsonResult>;
  exportGraphviz(opts: { id: string; depth?: number; limit?: number }): Promise<{ dot: string }>;

  // ── Documents ──────────────────────────────────────────────────────
  listDocuments(): Promise<ListDocumentsResult>;
  getDocument(id: string): Promise<GetDocumentResult>;
  getDocumentChunks(id: string): Promise<GetDocumentChunksResult>;
  deleteDocument(id: string): Promise<DeleteDocumentResult>;
  getDocumentStats(): Promise<DocumentStatsResult>;

  // ── Context ────────────────────────────────────────────────────────
  getContext(opts: { tag?: string; query?: string; budget?: number }): Promise<ContextResultRemote>;

  // ── System ─────────────────────────────────────────────────────────
  getEdgeThresholds(): Promise<EdgeThresholdsResult>;
  suggest(opts?: { project?: string; limit?: number }): Promise<SuggestResultRemote>;
  getHealth(): Promise<HealthResult>;
  getStats(opts?: { top?: number }): Promise<StatsResult>;
}
