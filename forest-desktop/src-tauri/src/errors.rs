use serde::Serialize;
use thiserror::Error;

/// Custom error type for Forest Desktop application
///
/// This provides structured error responses that can be serialized
/// and sent to the frontend for proper error handling.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum ForestError {
    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Edge not found: source={0}, target={1}")]
    EdgeNotFound(String, String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Embedding service error: {0}")]
    EmbeddingError(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

/// Convert anyhow::Error to ForestError
impl From<anyhow::Error> for ForestError {
    fn from(err: anyhow::Error) -> Self {
        ForestError::InternalError(err.to_string())
    }
}

/// Convenience type alias for Result with ForestError
pub type ForestResult<T> = Result<T, ForestError>;
