//! Scoring algorithm - hybrid edge weight computation
//!
//! This module implements Forest's core intelligence: computing similarity scores
//! between node pairs using a hybrid of lexical and semantic signals.
//!
//! The algorithm MUST produce identical results to the TypeScript implementation.

use crate::db::types::{EdgeStatus, NodeRecord};
use crate::core::text::tokens_from_title;
use std::collections::{HashMap, HashSet};
use lazy_static::lazy_static;

lazy_static! {
    /// Token downweight map - generic technical terms weighted at 0.4
    static ref TOKEN_DOWNWEIGHT: HashMap<&'static str, f64> = {
        let mut m = HashMap::new();
        m.insert("flow", 0.4);
        m.insert("flows", 0.4);
        m.insert("stream", 0.4);
        m.insert("streams", 0.4);
        m.insert("pipe", 0.4);
        m.insert("pipes", 0.4);
        m.insert("branch", 0.4);
        m.insert("branches", 0.4);
        m.insert("terminal", 0.4);
        m.insert("terminals", 0.4);
        m
    };
}

/// Score computation result with components breakdown
#[derive(Debug, Clone)]
pub struct ScoreResult {
    pub score: f64,
    pub components: ScoreComponents,
}

/// Individual scoring components for transparency
#[derive(Debug, Clone)]
pub struct ScoreComponents {
    pub tag_overlap: f64,
    pub token_similarity: f64,
    pub title_similarity: f64,
    pub embedding_similarity: f64,
    pub penalty: f64,
}

/// Classification result - includes 'discard' marker for sub-threshold scores
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScoreClassification {
    Accepted,
    Suggested,
    Discard,
}

/// Get auto-accept threshold from environment or use default (0.5)
pub fn get_auto_accept_threshold() -> f64 {
    std::env::var("FOREST_AUTO_ACCEPT")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.5)
}

/// Get suggestion threshold from environment or use default (0.25)
pub fn get_suggestion_threshold() -> f64 {
    std::env::var("FOREST_SUGGESTION_THRESHOLD")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.25)
}

/// Compute hybrid similarity score between two nodes
///
/// This is the CORE of Forest's intelligence. The weights and formula
/// MUST match TypeScript exactly (src/lib/scoring.ts lines 25-42).
///
/// # Algorithm
/// 1. Compute 4 similarity metrics:
///    - Tag overlap (Jaccard)
///    - Token similarity (weighted cosine)
///    - Title similarity (token overlap cosine)
///    - Embedding similarity (cosine with pow(1.25) nonlinearity)
/// 2. Weighted sum: 0.25*token + 0.55*embedding + 0.15*tag + 0.05*title
/// 3. Apply 0.9× penalty if both tag_overlap and title_similarity are zero
///
/// # Returns
/// ScoreResult with final score and component breakdown
pub fn compute_score(a: &NodeRecord, b: &NodeRecord) -> ScoreResult {
    let tag_overlap = jaccard(&a.tags, &b.tags);
    let token_similarity = cosine_similarity(&a.token_counts, &b.token_counts);
    let title_similarity = title_cosine(&a.title, &b.title);
    let embedding_similarity_raw = cosine_embeddings(
        a.embedding.as_deref(),
        b.embedding.as_deref(),
    );

    // Mild nonlinearity to reduce mid-range crowding; preserve high similarities
    let embedding_similarity = embedding_similarity_raw.max(0.0).powf(1.25);

    // Hybrid score: increase embedding influence to reduce lexical tie clusters
    let mut score =
        0.25 * token_similarity +
        0.55 * embedding_similarity +
        0.15 * tag_overlap +
        0.05 * title_similarity;

    // Penalize pairs with zero lexical/title overlap to avoid purely semantic weak links
    let penalty = if tag_overlap == 0.0 && title_similarity == 0.0 {
        0.9
    } else {
        1.0
    };
    score *= penalty;

    ScoreResult {
        score,
        components: ScoreComponents {
            tag_overlap,
            token_similarity,
            title_similarity,
            embedding_similarity,
            penalty,
        },
    }
}

/// Classify score into accepted/suggested/discard
///
/// Uses environment-configurable thresholds.
pub fn classify_score(score: f64) -> ScoreClassification {
    if score >= get_auto_accept_threshold() {
        ScoreClassification::Accepted
    } else if score >= get_suggestion_threshold() {
        ScoreClassification::Suggested
    } else {
        ScoreClassification::Discard
    }
}

/// Convert ScoreClassification to EdgeStatus (for database storage)
///
/// Note: Discard is never stored, so this returns None for discard.
pub fn classification_to_status(classification: ScoreClassification) -> Option<EdgeStatus> {
    match classification {
        ScoreClassification::Accepted => Some(EdgeStatus::Accepted),
        ScoreClassification::Suggested => Some(EdgeStatus::Suggested),
        ScoreClassification::Discard => None,
    }
}

/// Normalize edge pair to ensure sourceId < targetId (edges are undirected)
///
/// This ensures consistent edge IDs regardless of insertion order.
pub fn normalize_edge_pair(a: &str, b: &str) -> (String, String) {
    if a < b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

/// Jaccard similarity: |A ∩ B| / |A ∪ B|
///
/// Handles empty sets by returning 0.
/// Matches TypeScript jaccard() behavior exactly.
fn jaccard(a: &[String], b: &[String]) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }

    let set_a: HashSet<&String> = a.iter().collect();
    let set_b: HashSet<&String> = b.iter().collect();

    let mut intersection = 0;
    let mut union = set_a.len();

    for token in &set_b {
        if set_a.contains(token) {
            intersection += 1;
        } else {
            union += 1;
        }
    }

    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

/// Cosine similarity with token downweighting for generic terms
///
/// This is the lexical similarity metric that applies 0.4× weights to
/// generic technical terms like 'flow', 'stream', 'pipe', etc.
///
/// Matches TypeScript cosineSimilarity() behavior exactly.
fn cosine_similarity(a: &HashMap<String, i64>, b: &HashMap<String, i64>) -> f64 {
    let mut keys = HashSet::new();
    keys.extend(a.keys());
    keys.extend(b.keys());

    if keys.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0;
    let mut mag_a = 0.0;
    let mut mag_b = 0.0;

    for key in keys {
        let weight = TOKEN_DOWNWEIGHT.get(key.as_str()).copied().unwrap_or(1.0);
        let val_a = a.get(key).copied().unwrap_or(0) as f64 * weight;
        let val_b = b.get(key).copied().unwrap_or(0) as f64 * weight;

        dot += val_a * val_b;
        mag_a += val_a * val_a;
        mag_b += val_b * val_b;
    }

    if mag_a == 0.0 || mag_b == 0.0 {
        0.0
    } else {
        dot / (mag_a.sqrt() * mag_b.sqrt())
    }
}

/// Title cosine similarity using token overlap
///
/// Simplified cosine: overlap / sqrt(|A| * |B|)
/// Matches TypeScript titleCosine() behavior exactly.
fn title_cosine(a: &str, b: &str) -> f64 {
    let tokens_a = tokens_from_title(a);
    let tokens_b = tokens_from_title(b);

    if tokens_a.is_empty() || tokens_b.is_empty() {
        return 0.0;
    }

    let set_b: HashSet<&String> = tokens_b.iter().collect();
    let mut overlap = 0;

    for token in &tokens_a {
        if set_b.contains(token) {
            overlap += 1;
        }
    }

    let denom = ((tokens_a.len() * tokens_b.len()) as f64).sqrt();
    if denom == 0.0 {
        0.0
    } else {
        overlap as f64 / denom
    }
}

/// Cosine similarity for embedding vectors
///
/// Standard cosine similarity with graceful handling of:
/// - None embeddings (return 0)
/// - Empty vectors (return 0)
/// - Dimension mismatches (use minimum dimension)
/// - Zero magnitude (return 0)
///
/// Matches TypeScript cosineEmbeddings() behavior exactly.
pub fn cosine_embeddings(a: Option<&[f64]>, b: Option<&[f64]>) -> f64 {
    match (a, b) {
        (Some(vec_a), Some(vec_b)) if !vec_a.is_empty() && !vec_b.is_empty() => {
            let dim = vec_a.len().min(vec_b.len());

            let mut dot = 0.0;
            let mut mag_a = 0.0;
            let mut mag_b = 0.0;

            for i in 0..dim {
                let x = vec_a.get(i).copied().unwrap_or(0.0);
                let y = vec_b.get(i).copied().unwrap_or(0.0);
                dot += x * y;
                mag_a += x * x;
                mag_b += y * y;
            }

            if mag_a == 0.0 || mag_b == 0.0 {
                0.0
            } else {
                dot / (mag_a.sqrt() * mag_b.sqrt())
            }
        }
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jaccard_basic() {
        let a = vec!["rust".to_string(), "tauri".to_string()];
        let b = vec!["rust".to_string(), "desktop".to_string()];
        let score = jaccard(&a, &b);
        // Intersection: {rust} = 1
        // Union: {rust, tauri, desktop} = 3
        // Score: 1/3 = 0.333...
        assert!((score - 0.333).abs() < 0.01);
    }

    #[test]
    fn test_jaccard_empty() {
        let a: Vec<String> = vec![];
        let b: Vec<String> = vec![];
        assert_eq!(jaccard(&a, &b), 0.0);
    }

    #[test]
    fn test_jaccard_identical() {
        let a = vec!["rust".to_string(), "tauri".to_string()];
        let b = vec!["rust".to_string(), "tauri".to_string()];
        assert_eq!(jaccard(&a, &b), 1.0);
    }

    #[test]
    fn test_cosine_similarity_basic() {
        let mut a = HashMap::new();
        a.insert("rust".to_string(), 2);
        a.insert("tauri".to_string(), 1);

        let mut b = HashMap::new();
        b.insert("rust".to_string(), 1);
        b.insert("desktop".to_string(), 1);

        let score = cosine_similarity(&a, &b);
        // Should be > 0 due to 'rust' overlap
        assert!(score > 0.0);
        assert!(score <= 1.0);
    }

    #[test]
    fn test_cosine_similarity_downweight() {
        let mut a = HashMap::new();
        a.insert("flow".to_string(), 5); // Generic term, 0.4 weight

        let mut b = HashMap::new();
        b.insert("flow".to_string(), 5);

        let score = cosine_similarity(&a, &b);
        // Even though counts match, should be 1.0 (cosine of same vector)
        assert!((score - 1.0).abs() < 0.001);

        // Now test mixed generic and non-generic
        let mut c = HashMap::new();
        c.insert("flow".to_string(), 5);
        c.insert("algorithm".to_string(), 3);

        let mut d = HashMap::new();
        d.insert("flow".to_string(), 5);
        d.insert("algorithm".to_string(), 3);

        let score2 = cosine_similarity(&c, &d);
        assert!((score2 - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_title_cosine() {
        let a = "Building a Graph Database";
        let b = "Graph Database Design";
        let score = title_cosine(a, b);
        // Common tokens: 'graph', 'databas' (stemmed from database)
        assert!(score > 0.0);
        assert!(score <= 1.0);
    }

    #[test]
    fn test_title_cosine_identical() {
        let a = "Rust Programming";
        let b = "Rust Programming";
        let score = title_cosine(a, b);
        assert!((score - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_embeddings_basic() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let score = cosine_embeddings(Some(&a), Some(&b));
        assert!((score - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_embeddings_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let score = cosine_embeddings(Some(&a), Some(&b));
        assert!((score - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_embeddings_none() {
        let a = vec![1.0, 0.0, 0.0];
        assert_eq!(cosine_embeddings(Some(&a), None), 0.0);
        assert_eq!(cosine_embeddings(None, Some(&a)), 0.0);
        assert_eq!(cosine_embeddings(None, None), 0.0);
    }

    #[test]
    fn test_cosine_embeddings_dimension_mismatch() {
        let a = vec![1.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let score = cosine_embeddings(Some(&a), Some(&b));
        // Should use min dimension (2) and compute correctly
        assert!((score - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_classify_score() {
        // Test with default thresholds (0.5 auto-accept, 0.25 suggestion)
        assert_eq!(classify_score(0.6), ScoreClassification::Accepted);
        assert_eq!(classify_score(0.5), ScoreClassification::Accepted);
        assert_eq!(classify_score(0.4), ScoreClassification::Suggested);
        assert_eq!(classify_score(0.25), ScoreClassification::Suggested);
        assert_eq!(classify_score(0.2), ScoreClassification::Discard);
        assert_eq!(classify_score(0.0), ScoreClassification::Discard);
    }

    #[test]
    fn test_normalize_edge_pair() {
        let (s, t) = normalize_edge_pair("abc", "xyz");
        assert_eq!(s, "abc");
        assert_eq!(t, "xyz");

        let (s, t) = normalize_edge_pair("xyz", "abc");
        assert_eq!(s, "abc");
        assert_eq!(t, "xyz");

        let (s, t) = normalize_edge_pair("same", "same");
        assert_eq!(s, "same");
        assert_eq!(t, "same");
    }

    #[test]
    fn test_compute_score_penalty() {
        // Create minimal nodes for testing penalty
        // Use completely different titles to ensure no overlap
        let a = NodeRecord {
            id: "a".to_string(),
            title: "Alpha".to_string(),
            body: "test".to_string(),
            tags: vec![],
            token_counts: HashMap::new(),
            embedding: None,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
        };

        let b = NodeRecord {
            id: "b".to_string(),
            title: "Beta".to_string(),
            body: "test".to_string(),
            tags: vec![],
            token_counts: HashMap::new(),
            embedding: None,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
        };

        let result = compute_score(&a, &b);
        // With no tags and no title overlap, penalty should be 0.9
        assert_eq!(result.components.penalty, 0.9);
        assert_eq!(result.components.tag_overlap, 0.0);
        assert_eq!(result.components.title_similarity, 0.0);
    }

    #[test]
    fn test_compute_score_with_tags() {
        let mut a_tokens = HashMap::new();
        a_tokens.insert("rust".to_string(), 2);

        let a = NodeRecord {
            id: "a".to_string(),
            title: "Rust Programming".to_string(),
            body: "rust rust".to_string(),
            tags: vec!["rust".to_string()],
            token_counts: a_tokens,
            embedding: Some(vec![1.0, 0.0, 0.0]),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
        };

        let mut b_tokens = HashMap::new();
        b_tokens.insert("rust".to_string(), 2);

        let b = NodeRecord {
            id: "b".to_string(),
            title: "Rust Programming".to_string(),
            body: "rust rust".to_string(),
            tags: vec!["rust".to_string()],
            token_counts: b_tokens,
            embedding: Some(vec![1.0, 0.0, 0.0]),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
        };

        let result = compute_score(&a, &b);
        // Identical nodes should have very high score
        assert!(result.score > 0.9);
        assert_eq!(result.components.penalty, 1.0); // No penalty
        assert_eq!(result.components.tag_overlap, 1.0);
        assert_eq!(result.components.token_similarity, 1.0);
        assert!((result.components.title_similarity - 1.0).abs() < 0.001);
    }
}
