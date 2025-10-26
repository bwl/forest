// Public API exports for the Forest Desktop application
//
// This module exposes the core functionality of the Rust backend
// for use by the Tauri frontend and other modules.

pub mod db;
pub mod core;
pub mod state;
pub mod errors;
pub mod shell_integration;

// Re-export key types for convenience
pub use db::{Database, DatabaseStats};
pub use core::{text, scoring, embeddings};
pub use state::AppState;
pub use errors::{ForestError, ForestResult};

// Global embedding service (lazy initialization)
use lazy_static::lazy_static;
use core::embeddings::EmbeddingService;

lazy_static! {
    /// Global embedding service instance
    /// Initialized on first access with provider from FOREST_EMBED_PROVIDER env var
    pub static ref EMBEDDING_SERVICE: EmbeddingService =
        EmbeddingService::new()
            .unwrap_or_else(|e| {
                eprintln!("Warning: Failed to initialize embedding service: {}", e);
                eprintln!("Falling back to mock provider for testing");
                // Fallback to mock provider on failure
                std::env::set_var("FOREST_EMBED_PROVIDER", "mock");
                EmbeddingService::new().expect("Mock provider should never fail")
            });
}
