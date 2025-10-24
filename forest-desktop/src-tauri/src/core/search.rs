//! Semantic search using embeddings and similarity ranking
//!
//! This module implements semantic search by computing cosine similarity
//! between a query embedding and all node embeddings in the database.

use anyhow::Result;
use crate::db::{Database, NodeRecord, Pagination};
use crate::EMBEDDING_SERVICE;
use crate::core::scoring::cosine_embeddings;

/// Search result with similarity score
#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchResult {
    pub node: NodeRecord,
    pub similarity: f64,
}

/// Perform semantic search using embeddings
///
/// Steps:
/// 1. Embed the query text
/// 2. Get all nodes with embeddings from database
/// 3. Compute cosine similarity between query and each node
/// 4. Sort by similarity (descending)
/// 5. Return top N results
///
/// # Arguments
/// - `db`: Database connection
/// - `query`: Search query text
/// - `limit`: Maximum number of results to return
///
/// # Returns
/// Vector of SearchResult ordered by similarity (highest first)
///
/// # Errors
/// - If query embedding fails
/// - If database query fails
pub async fn semantic_search(
    db: &Database,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    // 1. Embed query
    let query_embedding = EMBEDDING_SERVICE.embed_text(query).await?;

    // If embeddings are disabled, return empty results
    if query_embedding.is_none() {
        return Ok(vec![]);
    }

    let query_emb = query_embedding.unwrap();

    // 2. Get all nodes with embeddings (use large limit to get all nodes)
    let all_nodes = db.list_nodes(Pagination { limit: 10000, offset: 0 }).await?;

    // 3. Compute similarities and collect results
    let mut results: Vec<SearchResult> = Vec::new();
    for node in all_nodes {
        // Only process nodes that have embeddings
        if let Some(emb) = &node.embedding {
            let similarity = cosine_embeddings(
                Some(&query_emb),
                Some(emb)
            );
            results.push(SearchResult { node, similarity });
        }
    }

    // 4. Sort by similarity (descending - highest first)
    results.sort_by(|a, b| {
        b.similarity
            .partial_cmp(&a.similarity)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // 5. Return top N results
    Ok(results.into_iter().take(limit).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_search_result_serialization() {
        let node = NodeRecord {
            id: "test-id".to_string(),
            title: "Test Node".to_string(),
            body: "Test body content".to_string(),
            tags: vec!["test".to_string()],
            token_counts: HashMap::new(),
            embedding: Some(vec![0.1, 0.2, 0.3]),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };

        let result = SearchResult {
            node,
            similarity: 0.85,
        };

        // Verify serialization works
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("0.85"));
    }
}
