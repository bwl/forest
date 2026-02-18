#!/usr/bin/env bun
/**
 * wiki-import.ts — Wikipedia scale test for Forest
 *
 * Imports articles from HuggingFace's Simple English Wikipedia dataset
 * using a two-pass strategy: ingest nodes first, then link them.
 *
 * Phase 1 (default): sequential embedding, individual inserts, brute-force linking
 * Phase 2 (--batch-embed): batch embedding API, bulk inserts, optimized cosine
 *
 * Usage:
 *   bun scripts/wiki-import.ts --count 1000
 *   bun scripts/wiki-import.ts --count 10000 --batch-embed
 *   bun scripts/wiki-import.ts --count 100 --dry-run
 *   FOREST_EMBED_PROVIDER=mock bun scripts/wiki-import.ts --count 100
 */

import { parseArgs } from 'util';
import { randomUUID } from 'crypto';
import {
  insertNode,
  insertNodeBulk,
  insertEdgeBulk,
  beginBatch,
  endBatch,
  listNodes,
  listNodesForScoring,
  insertOrUpdateEdge,
  type NodeRecord,
  type EdgeRecord,
  type ScoringNode,
} from '../src/lib/db';
import {
  computeEmbeddingForNode,
  embedBatch,
  getEmbeddingProvider,
} from '../src/lib/embeddings';
import { extractTags, tokenize } from '../src/lib/text';
import {
  buildTagIdfContext,
  computeEdgeScore,
  computeTagScore,
  classifyEdgeScores,
  normalizeEdgePair,
  fuseEdgeScores,
  getSemanticThreshold,
  getTagThreshold,
  cosineBatchVsAll,
  type TagIdfContext,
} from '../src/lib/scoring';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '1000' },
    offset: { type: 'string', default: '0' },
    concurrency: { type: 'string', default: '3' },
    'no-link': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'batch-embed': { type: 'boolean', default: false },
  },
  strict: true,
});

const COUNT = parseInt(args.count!, 10);
const OFFSET = parseInt(args.offset!, 10);
const CONCURRENCY = parseInt(args.concurrency!, 10);
const NO_LINK = args['no-link']!;
const DRY_RUN = args['dry-run']!;
const BATCH_EMBED = args['batch-embed']!;

const HF_DATASET = 'wikimedia/wikipedia';
const HF_CONFIG = '20231101.simple';
const HF_SPLIT = 'train';
const PAGE_SIZE = 100;
const MAX_CHARS = 10_000;
const FORCED_TAGS = ['wikipedia', 'simple-english'];

// ---------------------------------------------------------------------------
// HuggingFace Dataset Viewer API
// ---------------------------------------------------------------------------

type HfArticle = {
  title: string;
  text: string;
  url: string;
  id: string;
};

async function fetchPage(offset: number, length: number): Promise<HfArticle[]> {
  const url = new URL('https://datasets-server.huggingface.co/rows');
  url.searchParams.set('dataset', HF_DATASET);
  url.searchParams.set('config', HF_CONFIG);
  url.searchParams.set('split', HF_SPLIT);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('length', String(length));

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429) {
        const wait = Math.min(60_000, 2_000 * 2 ** attempt);
        log(`  Rate limited, waiting ${(wait / 1000).toFixed(0)}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HF API ${res.status}: ${res.statusText}`);
      }
      const json: any = await res.json();
      return json.rows.map((r: any) => r.row as HfArticle);
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        const wait = 2_000 * 2 ** attempt;
        log(`  Fetch error: ${err.message}, retrying in ${(wait / 1000).toFixed(0)}s...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error('fetchPage: exhausted retries');
}

// ---------------------------------------------------------------------------
// Article preprocessing
// ---------------------------------------------------------------------------

function preprocessArticle(article: HfArticle): { title: string; body: string; tags: string[] } {
  const body = article.text.slice(0, MAX_CHARS);
  const fullText = `${article.title}\n${body}`;
  const tokenCounts = tokenize(fullText);
  const autoTags = extractTags(fullText, tokenCounts, 5);
  const tags = [...new Set([...FORCED_TAGS, ...autoTags])];
  return { title: article.title, body, tags };
}

// ---------------------------------------------------------------------------
// Concurrency-limited embedding (Phase 1)
// ---------------------------------------------------------------------------

async function embedWithConcurrency(
  items: Array<{ title: string; body: string }>,
  concurrency: number,
): Promise<(number[] | undefined)[]> {
  const results: (number[] | undefined)[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await computeEmbeddingForNode(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Pass 1: Ingest
// ---------------------------------------------------------------------------

type IngestedNode = NodeRecord;

async function ingestPass(): Promise<IngestedNode[]> {
  log(`\n=== Pass 1: Ingest ===`);
  log(`Target: ${COUNT} articles, offset: ${OFFSET}`);
  log(`Embedding: ${getEmbeddingProvider()}, batch: ${BATCH_EMBED}, concurrency: ${CONCURRENCY}`);
  log(`Dry run: ${DRY_RUN}\n`);

  const allNodes: IngestedNode[] = [];
  let fetched = 0;
  let totalEmbedMs = 0;
  let totalInsertMs = 0;

  while (fetched < COUNT) {
    const pageSize = Math.min(PAGE_SIZE, COUNT - fetched);
    const pageOffset = OFFSET + fetched;

    log(`Fetching page: offset=${pageOffset}, length=${pageSize}...`);
    const fetchStart = performance.now();
    const articles = await fetchPage(pageOffset, pageSize);
    const fetchMs = performance.now() - fetchStart;
    log(`  Fetched ${articles.length} articles in ${fetchMs.toFixed(0)}ms`);

    if (articles.length === 0) {
      log('  No more articles available, stopping.');
      break;
    }

    // Preprocess
    const processed = articles.map(preprocessArticle);

    // Embed
    const embedStart = performance.now();

    let embeddings: (number[] | undefined)[];
    if (BATCH_EMBED) {
      const texts = processed.map((p) => `${p.title}\n${p.body}`);
      embeddings = await embedBatch(texts);
    } else {
      embeddings = await embedWithConcurrency(
        processed.map((p) => ({ title: p.title, body: p.body })),
        CONCURRENCY,
      );
    }

    const embedMs = performance.now() - embedStart;
    totalEmbedMs += embedMs;
    const withEmbed = embeddings.filter((e) => e !== undefined).length;
    log(`  Embedded ${withEmbed}/${processed.length} in ${embedMs.toFixed(0)}ms`);

    // Build node records
    const now = new Date().toISOString();
    const nodes: IngestedNode[] = processed.map((p, i) => ({
      id: randomUUID(),
      title: p.title,
      body: p.body,
      tags: p.tags,
      tokenCounts: tokenize(`${p.title}\n${p.body}`),
      embedding: embeddings[i],
      createdAt: now,
      updatedAt: now,
      isChunk: false,
      parentDocumentId: null,
      chunkOrder: null,
      metadata: { origin: 'import' as const, createdBy: 'wiki-import' },
    }));

    if (!DRY_RUN) {
      const insertStart = performance.now();
      if (BATCH_EMBED) {
        // Phase 2: bulk insert, skip history
        await beginBatch();
        await insertNodeBulk(nodes, { skipHistory: true });
        await endBatch();
      } else {
        // Phase 1: individual inserts
        await beginBatch();
        for (const node of nodes) {
          await insertNode(node);
        }
        await endBatch();
      }
      const insertMs = performance.now() - insertStart;
      totalInsertMs += insertMs;
      log(`  Inserted ${nodes.length} nodes in ${insertMs.toFixed(0)}ms`);
    } else {
      log(`  [dry-run] Would insert ${nodes.length} nodes`);
    }

    allNodes.push(...nodes);
    fetched += articles.length;
    log(`  Progress: ${fetched}/${COUNT}`);
  }

  log(`\nPass 1 complete: ${allNodes.length} nodes`);
  log(`  Total embed time: ${(totalEmbedMs / 1000).toFixed(1)}s`);
  log(`  Total insert time: ${(totalInsertMs / 1000).toFixed(1)}s`);

  return allNodes;
}

// ---------------------------------------------------------------------------
// Pass 2: Link — brute-force (Phase 1) or optimized (Phase 2)
// ---------------------------------------------------------------------------

async function linkPass(newNodes: IngestedNode[]): Promise<void> {
  if (NO_LINK) {
    log('\n=== Pass 2: Link (skipped, --no-link) ===');
    return;
  }
  if (DRY_RUN) {
    log('\n=== Pass 2: Link (skipped, --dry-run) ===');
    return;
  }

  if (BATCH_EMBED) {
    await linkPassOptimized(newNodes);
  } else {
    await linkPassBruteForce(newNodes);
  }
}

async function linkPassBruteForce(newNodes: IngestedNode[]): Promise<void> {
  log(`\n=== Pass 2: Link (brute-force) ===`);

  const linkStart = performance.now();

  log('Loading all nodes...');
  const loadStart = performance.now();
  const allNodes = await listNodes();
  log(`  Loaded ${allNodes.length} nodes in ${((performance.now() - loadStart) / 1000).toFixed(1)}s`);

  log('Building tag IDF context...');
  const context = buildTagIdfContext(allNodes);

  const newNodeIds = new Set(newNodes.map((n) => n.id));

  log('Scoring edges...');
  const scoreStart = performance.now();
  let pairsChecked = 0;
  let edgesAccepted = 0;
  const edgeBatch: EdgeRecord[] = [];

  for (let i = 0; i < allNodes.length; i++) {
    const a = allNodes[i];
    if (!newNodeIds.has(a.id)) continue;

    for (let j = 0; j < allNodes.length; j++) {
      if (i === j) continue;
      const b = allNodes[j];
      if (newNodeIds.has(b.id) && a.id >= b.id) continue;

      pairsChecked++;
      const computed = computeEdgeScore(a, b, context);
      const status = classifyEdgeScores(computed.semanticScore, computed.tagScore, computed.sharedTags);

      if (status === 'accepted') {
        const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);
        edgeBatch.push({
          id: `${sourceId}::${targetId}`,
          sourceId,
          targetId,
          score: computed.score,
          semanticScore: computed.semanticScore,
          tagScore: computed.tagScore,
          sharedTags: computed.sharedTags,
          status: 'accepted',
          edgeType: 'semantic',
          metadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        edgesAccepted++;
      }
    }

    if ((i + 1) % 100 === 0 || i === allNodes.length - 1) {
      const elapsed = ((performance.now() - scoreStart) / 1000).toFixed(1);
      log(`  Scored from node ${i + 1}/${allNodes.length} — ${pairsChecked} pairs, ${edgesAccepted} edges (${elapsed}s)`);
    }
  }

  const scoreMs = performance.now() - scoreStart;
  log(`\nScoring complete: ${pairsChecked} pairs → ${edgesAccepted} edges in ${(scoreMs / 1000).toFixed(1)}s`);

  if (edgeBatch.length > 0) {
    log(`Inserting ${edgeBatch.length} edges...`);
    const insertStart = performance.now();
    await beginBatch();
    for (const edge of edgeBatch) {
      await insertOrUpdateEdge(edge);
    }
    await endBatch();
    log(`  Inserted in ${((performance.now() - insertStart) / 1000).toFixed(1)}s`);
  }

  log(`\nPass 2 complete in ${((performance.now() - linkStart) / 1000).toFixed(1)}s`);
}

async function linkPassOptimized(newNodes: IngestedNode[]): Promise<void> {
  log(`\n=== Pass 2: Link (optimized) ===`);

  const linkStart = performance.now();

  // Load lightweight scoring data
  log('Loading scoring data...');
  const loadStart = performance.now();
  const scoringNodes = await listNodesForScoring();
  log(`  Loaded ${scoringNodes.length} scoring nodes in ${((performance.now() - loadStart) / 1000).toFixed(1)}s`);

  // Build tag IDF context
  log('Building tag IDF context...');
  const context = buildTagIdfContext(scoringNodes);

  // Build index maps
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < scoringNodes.length; i++) {
    idToIdx.set(scoringNodes[i].id, i);
  }

  const newNodeIds = new Set(newNodes.map((n) => n.id));
  const newIndices = newNodes
    .map((n) => idToIdx.get(n.id))
    .filter((idx): idx is number => idx !== undefined);

  // Determine embedding dimension
  const firstEmbed = scoringNodes.find((n) => n.embedding)?.embedding;
  const dim = firstEmbed?.length ?? 384;

  // Pack embeddings into typed arrays for batch cosine
  log('Packing embeddings for batch cosine...');
  const allVecs = new Float32Array(scoringNodes.length * dim);
  const hasEmbedding = new Uint8Array(scoringNodes.length);
  for (let i = 0; i < scoringNodes.length; i++) {
    const emb = scoringNodes[i].embedding;
    if (emb && emb.length === dim) {
      allVecs.set(emb, i * dim);
      hasEmbedding[i] = 1;
    }
  }

  const queryVecs = new Float32Array(newIndices.length * dim);
  const queryHasEmbedding = new Uint8Array(newIndices.length);
  for (let qi = 0; qi < newIndices.length; qi++) {
    const globalIdx = newIndices[qi];
    if (hasEmbedding[globalIdx]) {
      queryVecs.set(allVecs.subarray(globalIdx * dim, (globalIdx + 1) * dim), qi * dim);
      queryHasEmbedding[qi] = 1;
    }
  }

  // Batch cosine similarity
  log('Computing batch cosine similarities...');
  const cosineStart = performance.now();
  const semanticThreshold = getSemanticThreshold();
  const semanticPairs = cosineBatchVsAll(queryVecs, allVecs, dim, semanticThreshold);
  const cosineMs = performance.now() - cosineStart;
  log(`  Batch cosine: ${semanticPairs.length} candidate pairs above ${semanticThreshold} in ${(cosineMs / 1000).toFixed(1)}s`);

  // Build a set of candidate pairs from semantic hits
  const candidatePairs = new Set<string>();
  const semanticScoreMap = new Map<string, number>();
  for (const pair of semanticPairs) {
    const globalQueryIdx = newIndices[pair.queryIdx];
    const globalTargetIdx = pair.targetIdx;
    if (globalQueryIdx === globalTargetIdx) continue;
    const aId = scoringNodes[globalQueryIdx].id;
    const bId = scoringNodes[globalTargetIdx].id;
    // Skip new-new pairs counted from the other direction
    if (newNodeIds.has(bId) && aId >= bId) continue;
    const [src, tgt] = normalizeEdgePair(aId, bId);
    const key = `${src}::${tgt}`;
    candidatePairs.add(key);
    semanticScoreMap.set(key, Math.max(0, Math.min(1, pair.similarity)));
  }

  // Also find tag-score candidates (iterate new nodes against all)
  log('Computing tag scores...');
  const tagStart = performance.now();
  const tagThreshold = getTagThreshold();
  let tagCandidatesAdded = 0;

  for (const newIdx of newIndices) {
    const a = scoringNodes[newIdx];
    for (let j = 0; j < scoringNodes.length; j++) {
      if (j === newIdx) continue;
      const b = scoringNodes[j];
      if (newNodeIds.has(b.id) && a.id >= b.id) continue;

      const tagResult = computeTagScore(a.tags, b.tags, context);
      if (tagResult.score !== null && tagResult.score >= tagThreshold) {
        const [src, tgt] = normalizeEdgePair(a.id, b.id);
        const key = `${src}::${tgt}`;
        if (!candidatePairs.has(key)) {
          candidatePairs.add(key);
          tagCandidatesAdded++;
        }
      }
    }
  }
  const tagMs = performance.now() - tagStart;
  log(`  Tag scoring: ${tagCandidatesAdded} additional candidates in ${(tagMs / 1000).toFixed(1)}s`);

  // Build final edges from all candidate pairs
  log(`Evaluating ${candidatePairs.size} candidate pairs...`);
  const evalStart = performance.now();
  const edgeBatch: EdgeRecord[] = [];
  const now = new Date().toISOString();

  for (const key of candidatePairs) {
    const [sourceId, targetId] = key.split('::');
    const aIdx = idToIdx.get(sourceId)!;
    const bIdx = idToIdx.get(targetId)!;
    const a = scoringNodes[aIdx];
    const b = scoringNodes[bIdx];

    // Get semantic score from cache or compute
    const cachedSemantic = semanticScoreMap.get(key);
    const semanticScore = cachedSemantic ?? (
      hasEmbedding[aIdx] && hasEmbedding[bIdx]
        ? (() => {
            let dot = 0, magA = 0, magB = 0;
            const aOff = aIdx * dim, bOff = bIdx * dim;
            for (let d = 0; d < dim; d++) {
              const x = allVecs[aOff + d], y = allVecs[bOff + d];
              dot += x * y; magA += x * x; magB += y * y;
            }
            return magA > 0 && magB > 0 ? Math.max(0, Math.min(1, dot / (Math.sqrt(magA) * Math.sqrt(magB)))) : null;
          })()
        : null
    );

    const tagResult = computeTagScore(a.tags, b.tags, context);
    const status = classifyEdgeScores(semanticScore ?? null, tagResult.score, tagResult.sharedTags);

    if (status === 'accepted') {
      const score = fuseEdgeScores(semanticScore ?? null, tagResult.score);
      edgeBatch.push({
        id: key,
        sourceId,
        targetId,
        score,
        semanticScore: semanticScore ?? null,
        tagScore: tagResult.score,
        sharedTags: tagResult.sharedTags,
        status: 'accepted',
        edgeType: 'semantic',
        metadata: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const evalMs = performance.now() - evalStart;
  log(`  Accepted ${edgeBatch.length} edges in ${(evalMs / 1000).toFixed(1)}s`);

  // Bulk insert edges
  if (edgeBatch.length > 0) {
    log(`Inserting ${edgeBatch.length} edges...`);
    const insertStart = performance.now();
    await beginBatch();
    await insertEdgeBulk(edgeBatch);
    await endBatch();
    log(`  Inserted in ${((performance.now() - insertStart) / 1000).toFixed(1)}s`);
  }

  log(`\nPass 2 complete in ${((performance.now() - linkStart) / 1000).toFixed(1)}s`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const t0 = performance.now();
  log('=== Forest Wikipedia Import ===');
  log(`Count: ${COUNT}, Offset: ${OFFSET}, Provider: ${getEmbeddingProvider()}`);
  if (BATCH_EMBED) log('Mode: Phase 2 (batch embedding + bulk insert + optimized linking)');
  else log('Mode: Phase 1 (sequential embedding + individual insert + brute-force linking)');

  const newNodes = await ingestPass();
  await linkPass(newNodes);

  const totalMs = performance.now() - t0;
  log(`\n=== Done in ${(totalMs / 1000).toFixed(1)}s ===`);
  log(`Imported ${newNodes.length} nodes`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
