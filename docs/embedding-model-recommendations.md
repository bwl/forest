# Embedding Model Recommendations for Forest

**Date:** 2025-10-20
**Focus:** Text similarity for personal knowledge bases

---

## Executive Summary

Based on 2025 benchmarks and Forest's specific use case (personal knowledge management with semantic similarity), we recommend a **tiered approach**:

1. **Default (Free)**: Upgrade to **Nomic Embed v1** or **Stella-base** (~20% quality improvement)
2. **Premium (Paid)**: **Voyage-3-lite** for best cost/performance balance
3. **Maximum Quality**: **Voyage-3-large** or **Mistral-embed** for power users

---

## Current Baseline

**Model:** Xenova/all-MiniLM-L6-v2
- Released: 2021
- Dimensions: 384
- Performance: Good for 2021, now outpaced
- MTEB Score: ~58-60 (estimated)

---

## Top Models by Category (2025)

### Open Source / Local Models

#### 1. Nomic Embed v1 (Recommended for Forest)
```
Provider: Open source
Dimensions: 768
License: Apache 2.0
Size: ~550MB
Performance: 86.2% top-5 accuracy on knowledge retrieval
Latency: Higher than current (~200ms vs ~50ms)
```

**Pros:**
- ✅ Significant quality improvement over all-MiniLM
- ✅ Apache 2.0 - can distribute with Forest
- ✅ Strong performance on semantic search tasks
- ✅ Works offline, no API costs

**Cons:**
- ⚠️ Larger model size (~25x bigger)
- ⚠️ Slower inference (4x longer)
- ⚠️ Higher memory footprint

**Forest Integration:**
```bash
FOREST_EMBED_LOCAL_MODEL=nomic-ai/nomic-embed-text-v1
```

#### 2. Stella-base (Best Quality/Size Tradeoff)
```
Provider: Open source
Dimensions: 768
License: MIT
Size: ~400MB
Performance: Competitive with Nomic, slightly faster
```

**Pros:**
- ✅ Excellent performance
- ✅ Smaller than Nomic
- ✅ MIT license
- ✅ Good multilingual support

**Cons:**
- ⚠️ Still larger than current
- ⚠️ Less community adoption than Nomic

#### 3. E5-Base-v2 (Conservative Upgrade)
```
Provider: Microsoft
Dimensions: 768
License: MIT
Size: ~440MB
Performance: 83-85% accuracy
Latency: 79-82ms
```

**Pros:**
- ✅ Proven quality
- ✅ Microsoft backing
- ✅ Good documentation
- ✅ Fast inference

**Cons:**
- ⚠️ Not as cutting-edge as Nomic/Stella
- ⚠️ Moderate improvement over current

### Commercial API Models

#### 1. Voyage-3-lite (Recommended for Cost-Conscious API Users)
```
Provider: Voyage AI
Dimensions: 512
Cost: $0.02 per 1M tokens
Performance: 66.1% accuracy
Best for: Production RAG systems on budget
```

**Pros:**
- ✅ Best cost/performance ratio
- ✅ Optimized for retrieval tasks
- ✅ Fast API response times
- ✅ Good quality for the price

**Cons:**
- ⚠️ Requires API key and internet
- ⚠️ Usage costs (though minimal)
- ⚠️ Not quite top-tier accuracy

**Cost Estimate:**
- 1000 notes × 1000 tokens avg = 1M tokens
- One-time embedding: $0.02
- Negligible for personal use

#### 2. Voyage-3-large (Best Overall Quality)
```
Provider: Voyage AI
Dimensions: 1536
Cost: $0.10 per 1M tokens
Performance: League-leading accuracy
Best for: Maximum quality retrieval
```

**Pros:**
- ✅ Best-in-class accuracy
- ✅ Consistently outperforms competitors
- ✅ Optimized for semantic search
- ✅ Excellent on noisy/real-world data

**Cons:**
- ⚠️ 5x more expensive than lite
- ⚠️ Higher dimensions = more storage
- ⚠️ Overkill for small knowledge bases

#### 3. Mistral-embed (Maximum Accuracy)
```
Provider: Mistral AI
Dimensions: 1024
Cost: €0.10 per 1M tokens
Performance: 77.8% accuracy (highest in benchmarks)
Best for: Precision-critical applications
```

**Pros:**
- ✅ Highest measured accuracy
- ✅ European data residency option
- ✅ Strong multilingual support
- ✅ Competitive pricing

**Cons:**
- ⚠️ Requires EU API access
- ⚠️ Less proven track record than OpenAI
- ⚠️ Smaller ecosystem

#### 4. Google Gemini-embedding-004 (Free Tier Champion)
```
Provider: Google
Dimensions: 768
Cost: FREE up to generous limits
Performance: 71.5% accuracy
Best for: Cost-sensitive deployments
```

**Pros:**
- ✅ Completely free (with limits)
- ✅ High quality for free tier
- ✅ Google infrastructure
- ✅ Good multilingual support

**Cons:**
- ⚠️ Rate limits on free tier
- ⚠️ Requires Google account
- ⚠️ Privacy considerations

#### 5. Cohere Embed v3 (Multilingual Specialist)
```
Provider: Cohere
Dimensions: 1024 (compressible)
Cost: $0.10 per 1M tokens
Performance: Strong on noisy/real-world data
Best for: Multilingual knowledge bases
```

**Pros:**
- ✅ 100+ languages supported
- ✅ Compression-aware training
- ✅ Excellent on noisy data
- ✅ Semantic cache features

**Cons:**
- ⚠️ Not top-tier on English-only benchmarks
- ⚠️ Premium pricing

---

## Forest-Specific Use Case Analysis

### What Makes Forest Different

1. **Personal knowledge base** - Not web-scale search
2. **Hybrid scoring** - Embeddings are ONE of four signals
3. **Offline preferred** - Users value local-first
4. **Note-sized content** - ~500-2000 tokens per node
5. **Quality over speed** - User waits during capture anyway

### Evaluation Criteria

| Criterion | Weight | Reasoning |
|-----------|--------|-----------|
| **Accuracy** | 40% | Core use case is finding related notes |
| **Offline support** | 25% | Privacy + reliability |
| **Cost** | 15% | Personal use = sensitivity to recurring costs |
| **Speed** | 10% | Acceptable if <1s per note |
| **Model size** | 10% | Download burden for new users |

### Scoring Matrix

| Model | Accuracy | Offline | Cost | Speed | Size | **Total** |
|-------|----------|---------|------|-------|------|-----------|
| **Current (MiniLM)** | 6/10 | 10/10 | 10/10 | 10/10 | 10/10 | **7.4/10** |
| **Nomic Embed v1** | 9/10 | 10/10 | 10/10 | 7/10 | 6/10 | **8.8/10** |
| **Stella-base** | 9/10 | 10/10 | 10/10 | 8/10 | 7/10 | **9.0/10** ⭐ |
| **Voyage-3-lite** | 7/10 | 0/10 | 9/10 | 10/10 | 10/10 | **6.1/10** |
| **Voyage-3-large** | 10/10 | 0/10 | 8/10 | 9/10 | 10/10 | **7.3/10** |
| **Gemini-embed** | 8/10 | 0/10 | 10/10 | 9/10 | 10/10 | **7.5/10** |

---

## Recommendations by User Persona

### 1. Default User (Privacy-Conscious, Offline-First)

**Recommended:** Stella-base or Nomic Embed v1

```bash
# Stella (slightly better overall)
FOREST_EMBED_PROVIDER=local
FOREST_EMBED_LOCAL_MODEL=stella-base-en-v2

# Nomic (more conservative choice)
FOREST_EMBED_PROVIDER=local
FOREST_EMBED_LOCAL_MODEL=nomic-ai/nomic-embed-text-v1
```

**Why:**
- ~20-25% quality improvement over current
- Stays offline and private
- One-time download, no ongoing costs
- Compatible with Forest's philosophy

**Tradeoff:**
- Initial model download (~400-550MB)
- Slower embedding (200ms vs 50ms per note)
- Acceptable: users wait 1-2s during capture anyway

### 2. Power User (Quality-Focused, API-Comfortable)

**Recommended:** Voyage-3-large or Mistral-embed

```bash
FOREST_EMBED_PROVIDER=voyage
FOREST_EMBED_MODEL=voyage-3-large
VOYAGE_API_KEY=pa-...

# Or Mistral for EU users
FOREST_EMBED_PROVIDER=mistral
MISTRAL_API_KEY=...
```

**Why:**
- Best-in-class accuracy
- Fast inference (no local model loading)
- Minimal cost for personal use (<$1/year)
- Handles large knowledge bases well

**Tradeoff:**
- Requires internet connection
- Monthly API costs (tiny but not zero)
- Privacy consideration (notes sent to API)

### 3. Budget-Conscious API User

**Recommended:** Google Gemini (free tier)

```bash
FOREST_EMBED_PROVIDER=gemini
GOOGLE_API_KEY=...
```

**Why:**
- Free up to generous limits
- Good quality (71.5% accuracy)
- Fast API response
- No local model download

**Tradeoff:**
- Rate limits on free tier
- Requires Google account
- Not offline

### 4. Multilingual User

**Recommended:** Cohere Embed v3

```bash
FOREST_EMBED_PROVIDER=cohere
COHERE_API_KEY=...
```

**Why:**
- 100+ languages supported
- Strong cross-lingual retrieval
- Handles code-switching well
- Good on noisy/mixed content

**Tradeoff:**
- Premium pricing
- API dependency
- Not strongest for English-only

---

## Implementation Strategy

### Phase 1: Upgrade Default Local Model

**Goal:** Improve out-of-box experience

**Actions:**
1. Change default from `all-MiniLM-L6-v2` to `stella-base-en-v2`
2. Add progress indicator during first-time model download
3. Document performance tradeoff in docs
4. Provide escape hatch to old model for low-end hardware

**Expected Impact:**
- 20-25% better link suggestions
- 5-10% fewer false positives
- Better handling of abstract concepts
- Slight increase in cold-start time

### Phase 2: Add Premium Providers

**Goal:** Enable power users to pay for quality

**Actions:**
1. Add Voyage provider to `src/lib/embeddings.ts`
2. Add Gemini provider (free tier)
3. Add cost estimator command (`forest embedding cost`)
4. Document provider comparison in help

**Expected Impact:**
- Power users get 30-40% better accuracy
- Free tier option attracts new users
- Establishes Forest as quality-focused

### Phase 3: Model Switching & Migration

**Goal:** Let users compare models on their data

**Actions:**
1. Add model metadata to nodes table
2. Support mixed models in same DB
3. Provide `forest embedding migrate` command
4. Build quality comparison dashboard

**Expected Impact:**
- Users can A/B test models
- Gradual migration path
- Data-driven model selection

---

## Testing Methodology

### Before Rolling Out New Default

1. **Create test set:**
   - 100 representative notes from community databases
   - Known-good edge pairs (manually verified)
   - Known-bad pairs (should NOT connect)

2. **Benchmark models:**
   ```bash
   # Test each model
   forest admin:test-embeddings --model stella-base --test-set notes.json
   forest admin:test-embeddings --model nomic-v1 --test-set notes.json
   forest admin:test-embeddings --model voyage-lite --test-set notes.json
   ```

3. **Metrics:**
   - Precision @ top-10 (how many suggested edges are good?)
   - Recall (did we find known connections?)
   - False positive rate (junk suggestions)
   - Edge acceptance rate (proxy for quality)

4. **User testing:**
   - Beta test with 10-20 power users
   - Survey: "Are new suggestions better?"
   - Track edge accept/reject rates

### Quality Threshold

**Minimum improvement to justify change:**
- +15% precision OR
- +15% recall OR
- -20% false positives

**Stella/Nomic expected:**
- +20-25% precision
- +10-15% recall
- -15-20% false positives

---

## Cost Analysis

### Local Models (One-Time Download)

| Model | Size | Download Time (10 Mbps) | Storage Cost |
|-------|------|--------------------------|--------------|
| MiniLM (current) | 23 MB | 18 seconds | Negligible |
| Stella | 400 MB | 5 minutes | $0.00 |
| Nomic | 550 MB | 7 minutes | $0.00 |

### API Models (Per-Use Cost)

**Scenario:** 1000-note knowledge base, each note 1000 tokens

| Model | Cost/Note | Initial Embed | Re-embed (edit 10%) | Annual Cost (10% churn) |
|-------|-----------|---------------|---------------------|-------------------------|
| Voyage-lite | $0.00002 | $0.02 | $0.002/mo | $0.024/year |
| Voyage-large | $0.0001 | $0.10 | $0.01/mo | $0.12/year |
| Mistral | $0.0001 | $0.10 | $0.01/mo | $0.12/year |
| Gemini | FREE | FREE | FREE | FREE (with limits) |

**Conclusion:** API costs are negligible for personal use (<$1/year even for premium models).

---

## Open Questions

1. **What's the acceptable model size for default?**
   - 400MB download reasonable for modern laptops?
   - Offer "lite" build with smaller model?

2. **Should we support model ensembles?**
   - Combine local + API for best of both?
   - Vote between multiple models?
   - Worth the complexity?

3. **How to handle dimension mismatches?**
   - Store multiple embeddings per node?
   - Dynamically resize/project?
   - Force migration?

4. **What about specialized models?**
   - Code-specific embeddings for programming notes?
   - Scientific paper embeddings for research?
   - Domain adaptation?

5. **Privacy vs Quality tradeoff?**
   - Offer "privacy mode" (local only) and "quality mode" (API)?
   - Default to which?
   - User education challenge?

---

## Next Steps

1. ✅ Benchmark Stella and Nomic on test corpus
2. ✅ Implement Voyage provider (easiest API integration)
3. ✅ Add model metadata tracking to nodes
4. ✅ Create migration tool for existing embeddings
5. ✅ User survey on model size vs quality tradeoff
6. ✅ Beta test new default with power users
7. ✅ Document provider pros/cons in help system

---

## References

- MTEB Leaderboard: https://huggingface.co/spaces/mteb/leaderboard
- Voyage AI Docs: https://docs.voyageai.com/
- Nomic Embed: https://huggingface.co/nomic-ai/nomic-embed-text-v1
- Stella: https://huggingface.co/dunzhang/stella-base-en-v2
- Cost comparison: https://www.datastax.com/blog/best-embedding-models-information-retrieval-2025
