use anyhow::Result;
use serde::{Deserialize, Serialize};
use forest_desktop::db::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct ForestStats {
    pub nodes: i64,
    pub edges: i64,
    pub suggested: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub similarity: f64,
}

/// Get graph statistics
#[tauri::command]
pub async fn get_stats() -> Result<ForestStats, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;
    let stats = db.get_stats().await.map_err(|e| e.to_string())?;
    db.close().await;

    Ok(ForestStats {
        nodes: stats.nodes,
        edges: stats.edges,
        suggested: stats.suggested,
    })
}

/// Search nodes (placeholder - will implement in Phase 5)
#[tauri::command]
pub async fn search_nodes(query: String, limit: usize) -> Result<Vec<SearchResult>, String> {
    // TODO: Implement semantic search in Phase 5
    // For now, return empty results
    println!("Search query: {} (limit: {})", query, limit);
    Ok(vec![])
}
