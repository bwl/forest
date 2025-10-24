//! Integration tests for scoring algorithm
//!
//! These tests verify that the Rust implementation produces identical results
//! to the TypeScript reference implementation.

use forest_desktop::core::{scoring::*, text::*};
use forest_desktop::db::types::NodeRecord;
use std::collections::HashMap;

/// Helper to create a test node
fn create_test_node(
    id: &str,
    title: &str,
    body: &str,
    tags: Vec<String>,
    embedding: Option<Vec<f64>>,
) -> NodeRecord {
    let token_counts = tokenize(&format!("{}\n{}", title, body));

    NodeRecord {
        id: id.to_string(),
        title: title.to_string(),
        body: body.to_string(),
        tags,
        token_counts,
        embedding,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    }
}

#[test]
fn test_identical_nodes_score_high() {
    let node = create_test_node(
        "abc123",
        "Rust Programming",
        "Learning Rust programming language with examples.",
        vec!["rust".to_string(), "programming".to_string()],
        Some(vec![0.5, 0.5, 0.5]),
    );

    let result = compute_score(&node, &node);

    // Identical nodes should have near-perfect score
    assert!(result.score > 0.99, "Expected score > 0.99, got {}", result.score);
    assert_eq!(result.components.penalty, 1.0);
    assert_eq!(result.components.tag_overlap, 1.0);
}

#[test]
fn test_completely_different_nodes_score_low() {
    let node_a = create_test_node(
        "abc123",
        "Rust Programming",
        "Learning Rust programming language.",
        vec!["rust".to_string()],
        Some(vec![1.0, 0.0, 0.0]),
    );

    let node_b = create_test_node(
        "def456",
        "Cooking Recipes",
        "Collection of Italian pasta recipes.",
        vec!["cooking".to_string()],
        Some(vec![0.0, 1.0, 0.0]),
    );

    let result = compute_score(&node_a, &node_b);

    // Completely different nodes should score very low
    assert!(result.score < 0.1, "Expected score < 0.1, got {}", result.score);
}

#[test]
fn test_semantic_similarity_only() {
    // Two nodes with similar embeddings but no lexical overlap
    let node_a = create_test_node(
        "abc123",
        "Alpha",
        "Content about alpha topics.",
        vec![],
        Some(vec![0.8, 0.6, 0.0]),
    );

    let node_b = create_test_node(
        "def456",
        "Beta",
        "Content about beta subjects.",
        vec![],
        Some(vec![0.8, 0.6, 0.1]), // Very similar embedding
    );

    let result = compute_score(&node_a, &node_b);

    // Penalty should apply (no tag/title overlap)
    assert_eq!(result.components.penalty, 0.9);
    assert_eq!(result.components.tag_overlap, 0.0);
    assert_eq!(result.components.title_similarity, 0.0);

    // But embedding similarity should be high
    assert!(result.components.embedding_similarity > 0.8);

    // Final score should be reduced by penalty
    let expected_score = (
        0.25 * result.components.token_similarity +
        0.55 * result.components.embedding_similarity +
        0.15 * result.components.tag_overlap +
        0.05 * result.components.title_similarity
    ) * 0.9;

    assert!((result.score - expected_score).abs() < 0.001);
}

#[test]
fn test_lexical_similarity_with_tags() {
    let node_a = create_test_node(
        "abc123",
        "Building Graph Databases",
        "Graph databases are useful for connected data. Building efficient graph structures.",
        vec!["database".to_string(), "graph".to_string()],
        None, // No embeddings
    );

    let node_b = create_test_node(
        "def456",
        "Graph Database Design",
        "Designing graph databases requires understanding data relationships.",
        vec!["database".to_string(), "graph".to_string()],
        None,
    );

    let result = compute_score(&node_a, &node_b);

    // Should have strong lexical signals
    assert!(result.components.tag_overlap > 0.8);
    assert!(result.components.title_similarity > 0.3);
    assert!(result.components.token_similarity > 0.1);
    assert_eq!(result.components.penalty, 1.0); // No penalty due to tag/title overlap

    // Without embeddings, score depends on lexical features
    println!("Lexical score components:");
    println!("  tag_overlap: {}", result.components.tag_overlap);
    println!("  token_similarity: {}", result.components.token_similarity);
    println!("  title_similarity: {}", result.components.title_similarity);
    println!("  final score: {}", result.score);
}

#[test]
fn test_token_downweighting() {
    // Test that generic terms are down-weighted
    let mut tokens_a = HashMap::new();
    tokens_a.insert("flow".to_string(), 10);
    tokens_a.insert("algorithm".to_string(), 5);

    let mut tokens_b = HashMap::new();
    tokens_b.insert("flow".to_string(), 10);
    tokens_b.insert("algorithm".to_string(), 5);

    let node_a = NodeRecord {
        id: "a".to_string(),
        title: "Flow Algorithm".to_string(),
        body: "test".to_string(),
        tags: vec![],
        token_counts: tokens_a,
        embedding: None,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node_b = NodeRecord {
        id: "b".to_string(),
        title: "Flow Algorithm".to_string(),
        body: "test".to_string(),
        tags: vec![],
        token_counts: tokens_b,
        embedding: None,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let result = compute_score(&node_a, &node_b);

    // Token similarity should be 1.0 (identical token counts)
    // Even though 'flow' is down-weighted, the ratio is the same
    assert_eq!(result.components.token_similarity, 1.0);
}

#[test]
fn test_score_classification() {
    // Test default thresholds (can be overridden by env vars)
    let auto_accept = get_auto_accept_threshold();
    let suggestion = get_suggestion_threshold();

    // Above auto-accept
    assert_eq!(
        classify_score(auto_accept + 0.1),
        ScoreClassification::Accepted
    );

    // At auto-accept boundary
    assert_eq!(
        classify_score(auto_accept),
        ScoreClassification::Accepted
    );

    // Between suggestion and auto-accept
    assert_eq!(
        classify_score((auto_accept + suggestion) / 2.0),
        ScoreClassification::Suggested
    );

    // At suggestion boundary
    assert_eq!(
        classify_score(suggestion),
        ScoreClassification::Suggested
    );

    // Below suggestion
    assert_eq!(
        classify_score(suggestion - 0.1),
        ScoreClassification::Discard
    );
}

#[test]
fn test_edge_pair_normalization() {
    let pairs = vec![
        (("abc", "xyz"), ("abc", "xyz")),
        (("xyz", "abc"), ("abc", "xyz")),
        (("same", "same"), ("same", "same")),
        (("111", "999"), ("111", "999")),
        (("zzz", "aaa"), ("aaa", "zzz")),
    ];

    for ((a, b), expected) in pairs {
        let (source, target) = normalize_edge_pair(a, b);
        assert_eq!((source.as_str(), target.as_str()), expected);
    }
}

#[test]
fn test_hybrid_scoring_weights() {
    // Create nodes with known component values to verify weight calculation
    let mut tokens_a = HashMap::new();
    tokens_a.insert("test".to_string(), 1);

    let node_a = NodeRecord {
        id: "a".to_string(),
        title: "Test".to_string(),
        body: "test".to_string(),
        tags: vec!["tag1".to_string()],
        token_counts: tokens_a.clone(),
        embedding: Some(vec![1.0, 0.0, 0.0]),
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node_b = NodeRecord {
        id: "b".to_string(),
        title: "Test".to_string(),
        body: "test".to_string(),
        tags: vec!["tag1".to_string()],
        token_counts: tokens_a,
        embedding: Some(vec![1.0, 0.0, 0.0]),
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let result = compute_score(&node_a, &node_b);

    // All components should be 1.0 or near 1.0
    assert!((result.components.tag_overlap - 1.0).abs() < 0.01);
    assert!((result.components.token_similarity - 1.0).abs() < 0.01);
    assert!((result.components.title_similarity - 1.0).abs() < 0.01);
    // Embedding similarity: pow(1.0, 1.25) = 1.0
    assert!((result.components.embedding_similarity - 1.0).abs() < 0.01);

    // Final score should be: 0.25*1 + 0.55*1 + 0.15*1 + 0.05*1 = 1.0
    let expected = 0.25 + 0.55 + 0.15 + 0.05;
    assert!((result.score - expected).abs() < 0.01);
}

#[test]
fn test_embedding_nonlinearity() {
    // Test that embedding similarity uses pow(1.25) nonlinearity
    let node_a = create_test_node(
        "a",
        "Test",
        "test",
        vec![],
        Some(vec![0.5, 0.5, 0.0]),
    );

    let node_b = create_test_node(
        "b",
        "Test",
        "test",
        vec![],
        Some(vec![0.5, 0.5, 0.0]),
    );

    let result = compute_score(&node_a, &node_b);

    // Raw cosine should be 1.0 (identical vectors)
    // After pow(1.25): 1.0^1.25 = 1.0
    assert!((result.components.embedding_similarity - 1.0).abs() < 0.01);

    // Now test with lower similarity
    let node_c = create_test_node(
        "c",
        "Different",
        "other",
        vec![],
        Some(vec![0.3, 0.3, 0.0]),
    );

    let result2 = compute_score(&node_a, &node_c);

    // The embedding component should be > 0 but transformed by pow(1.25)
    assert!(result2.components.embedding_similarity > 0.0);
    println!("Embedding similarity (after nonlinearity): {}", result2.components.embedding_similarity);
}
