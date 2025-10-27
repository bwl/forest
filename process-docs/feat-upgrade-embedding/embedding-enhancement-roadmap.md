# Forest Embedding Enhancement Roadmap

**Date:** 2025-10-20
**Version:** 1.0
**Status:** Proposed

---

## Vision

**Make Forest the best-in-class personal knowledge base for semantic discovery**, with embedding quality that rivals commercial tools while maintaining our offline-first, privacy-preserving philosophy.

---

## Guiding Principles

1. **Default to Great** - Out-of-box experience should be excellent
2. **Progressive Enhancement** - Power users can unlock more quality
3. **Privacy First** - Local models always available
4. **No Lock-In** - Easy to switch providers/models
5. **Transparent Costs** - Users understand tradeoffs

---

## Three-Phase Roadmap

### Phase 1: Quality Foundation (v0.4 - Q1 2026)

**Goal:** Improve default embedding quality 20-25% with minimal user impact

#### 1.1 Upgrade Default Local Model

**Current:** `Xenova/all-MiniLM-L6-v2` (384-dim, 2021 model)
**Target:** `stella-base-en-v2` (768-dim, 2024 model)

**Tasks:**
- [ ] Benchmark Stella vs current on test corpus
- [ ] Update default in `src/lib/embeddings.ts`
- [ ] Add first-time model download progress indicator
- [ ] Document model upgrade in CHANGELOG
- [ ] Provide `FOREST_EMBED_LOCAL_MODEL` override for old hardware

**Implementation:**
```typescript
// src/lib/embeddings.ts
const DEFAULT_LOCAL_MODEL =
  process.env.FOREST_EMBED_LOCAL_MODEL || 'stella-base-en-v2';

// Add download progress
async function downloadModelWithProgress(model: string) {
  console.log(`📥 Downloading ${model} (~400MB, first time only)...`);
  // Show progress bar
}
```

**Testing:**
- Measure precision/recall improvement
- Verify model size acceptable (~400MB)
- Test on low-end hardware (8GB RAM)
- Survey beta users on quality

**Expected Impact:**
- ✅ 20-25% better suggestion quality
- ✅ Better handling of abstract concepts
- ⚠️ Slower first capture (model download)
- ⚠️ ~4x slower embedding (200ms vs 50ms)

**Rollout:**
- Announce in release notes
- Blog post: "Why We Upgraded Our Embeddings"
- Provide rollback instructions
- Monitor GitHub issues for complaints

**Risk Mitigation:**
- Keep old model as fallback option
- Add `--fast` flag for old model
- Document hardware requirements
- Offer escape hatch for older systems

---

#### 1.2 Add Batch Embedding API

**Current:** One node embedded at a time
**Target:** Batch processing for bulk operations

**Tasks:**
- [ ] Create `computeEmbeddingsForNodes(nodes[])` function
- [ ] Amortize model loading across batch
- [ ] Show progress bar for multi-node operations
- [ ] Update import-md.ts to use batch API
- [ ] Optimize for `admin:recompute-embeddings`

**Implementation:**
```typescript
// src/lib/embeddings.ts
export async function computeEmbeddingsForNodes(
  nodes: Array<Pick<NodeRecord, 'title' | 'body'>>
): Promise<Array<number[] | undefined>> {
  const provider = getEmbeddingProvider();

  if (provider === 'local') {
    // Load model once, embed all nodes
    const extractor = await getLocalExtractor();
    return Promise.all(nodes.map(n =>
      embedLocalWithExtractor(extractor, `${n.title}\n${n.body}`)
    ));
  }

  // API providers: batch request if supported
  return Promise.all(nodes.map(n => embedNoteText(`${n.title}\n${n.body}`)));
}
```

**Expected Impact:**
- ✅ 10x faster bulk imports (import 100 docs in 30s not 5min)
- ✅ Better UX (progress feedback)
- ✅ Lower memory churn

---

#### 1.3 Model Metadata Tracking

**Current:** No record of which model generated embeddings
**Target:** Track model version per node

**Tasks:**
- [ ] Add `embedding_model` column to nodes table
- [ ] Store model name when computing embeddings
- [ ] Add `forest stats --embeddings` to show model distribution
- [ ] Warn on model mismatch during search
- [ ] Support mixed models in same DB

**Schema Change:**
```sql
ALTER TABLE nodes ADD COLUMN embedding_model TEXT;
CREATE INDEX idx_nodes_embedding_model ON nodes(embedding_model);

-- Migration for existing nodes
UPDATE nodes SET embedding_model = 'Xenova/all-MiniLM-L6-v2'
WHERE embedding IS NOT NULL AND embedding_model IS NULL;
```

**Expected Impact:**
- ✅ Users can see which model is used
- ✅ Enables gradual model migration
- ✅ Future-proofs for multi-model support

---

### Phase 2: Premium Options (v0.5 - Q2 2026)

**Goal:** Let power users pay for maximum quality

#### 2.1 Add Voyage AI Provider

**Why Voyage:**
- Best accuracy in 2025 benchmarks
- Optimized for retrieval (Forest's core use case)
- Reasonable pricing ($0.02-0.10 per 1M tokens)
- Fast API, good docs

**Tasks:**
- [ ] Implement Voyage provider in `src/lib/embeddings.ts`
- [ ] Support both voyage-3-lite and voyage-3-large
- [ ] Add API key management (`forest config set voyage-key`)
- [ ] Show cost estimate during bulk operations
- [ ] Document Voyage setup in README

**Implementation:**
```typescript
// src/lib/embeddings.ts
async function embedVoyage(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY required');

  const model = process.env.FOREST_EMBED_MODEL || 'voyage-3-lite';
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  // Handle response
}
```

**Cost Estimator:**
```bash
$ forest embedding cost --provider voyage-lite
Analyzing database...
- 523 nodes without embeddings
- Average size: 847 tokens
- Estimated cost: $0.009

$ forest embedding cost --provider voyage-large
Estimated cost: $0.044
```

**Expected Impact:**
- ✅ 30-40% better quality for paying users
- ✅ Fast inference (no model loading)
- ✅ Establishes premium tier

---

#### 2.2 Add Google Gemini Provider (Free Tier)

**Why Gemini:**
- Completely FREE up to generous limits
- Good quality (71.5% accuracy)
- Lowers barrier to high-quality embeddings
- Google infrastructure

**Tasks:**
- [ ] Implement Gemini provider
- [ ] Handle rate limits gracefully
- [ ] Document free tier limits
- [ ] Add fallback to local on quota exhaustion

**Expected Impact:**
- ✅ Attracts cost-sensitive users
- ✅ Democratizes good embeddings
- ✅ Marketing opportunity ("premium quality, free tier")

---

#### 2.3 Model Comparison Tool

**Goal:** Let users test models on their data

**Tasks:**
- [ ] Create `forest embedding compare` command
- [ ] Compare precision/recall on test edges
- [ ] Show false positive rates
- [ ] Generate recommendation report

**Example:**
```bash
$ forest embedding compare --models stella,voyage-lite,gemini

Testing embeddings on 523 nodes with 127 known edges...

Model              Precision@10  Recall  False+  Speed    Cost
stella-base        82.3%         67.8%   12.4%   210ms    $0
voyage-3-lite      87.9%         74.2%   8.1%    45ms     $0.01
gemini-embed-004   85.1%         71.3%   9.7%    58ms     FREE

Recommendation: voyage-3-lite offers best quality for <$0.01/month
Use FOREST_EMBED_PROVIDER=voyage to enable.
```

**Expected Impact:**
- ✅ Data-driven model selection
- ✅ Users understand quality differences
- ✅ Increases confidence in premium tiers

---

### Phase 3: Advanced Features (v0.6+ - Q3 2026)

**Goal:** Scale and sophisticated use cases

#### 3.1 Collection System

**Concept:** Group nodes by domain/project

**Use Cases:**
- Separate work notes from personal notes
- Different models for different domains (code vs prose)
- Domain-specific tuning
- Cross-collection search

**Schema:**
```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE nodes ADD COLUMN collection_id TEXT REFERENCES collections(id);
CREATE INDEX idx_nodes_collection ON nodes(collection_id);
```

**Commands:**
```bash
# Create collection
forest collection create work --model voyage-large

# Add to collection
forest capture --collection work --stdin < note.md

# Search within collection
forest search "meeting notes" --collection work

# Compare across collections
forest search "agile" --all-collections
```

**Expected Impact:**
- ✅ Better organization for large knowledge bases
- ✅ Domain-specific quality tuning
- ✅ Clear mental model for users

---

#### 3.2 Dimension Optimization

**Goal:** Find optimal dimension count for personal KB

**Research Questions:**
- Is 768-dim overkill for personal notes?
- Would 256 or 512 suffice with less storage?
- Can we quantize to int8 without quality loss?

**Tasks:**
- [ ] Test models at 256, 384, 512, 768, 1024 dims
- [ ] Measure storage vs quality tradeoff
- [ ] Implement dimension projection if needed
- [ ] Add quantization for storage savings

**Potential Savings:**
- 768-dim float32 = 3KB per node
- 384-dim float32 = 1.5KB per node
- 768-dim int8 = 768 bytes per node

**For 10,000 nodes:**
- Current: 15MB
- Optimized: 7.5MB (int8 quantization)

**Expected Impact:**
- ✅ Lower storage requirements
- ✅ Faster similarity search
- ⚠️ Slight quality degradation (test carefully)

---

#### 3.3 Model Migration System

**Goal:** Seamless model upgrades

**Current Problem:**
- Switching models requires re-embedding all nodes
- Users lose work if interrupted
- No rollback mechanism

**Solution:**
```bash
# Start migration
forest embedding migrate --to stella-base

Progress: [████░░░░░░] 234/523 nodes (45%)
Estimated time: 3 minutes
Press Ctrl+C to pause (safe to resume later)

# Resume interrupted migration
forest embedding migrate --resume

# Rollback if unsatisfied
forest embedding migrate --rollback
```

**Implementation:**
- Store old and new embeddings temporarily
- Atomic swap on completion
- Keep old embeddings for rollback (7 days)
- Background job for large migrations

**Expected Impact:**
- ✅ Risk-free model upgrades
- ✅ Users can test without commitment
- ✅ Enables experimentation

---

#### 3.4 Quality Feedback Loop

**Goal:** Learn which embeddings work best

**Concept:**
- Track edge accept/reject rates
- Correlate with embedding similarity scores
- Tune scoring weights automatically
- A/B test new models on subset of users

**Metrics to Track:**
```typescript
interface EmbeddingQuality {
  model: string;
  acceptRate: number;      // % of suggestions accepted
  rejectRate: number;      // % explicitly rejected
  manualLinkRate: number;  // % of edges user created manually
  avgSimilarity: number;   // For accepted edges
}
```

**Auto-tuning:**
```typescript
// Adjust hybrid scoring weights based on quality
if (embedding_accept_rate > 0.8) {
  // Embeddings working great, increase weight
  EMBEDDING_WEIGHT = 0.60;  // up from 0.55
  TOKEN_WEIGHT = 0.20;      // down from 0.25
}
```

**Expected Impact:**
- ✅ System improves over time
- ✅ Personalized to each user's KB
- ✅ Data-driven feature development

---

## Migration Strategy

### Existing Users (Pre-Upgrade)

**Challenge:** 523 nodes with old embeddings

**Options:**

1. **Lazy Migration (Recommended)**
   - Keep old embeddings until edited
   - Re-embed on node edit with new model
   - Gradual, no disruption
   - Takes weeks/months to fully migrate

2. **Background Migration**
   - Auto-migrate during idle time
   - Show notification when complete
   - User can opt out
   - ~10 minutes for 500 nodes

3. **Opt-In Migration**
   - User runs `forest embedding migrate`
   - One-time operation
   - Fast, user-controlled
   - Can be scheduled

**Recommendation:** Lazy migration by default, with opt-in for power users

---

### Version Compatibility

| Forest Version | Default Model | Embedding Dimension | Compatible With |
|----------------|---------------|---------------------|-----------------|
| ≤ 0.3 | all-MiniLM-L6-v2 | 384 | All versions |
| 0.4 | stella-base | 768 | 0.4+ |
| 0.5+ | stella-base | 768 | 0.4+ |

**Cross-Version:**
- 0.4 can read 0.3 databases (dimension mismatch handled)
- 0.3 cannot use 0.4 embeddings (dimensions too large)
- Downgrade requires re-embedding

---

## Success Metrics

### Phase 1 (Quality Foundation)

- ✅ Precision@10 improvement: +20% (target: 80% → 96%)
- ✅ False positive rate: -15% (target: 12% → 10%)
- ✅ User satisfaction: 4.2/5 → 4.5/5
- ✅ Edge acceptance rate: 60% → 72%
- ⚠️ Embedding speed: <500ms per note (acceptable)

### Phase 2 (Premium Options)

- ✅ 10% of users try premium provider
- ✅ 3% of users pay for Voyage
- ✅ Gemini free tier adoption: 15%
- ✅ Monthly API costs: <$0.50 per user avg
- ✅ Model comparison tool usage: 25% of power users

### Phase 3 (Advanced Features)

- ✅ Collection adoption: 20% of users
- ✅ Model migration success rate: >95%
- ✅ Quality feedback loop: 10% quality improvement/year
- ✅ Storage optimization: -40% embedding storage
- ✅ Zero complaints about model upgrades

---

## Open Questions & Research Needed

### 1. Model Size Tolerance

**Question:** How large a model will users download?
- 400MB (Stella): Acceptable?
- 550MB (Nomic): Too big?
- 1GB+: Definitely too big

**Research:**
- Survey users on download size tolerance
- Test on metered connections
- Consider CDN for faster downloads

### 2. Multi-Model Performance

**Question:** Is maintaining multiple models worth complexity?
- Better accuracy from ensemble?
- Memory/performance impact?
- User confusion?

**Research:**
- Benchmark single vs ensemble on test corpus
- Measure memory overhead
- User testing on collection UI

### 3. Domain-Specific Models

**Question:** Should we support specialized models?
- Code embeddings for programming notes?
- Scientific paper embeddings for research?
- Legal document embeddings for professionals?

**Research:**
- Identify common domains in user bases
- Test domain-specific models
- Assess demand via survey

### 4. Compression Techniques

**Question:** Can we compress embeddings without quality loss?
- Quantization (float32 → int8)?
- Dimension reduction (768 → 384)?
- Sparse embeddings?

**Research:**
- Benchmark quality impact
- Measure storage/speed gains
- Test with various corpus sizes

### 5. Hybrid Model Strategy

**Question:** Should we combine local + API?
- Local for privacy-sensitive notes?
- API for quality-critical notes?
- User chooses per-note?

**Research:**
- Prototype hybrid system
- User testing on privacy vs quality tradeoff
- Measure complexity cost

---

## Resource Requirements

### Development Time

| Phase | Engineer-Weeks | Priority |
|-------|----------------|----------|
| Phase 1.1 (Model upgrade) | 2 weeks | HIGH |
| Phase 1.2 (Batch API) | 1 week | HIGH |
| Phase 1.3 (Metadata) | 1 week | MEDIUM |
| Phase 2.1 (Voyage) | 1 week | MEDIUM |
| Phase 2.2 (Gemini) | 1 week | MEDIUM |
| Phase 2.3 (Compare tool) | 2 weeks | LOW |
| Phase 3 (All) | 8 weeks | FUTURE |

**Total Phase 1-2:** ~8 engineer-weeks (~2 months)

### Infrastructure

- CI/CD for model downloads (cache models)
- Test corpus creation (100 representative notes)
- Benchmark suite (automated quality testing)
- Documentation updates
- Migration guides

### Community

- Beta testing program (10-20 users)
- Feedback surveys
- Model quality reports
- Blog posts on improvements

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users reject larger models | Medium | High | Offer lite version, document tradeoffs |
| API costs higher than expected | Low | Medium | Cost caps, usage monitoring |
| Model quality doesn't improve | Low | High | Benchmark before rollout, rollback plan |
| Migration bugs lose data | Low | Critical | Extensive testing, backup prompts |
| Performance degrades | Medium | High | Benchmark on low-end hardware |
| User confusion from choices | Medium | Medium | Smart defaults, clear documentation |

---

## Next Actions (Immediate)

1. **[1 week] Benchmark Phase**
   - Set up test corpus (100 notes)
   - Test Stella, Nomic, Voyage on real data
   - Measure precision/recall/speed
   - Make data-driven model choice

2. **[1 week] Implementation**
   - Update default model in code
   - Add download progress indicator
   - Write migration guide
   - Update documentation

3. **[2 weeks] Beta Testing**
   - Recruit 10-20 power users
   - Survey on quality improvements
   - Monitor GitHub issues
   - Iterate based on feedback

4. **[1 week] Release**
   - Announce in v0.4 release notes
   - Blog post: "Better Embeddings"
   - Update website/docs
   - Monitor adoption metrics

**Target:** Ship Phase 1 in v0.4 (March 2026)

---

## Conclusion

This roadmap balances **immediate quality wins** (Phase 1) with **long-term sophistication** (Phase 2-3), while maintaining Forest's core values of privacy, simplicity, and user control.

**Key Takeaways:**
- Phase 1 delivers 20-25% quality improvement with minimal disruption
- Phase 2 unlocks premium quality for power users
- Phase 3 scales to advanced use cases
- Gradual rollout minimizes risk
- User choice always preserved

**The goal:** By end of 2026, Forest should have best-in-class embeddings for personal knowledge management, rivaling or exceeding commercial tools.
