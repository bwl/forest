use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Database operation errors
#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database query failed: {0}")]
    QueryFailed(#[from] sqlx::Error),

    #[error("JSON serialization failed: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Edge not found: {0}")]
    EdgeNotFound(String),

    #[error("Document not found: {0}")]
    DocumentNotFound(String),

    #[error("Ambiguous ID '{0}' matches {1} nodes")]
    AmbiguousId(String, usize),

    #[error("Invalid UUID: {0}")]
    InvalidUuid(String),

    #[error("Database constraint violation: {0}")]
    ConstraintViolation(String),
}

/// Node record - matches TypeScript NodeRecord
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRecord {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub token_counts: HashMap<String, i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding: Option<Vec<f64>>,
    pub created_at: String,
    pub updated_at: String,
    pub is_chunk: bool,
    pub parent_document_id: Option<String>,
    pub chunk_order: Option<i64>,
}

/// Edge status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeStatus {
    Accepted,
    Suggested,
}

impl EdgeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            EdgeStatus::Accepted => "accepted",
            EdgeStatus::Suggested => "suggested",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, DbError> {
        match s {
            "accepted" => Ok(EdgeStatus::Accepted),
            "suggested" => Ok(EdgeStatus::Suggested),
            _ => Err(DbError::ConstraintViolation(format!("Invalid edge status: {}", s))),
        }
    }
}

/// Edge type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EdgeType {
    Semantic,
    ParentChild,
    Sequential,
    Manual,
}

impl EdgeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EdgeType::Semantic => "semantic",
            EdgeType::ParentChild => "parent-child",
            EdgeType::Sequential => "sequential",
            EdgeType::Manual => "manual",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, DbError> {
        match s {
            "semantic" => Ok(EdgeType::Semantic),
            "parent-child" => Ok(EdgeType::ParentChild),
            "sequential" => Ok(EdgeType::Sequential),
            "manual" => Ok(EdgeType::Manual),
            _ => Err(DbError::ConstraintViolation(format!("Invalid edge type: {}", s))),
        }
    }
}

/// Edge record - matches TypeScript EdgeRecord
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeRecord {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub score: f64,
    pub status: EdgeStatus,
    pub edge_type: EdgeType,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Document metadata - matches TypeScript DocumentMetadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadata {
    // Import settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunk_strategy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overlap: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunk_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_link: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_parent: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_sequential: Option<bool>,

    // Edit tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_edited_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_edited_node_id: Option<String>,

    // Backfill tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backfill: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunk_orders_provided: Option<bool>,

    // Allow extensions via flatten
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Document record - matches TypeScript DocumentRecord
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    pub id: String,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<DocumentMetadata>,
    pub version: i64,
    pub root_node_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Document chunk record - matches TypeScript DocumentChunkRecord
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentChunkRecord {
    pub document_id: String,
    pub segment_id: String,
    pub node_id: String,
    pub offset: i64,
    pub length: i64,
    pub chunk_order: i64,
    pub checksum: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Edge event record - matches TypeScript EdgeEvent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeEventRecord {
    pub id: i64,
    pub edge_id: Option<String>,
    pub source_id: String,
    pub target_id: String,
    pub prev_status: Option<String>,
    pub next_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
    pub created_at: String,
    pub undone: bool,
}

/// Helper for creating new nodes
#[derive(Debug, Clone)]
pub struct NewNode {
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub token_counts: HashMap<String, i64>,
    pub embedding: Option<Vec<f64>>,
    pub is_chunk: bool,
    pub parent_document_id: Option<String>,
    pub chunk_order: Option<i64>,
}

/// Helper for creating new edges
#[derive(Debug, Clone)]
pub struct NewEdge {
    pub source_id: String,
    pub target_id: String,
    pub score: f64,
    pub status: EdgeStatus,
    pub edge_type: EdgeType,
    pub metadata: Option<serde_json::Value>,
}

/// Helper for creating new documents
#[derive(Debug, Clone)]
pub struct NewDocument {
    pub title: String,
    pub body: String,
    pub metadata: Option<DocumentMetadata>,
    pub root_node_id: Option<String>,
}

/// Helper for updating nodes
#[derive(Debug, Clone, Default)]
pub struct UpdateNode {
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
    pub token_counts: Option<HashMap<String, i64>>,
    pub embedding: Option<Vec<f64>>,
}

/// Query filters for listing edges
#[derive(Debug, Clone, Default)]
pub struct EdgeFilters {
    pub status: Option<EdgeStatus>,
    pub min_score: Option<f64>,
    pub max_score: Option<f64>,
    pub edge_type: Option<EdgeType>,
    pub node_id: Option<String>,
}

/// Pagination parameters
#[derive(Debug, Clone)]
pub struct Pagination {
    pub limit: i64,
    pub offset: i64,
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            limit: 100,
            offset: 0,
        }
    }
}
