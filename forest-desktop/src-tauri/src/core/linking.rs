//! Auto-linking logic for connecting new nodes to the graph
//!
//! This module provides the core auto-linking algorithm that scores
//! a new node against all existing nodes and creates edges based on
//! score classification thresholds.

use anyhow::Result;
use crate::db::{Database, NodeRecord, NewEdge, EdgeType, EdgeStatus, Pagination};
use crate::core::scoring;

/// Result of an auto-linking operation
#[derive(Debug, Clone)]
pub struct LinkingResult {
    pub accepted: usize,
    pub suggested: usize,
}

/// Auto-link a node against all existing nodes in the graph
///
/// Computes hybrid scores and creates edges:
/// - score >= 0.5: accepted (auto-created)
/// - 0.25 <= score < 0.5: suggested (for review)
/// - score < 0.25: discarded (not stored)
///
/// # Arguments
///
/// * `db` - Database connection
/// * `new_node` - The newly created node to link into the graph
///
/// # Returns
///
/// LinkingResult with counts of accepted and suggested edges created
pub async fn auto_link_node(db: &Database, new_node: &NodeRecord) -> Result<LinkingResult> {
    let mut accepted = 0;
    let mut suggested = 0;

    // Get all existing nodes (except the one we just created)
    let all_nodes = db.list_nodes(Pagination { limit: 10000, offset: 0 }).await?;

    for other in all_nodes {
        if other.id == new_node.id {
            continue;
        }

        // Compute hybrid score
        let score_result = scoring::compute_score(new_node, &other);
        let classification = scoring::classify_score(score_result.score);

        // Convert classification to edge status
        let status = match scoring::classification_to_status(classification) {
            Some(s) => s,
            None => continue, // Discard - don't store
        };

        // Normalize edge pair (sourceId < targetId)
        let (source, target) = scoring::normalize_edge_pair(&new_node.id, &other.id);

        // Create edge
        let new_edge = NewEdge {
            source_id: source,
            target_id: target,
            score: score_result.score,
            status,
            edge_type: EdgeType::Semantic,
            metadata: None,
        };

        db.upsert_edge(new_edge).await?;

        // Track counts
        match status {
            EdgeStatus::Accepted => accepted += 1,
            EdgeStatus::Suggested => suggested += 1,
        }
    }

    Ok(LinkingResult { accepted, suggested })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::NewNode;
    use crate::core::text;

    #[tokio::test]
    async fn test_auto_link_node() {
        // Use unique in-memory database for testing
        std::env::set_var("FOREST_DB_PATH", ":memory:");
        let db = Database::new().await.unwrap();

        // Create first node
        let node1 = NewNode {
            title: "Rust Programming".to_string(),
            body: "Rust is a systems programming language focused on safety and performance.".to_string(),
            tags: vec!["rust".to_string(), "programming".to_string()],
            token_counts: text::tokenize("Rust is a systems programming language focused on safety and performance."),
            embedding: Some(vec![0.1; 384]), // Mock embedding
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };
        let _node1_record = db.insert_node(node1).await.unwrap();

        // Create second node with similar content
        let node2 = NewNode {
            title: "Memory Safety in Rust".to_string(),
            body: "Rust guarantees memory safety without garbage collection through ownership.".to_string(),
            tags: vec!["rust".to_string(), "memory".to_string()],
            token_counts: text::tokenize("Rust guarantees memory safety without garbage collection through ownership."),
            embedding: Some(vec![0.11; 384]), // Similar mock embedding
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };
        let node2_record = db.insert_node(node2).await.unwrap();

        // Auto-link the second node
        let result = auto_link_node(&db, &node2_record).await.unwrap();

        // Should have created at least one edge (accepted or suggested)
        assert!(
            result.accepted + result.suggested > 0,
            "Expected at least one edge to be created"
        );

        db.close().await;
    }
}
