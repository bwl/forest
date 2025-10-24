use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::PathBuf;
use std::str::FromStr;

pub mod types;
pub mod utils;
pub mod nodes;
pub mod edges;
pub mod documents;

pub use types::*;
pub use utils::*;

/// Database connection pool singleton
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Create a new database connection and run migrations
    ///
    /// Reads database path from FOREST_DB_PATH environment variable
    /// or defaults to "forest.db" in the current working directory.
    pub async fn new() -> Result<Self> {
        let db_path = get_database_path();

        // Create parent directory if it doesn't exist
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .context("Failed to create database directory")?;
        }

        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))?
            .create_if_missing(true)
            .busy_timeout(std::time::Duration::from_secs(30));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .context("Failed to connect to database")?;

        // Run migrations automatically
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .context("Failed to run database migrations")?;

        Ok(Self { pool })
    }

    /// Get a reference to the connection pool for direct queries
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Close the database connection
    pub async fn close(self) {
        self.pool.close().await;
    }

    /// Get basic database statistics
    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        let nodes_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM nodes WHERE 1=1"
        )
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        let edges_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM edges WHERE status = 'accepted'"
        )
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        let suggested_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM edges WHERE status = 'suggested'"
        )
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);

        Ok(DatabaseStats {
            nodes: nodes_count,
            edges: edges_count,
            suggested: suggested_count,
        })
    }

    // ===== Node Operations =====

    /// Insert a new node
    pub async fn insert_node(&self, node: NewNode) -> Result<NodeRecord> {
        nodes::insert_node(&self.pool, node).await
    }

    /// Get node by ID (supports short ID prefix matching)
    pub async fn get_node_by_id(&self, id: &str) -> Result<NodeRecord> {
        nodes::get_node_by_id(&self.pool, id).await
    }

    /// Update a node
    pub async fn update_node(&self, id: &str, update: UpdateNode) -> Result<NodeRecord> {
        nodes::update_node(&self.pool, id, update).await
    }

    /// Delete a node and its associated edges
    pub async fn delete_node(&self, id: &str) -> Result<DeleteNodeResult> {
        nodes::delete_node(&self.pool, id).await
    }

    /// List all nodes with pagination
    pub async fn list_nodes(&self, pagination: Pagination) -> Result<Vec<NodeRecord>> {
        nodes::list_nodes(&self.pool, pagination).await
    }

    /// Search nodes by title substring
    pub async fn search_nodes_by_title(&self, query: &str) -> Result<Vec<NodeRecord>> {
        nodes::search_nodes_by_title(&self.pool, query).await
    }

    /// Update node position for graph visualization
    pub async fn update_node_position(&self, id: &str, x: f64, y: f64) -> Result<()> {
        nodes::update_node_position(&self.pool, id, x, y).await
    }

    // ===== Edge Operations =====

    /// Insert or update an edge (upsert)
    pub async fn upsert_edge(&self, edge: NewEdge) -> Result<EdgeRecord> {
        edges::upsert_edge(&self.pool, edge).await
    }

    /// Get edge by ID
    pub async fn get_edge_by_id(&self, id: &str) -> Result<EdgeRecord> {
        edges::get_edge_by_id(&self.pool, id).await
    }

    /// List edges with optional filtering
    pub async fn list_edges(&self, filters: EdgeFilters, pagination: Pagination) -> Result<Vec<EdgeRecord>> {
        edges::list_edges(&self.pool, filters, pagination).await
    }

    /// Get all edges for a specific node
    pub async fn get_edges_for_node(&self, node_id: &str) -> Result<Vec<EdgeRecord>> {
        edges::get_edges_for_node(&self.pool, node_id).await
    }

    /// Delete edge between two nodes
    pub async fn delete_edge(&self, source_id: &str, target_id: &str) -> Result<bool> {
        edges::delete_edge(&self.pool, source_id, target_id).await
    }

    /// Promote suggestions to accepted (bulk operation)
    pub async fn promote_suggestions(&self, min_score: f64) -> Result<i64> {
        edges::promote_suggestions(&self.pool, min_score).await
    }

    // ===== Document Operations =====

    /// Insert or update a document (upsert)
    pub async fn upsert_document(&self, doc: NewDocument) -> Result<DocumentRecord> {
        documents::upsert_document(&self.pool, doc).await
    }

    /// Get document by ID
    pub async fn get_document_by_id(&self, id: &str) -> Result<DocumentRecord> {
        documents::get_document_by_id(&self.pool, id).await
    }

    /// Get document chunks for a document
    pub async fn get_document_chunks(&self, document_id: &str) -> Result<Vec<DocumentChunkRecord>> {
        documents::get_document_chunks(&self.pool, document_id).await
    }

    /// Replace all chunks for a document
    pub async fn replace_document_chunks(&self, document_id: &str, chunks: Vec<DocumentChunkRecord>) -> Result<()> {
        documents::replace_document_chunks(&self.pool, document_id, chunks).await
    }

    // ===== Edge Events (Undo Support) =====

    /// Log an edge event for undo support
    pub async fn log_edge_event(&self, event: EdgeEventInput) -> Result<i64> {
        edges::log_edge_event(&self.pool, event).await
    }

    /// Get the last edge event for a node pair
    pub async fn get_last_edge_event(&self, source_id: &str, target_id: &str) -> Result<Option<EdgeEventRecord>> {
        edges::get_last_edge_event(&self.pool, source_id, target_id).await
    }

    /// Mark an edge event as undone
    pub async fn mark_edge_event_undone(&self, event_id: i64) -> Result<()> {
        edges::mark_edge_event_undone(&self.pool, event_id).await
    }
}

/// Basic database statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct DatabaseStats {
    pub nodes: i64,
    pub edges: i64,
    pub suggested: i64,
}

/// Result of deleting a node
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeleteNodeResult {
    pub node_removed: bool,
    pub edges_removed: i64,
}

/// Input for logging edge events
#[derive(Debug, Clone)]
pub struct EdgeEventInput {
    pub edge_id: Option<String>,
    pub source_id: String,
    pub target_id: String,
    pub prev_status: Option<String>,
    pub next_status: String,
    pub payload: Option<serde_json::Value>,
}

/// Get the database file path from environment or use default
fn get_database_path() -> PathBuf {
    std::env::var("FOREST_DB_PATH")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            // Default to forest.db in current working directory
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("forest.db")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_creation_and_migrations() {
        // Use unique in-memory database for testing
        std::env::set_var("FOREST_DB_PATH", ":memory:");
        let db = Database::new().await.unwrap();

        // Migrations should have created all tables
        let stats = db.get_stats().await.unwrap();
        assert_eq!(stats.nodes, 0);
        assert_eq!(stats.edges, 0);
        assert_eq!(stats.suggested, 0);

        db.close().await;
    }
}
