//! Example: Score Comparison Demo
//!
//! Demonstrates the Rust scoring algorithm with sample node pairs.
//! Run with: cargo run --example score_comparison

use forest_desktop::core::{scoring::*, text::*};
use forest_desktop::db::types::NodeRecord;
use std::collections::HashMap;

fn create_node(
    id: &str,
    title: &str,
    body: &str,
    tags: Vec<&str>,
    embedding: Option<Vec<f64>>,
) -> NodeRecord {
    let full_text = format!("{}\n{}", title, body);
    let token_counts = tokenize(&full_text);

    NodeRecord {
        id: id.to_string(),
        title: title.to_string(),
        body: body.to_string(),
        tags: tags.into_iter().map(|s| s.to_string()).collect(),
        token_counts,
        embedding,
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    }
}

fn print_score_result(label: &str, a: &NodeRecord, b: &NodeRecord) {
    let result = compute_score(a, b);
    let classification = classify_score(result.score);

    println!("\n{}", "=".repeat(80));
    println!("📊 {}", label);
    println!("{}", "=".repeat(80));
    println!("\nNode A: \"{}\"", a.title);
    println!("  Tags: {:?}", a.tags);
    println!("\nNode B: \"{}\"", b.title);
    println!("  Tags: {:?}", b.tags);
    println!("\n{}", "-".repeat(80));
    println!("SCORE COMPONENTS:");
    println!("  Tag overlap:         {:.4}", result.components.tag_overlap);
    println!("  Token similarity:    {:.4}", result.components.token_similarity);
    println!("  Title similarity:    {:.4}", result.components.title_similarity);
    println!("  Embedding similarity:{:.4}", result.components.embedding_similarity);
    println!("  Penalty factor:      {:.4}", result.components.penalty);
    println!("\n{}", "-".repeat(80));
    println!("FINAL SCORE:           {:.4}", result.score);
    println!("CLASSIFICATION:        {:?}", classification);
    println!("{}", "=".repeat(80));
}

fn main() {
    println!("\n🎯 Forest Scoring Algorithm - Rust Implementation Demo\n");

    // Example 1: Identical nodes (should score ~1.0)
    let node1 = create_node(
        "abc123",
        "Rust Programming",
        "Learning Rust programming language with examples and best practices.",
        vec!["rust", "programming"],
        Some(vec![0.8, 0.6, 0.0]),
    );
    print_score_result("Example 1: Identical Nodes", &node1, &node1);

    // Example 2: Similar nodes (strong lexical + semantic overlap)
    let node2a = create_node(
        "def456",
        "Building Graph Databases",
        "Graph databases are essential for connected data. Learn to build efficient graph structures.",
        vec!["database", "graph", "data"],
        Some(vec![0.7, 0.5, 0.1]),
    );

    let node2b = create_node(
        "ghi789",
        "Graph Database Design",
        "Designing graph databases requires understanding data relationships and query patterns.",
        vec!["database", "graph", "design"],
        Some(vec![0.7, 0.5, 0.15]),
    );
    print_score_result("Example 2: Similar Nodes (High Overlap)", &node2a, &node2b);

    // Example 3: Semantic similarity only (penalty should apply)
    let node3a = create_node(
        "jkl012",
        "Machine Learning",
        "Understanding neural networks and training models.",
        vec![],
        Some(vec![0.9, 0.1, 0.2]),
    );

    let node3b = create_node(
        "mno345",
        "Deep Learning",
        "Building and optimizing deep neural architectures.",
        vec![],
        Some(vec![0.85, 0.15, 0.25]), // Similar embedding
    );
    print_score_result("Example 3: Semantic Only (Penalty Applied)", &node3a, &node3b);

    // Example 4: Completely different nodes (should score low)
    let node4a = create_node(
        "pqr678",
        "Cooking Italian Pasta",
        "Recipes and techniques for authentic Italian pasta dishes.",
        vec!["cooking", "italian", "recipe"],
        Some(vec![0.1, 0.9, 0.0]),
    );

    let node4b = create_node(
        "stu901",
        "Quantum Computing",
        "Exploring quantum algorithms and their applications in cryptography.",
        vec!["quantum", "computing", "cryptography"],
        Some(vec![0.9, 0.1, 0.8]),
    );
    print_score_result("Example 4: Completely Different", &node4a, &node4b);

    // Example 5: Token downweighting demonstration
    let mut tokens_flow = HashMap::new();
    tokens_flow.insert("flow".to_string(), 10);
    tokens_flow.insert("control".to_string(), 5);

    let node5a = NodeRecord {
        id: "vwx234".to_string(),
        title: "Control Flow".to_string(),
        body: "flow flow flow".to_string(),
        tags: vec!["flow".to_string()],
        token_counts: tokens_flow.clone(),
        embedding: Some(vec![0.5, 0.5, 0.0]),
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node5b = NodeRecord {
        id: "yza567".to_string(),
        title: "Control Flow".to_string(),
        body: "flow flow flow".to_string(),
        tags: vec!["flow".to_string()],
        token_counts: tokens_flow,
        embedding: Some(vec![0.5, 0.5, 0.0]),
        created_at: "2025-01-01T00:00:00Z".to_string(),
        updated_at: "2025-01-01T00:00:00Z".to_string(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };
    print_score_result("Example 5: Token Downweighting (Generic 'flow')", &node5a, &node5b);

    // Print thresholds
    println!("\n{}", "=".repeat(80));
    println!("CLASSIFICATION THRESHOLDS:");
    println!("  Auto-accept:  >= {:.2}", get_auto_accept_threshold());
    println!("  Suggested:    >= {:.2}", get_suggestion_threshold());
    println!("  Discard:      <  {:.2}", get_suggestion_threshold());
    println!("{}", "=".repeat(80));

    println!("\n✅ All examples completed successfully!\n");
}
