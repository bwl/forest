use crate::db::Database;
use anyhow::Result;

/// Application state managed by Tauri
///
/// This state is shared across all Tauri commands.
/// For now, this is a lightweight marker struct - database connections
/// are created per-request. Future optimizations could include:
/// - Connection pooling
/// - Shared configuration
/// - Caching layer
pub struct AppState {
    // Currently empty, but reserved for future state like config, cache, etc.
}

impl AppState {
    /// Create a new AppState instance
    pub fn new() -> Self {
        Self {}
    }

    /// Create a new database connection
    ///
    /// Each command gets a fresh connection for now.
    /// This is safe and simple, with room for optimization later via connection pooling.
    pub async fn get_db(&self) -> Result<Database> {
        Database::new().await
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
