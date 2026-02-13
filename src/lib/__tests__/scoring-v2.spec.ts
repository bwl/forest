import { describe, expect, it } from 'bun:test';

import { buildTagIdfContext, classifyEdgeScores, computeTagScore, fuseEdgeScores } from '../scoring';

describe('scoring v2: tag score', () => {
  it('returns null when there are no shared tags', () => {
    const context = buildTagIdfContext([{ tags: ['a'] }, { tags: ['b'] }]);
    const result = computeTagScore(['a'], ['b'], context);
    expect(result.score).toBeNull();
    expect(result.sharedTags).toEqual([]);
    expect(result.components.jaccard).toBe(0);
  });

  it('computes IDF-weighted Jaccard with normalization', () => {
    // N=4, doc_freq(link/x)=2 -> idf=ln(2), maxIdf=ln(4)
    const context = buildTagIdfContext([
      { tags: ['link/x'] },
      { tags: ['link/x'] },
      { tags: ['other'] },
      { tags: ['misc'] },
    ]);

    const result = computeTagScore(['link/x'], ['link/x'], context);
    const expected = Math.log(4 / 2) / Math.log(4 / 1);
    expect(result.score).not.toBeNull();
    expect(result.sharedTags).toEqual(['link/x']);
    expect(result.score as number).toBeCloseTo(expected, 6);
  });

  it('boosts bridge tags even when shared with common tags', () => {
    const context = buildTagIdfContext([
      { tags: ['docs', 'link/x', 'a'] },
      { tags: ['docs', 'link/x', 'b'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
      { tags: ['docs'] },
    ]);

    const result = computeTagScore(['docs', 'link/x', 'a'], ['docs', 'link/x', 'b'], context);
    const expectedBridge = Math.log(10 / 2) / Math.log(10 / 1);

    expect(result.score).not.toBeNull();
    expect(result.sharedTags).toEqual(['docs', 'link/x']);
    expect(result.components.bridgeTags).toBe('link/x');
    expect(result.components.bridgeScore as number).toBeCloseTo(expectedBridge, 6);
    expect(result.score as number).toBeCloseTo(expectedBridge, 6);
  });
});

describe('scoring v2: edge classification', () => {
  it('accepts if either layer meets its threshold', () => {
    const prevSemantic = process.env.FOREST_SEMANTIC_THRESHOLD;
    const prevTags = process.env.FOREST_TAG_THRESHOLD;

    process.env.FOREST_SEMANTIC_THRESHOLD = '0.8';
    process.env.FOREST_TAG_THRESHOLD = '0.4';

    try {
      expect(classifyEdgeScores(0.81, null)).toBe('accepted');
      expect(classifyEdgeScores(null, 0.41)).toBe('accepted');
      expect(classifyEdgeScores(0.79, 0.39)).toBe('discard');
    } finally {
      if (prevSemantic === undefined) delete process.env.FOREST_SEMANTIC_THRESHOLD;
      else process.env.FOREST_SEMANTIC_THRESHOLD = prevSemantic;

      if (prevTags === undefined) delete process.env.FOREST_TAG_THRESHOLD;
      else process.env.FOREST_TAG_THRESHOLD = prevTags;
    }
  });

  it('accepts low-signal shared project edges when fused score clears project floor', () => {
    const prevSemantic = process.env.FOREST_SEMANTIC_THRESHOLD;
    const prevTags = process.env.FOREST_TAG_THRESHOLD;
    const prevProjectFloor = process.env.FOREST_PROJECT_EDGE_FLOOR;

    process.env.FOREST_SEMANTIC_THRESHOLD = '0.8';
    process.env.FOREST_TAG_THRESHOLD = '0.6';
    process.env.FOREST_PROJECT_EDGE_FLOOR = '0.25';

    try {
      expect(classifyEdgeScores(0.3, 0.25, ['project:gobot'])).toBe('accepted');
      expect(classifyEdgeScores(0.3, 0.25, ['docs'])).toBe('discard');
    } finally {
      if (prevSemantic === undefined) delete process.env.FOREST_SEMANTIC_THRESHOLD;
      else process.env.FOREST_SEMANTIC_THRESHOLD = prevSemantic;

      if (prevTags === undefined) delete process.env.FOREST_TAG_THRESHOLD;
      else process.env.FOREST_TAG_THRESHOLD = prevTags;

      if (prevProjectFloor === undefined) delete process.env.FOREST_PROJECT_EDGE_FLOOR;
      else process.env.FOREST_PROJECT_EDGE_FLOOR = prevProjectFloor;
    }
  });
});

describe('scoring v2: fused edge score', () => {
  it('rewards consensus over one-sided matches', () => {
    const strongConsensus = fuseEdgeScores(0.75, 0.72);
    const oneSided = fuseEdgeScores(0.9, 0.05);
    expect(strongConsensus).toBeGreaterThan(oneSided);
  });
});
