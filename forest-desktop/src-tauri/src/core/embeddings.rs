//! Embedding generation for semantic search and linking
//!
//! Provides multiple embedding providers:
//! - `local`: fastembed-rs with all-MiniLM-L6-v2 (384-dim)
//! - `openai`: OpenAI's text-embedding-3-small API (1536-dim)
//! - `mock`: Deterministic hash-based vectors for testing (384-dim)
//! - `none`: Disables embeddings (pure lexical scoring)
//!
//! Environment variables:
//! - `FOREST_EMBED_PROVIDER`: local | openai | mock | none (default: local)
//! - `OPENAI_API_KEY`: Required for OpenAI provider
//! - `FOREST_EMBED_MODEL`: Override model name (optional)

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Embedding vector type (f64 for compatibility with scoring)
pub type Embedding = Vec<f64>;

/// Embedding provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EmbeddingProvider {
    /// Local embeddings via fastembed-rs (all-MiniLM-L6-v2, 384-dim)
    Local,
    /// OpenAI API (text-embedding-3-small, 1536-dim)
    OpenAI,
    /// Deterministic hash-based vectors for testing (384-dim)
    Mock,
    /// Embeddings disabled (pure lexical scoring)
    None,
}

impl EmbeddingProvider {
    /// Parse provider from environment variable
    pub fn from_env() -> Self {
        let raw = std::env::var("FOREST_EMBED_PROVIDER")
            .unwrap_or_else(|_| "local".to_string())
            .to_lowercase();

        match raw.as_str() {
            "openai" => Self::OpenAI,
            "local" | "transformers" | "xenova" => Self::Local,
            "none" | "off" | "disabled" => Self::None,
            _ => Self::Mock,
        }
    }

    /// Check if embeddings are enabled
    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::None)
    }

    /// Get expected embedding dimension
    pub fn dimension(&self) -> usize {
        match self {
            Self::Local => 384,   // all-MiniLM-L6-v2
            Self::OpenAI => 1536, // text-embedding-3-small
            Self::Mock => 384,    // matches local
            Self::None => 0,
        }
    }
}

/// Main embedding service
pub struct EmbeddingService {
    provider: EmbeddingProvider,
    local: Mutex<Option<LocalEmbedder>>,
    openai: Option<OpenAIEmbedder>,
}

impl EmbeddingService {
    /// Create a new embedding service from environment config
    pub fn new() -> Result<Self> {
        let provider = EmbeddingProvider::from_env();

        let openai = if matches!(provider, EmbeddingProvider::OpenAI) {
            Some(OpenAIEmbedder::new()?)
        } else {
            None
        };

        Ok(Self {
            provider,
            local: Mutex::new(None),
            openai,
        })
    }

    /// Get the current provider
    pub fn provider(&self) -> EmbeddingProvider {
        self.provider
    }

    /// Embed arbitrary text
    pub async fn embed_text(&self, text: &str) -> Result<Option<Embedding>> {
        if text.trim().is_empty() {
            return Ok(None);
        }

        match self.provider {
            EmbeddingProvider::None => Ok(None),
            EmbeddingProvider::Local => self.embed_local(text).await,
            EmbeddingProvider::OpenAI => self.embed_openai(text).await,
            EmbeddingProvider::Mock => Ok(Some(embed_mock(text))),
        }
    }

    /// Embed a node (title + body)
    pub async fn embed_node(&self, title: &str, body: &str) -> Result<Option<Embedding>> {
        let text = format!("{}\n{}", title, body);
        self.embed_text(&text).await
    }

    /// Local embedding via fastembed-rs (lazy initialization)
    async fn embed_local(&self, text: &str) -> Result<Option<Embedding>> {
        // Lazy initialize on first use (models are large, don't load unless needed)
        {
            let mut guard = self.local.lock().unwrap();
            if guard.is_none() {
                let embedder = LocalEmbedder::new()
                    .context("Failed to initialize local embedding model")?;
                *guard = Some(embedder);
            }
        }

        // Now embed (outside the lock to allow concurrent access)
        let guard = self.local.lock().unwrap();
        let embedder = guard.as_ref().unwrap();

        let embedding = embedder.embed(text)
            .context("Failed to generate local embedding")?;

        Ok(Some(embedding))
    }

    /// OpenAI embedding via API
    async fn embed_openai(&self, text: &str) -> Result<Option<Embedding>> {
        let embedder = self.openai.as_ref()
            .context("OpenAI embedder not initialized (missing OPENAI_API_KEY?)")?;

        let embedding = embedder.embed(text).await
            .context("Failed to generate OpenAI embedding")?;

        Ok(Some(embedding))
    }
}

// ============================================================================
// Local Provider (fastembed-rs)
// ============================================================================

struct LocalEmbedder {
    model: fastembed::TextEmbedding,
}

impl LocalEmbedder {
    fn new() -> Result<Self> {
        // Default model: all-MiniLM-L6-v2 (384-dim, same as TypeScript)
        // fastembed uses the AllMiniLML6V2 enum variant for this model
        let model_variant = fastembed::EmbeddingModel::AllMiniLML6V2;

        // Initialize model with download progress (downloads if not cached)
        let init_options = fastembed::InitOptions::new(model_variant)
            .with_show_download_progress(true);

        let model = fastembed::TextEmbedding::try_new(init_options)
            .context("Failed to load local embedding model")?;

        Ok(Self { model })
    }

    fn embed(&self, text: &str) -> Result<Embedding> {
        // Generate embedding (fastembed handles pooling and normalization)
        let embeddings = self.model.embed(vec![text], None)
            .context("Embedding generation failed")?;

        // Convert f32 -> f64 for compatibility with our scoring functions
        let embedding: Vec<f64> = embeddings
            .first()
            .context("No embedding returned")?
            .iter()
            .map(|&x| x as f64)
            .collect();

        Ok(embedding)
    }
}

// ============================================================================
// OpenAI Provider
// ============================================================================

#[derive(Clone)]
struct OpenAIEmbedder {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl OpenAIEmbedder {
    fn new() -> Result<Self> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .context("OPENAI_API_KEY is required for openai embedding provider")?;

        let model = std::env::var("FOREST_EMBED_MODEL")
            .unwrap_or_else(|_| "text-embedding-3-small".to_string());

        Ok(Self {
            api_key,
            model,
            client: reqwest::Client::new(),
        })
    }

    async fn embed(&self, text: &str) -> Result<Embedding> {
        #[derive(Serialize)]
        struct Request {
            model: String,
            input: String,
        }

        #[derive(Deserialize)]
        struct Response {
            data: Vec<EmbeddingData>,
        }

        #[derive(Deserialize)]
        struct EmbeddingData {
            embedding: Vec<f64>,
        }

        let request = Request {
            model: self.model.clone(),
            input: text.to_string(),
        };

        let response = self.client
            .post("https://api.openai.com/v1/embeddings")
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .context("Failed to send OpenAI API request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "OpenAI embeddings error: {} - {}",
                status,
                body
            );
        }

        let data: Response = response.json().await
            .context("Failed to parse OpenAI response")?;

        let embedding = data.data
            .first()
            .context("No embedding in OpenAI response")?
            .embedding
            .clone();

        Ok(embedding)
    }
}

// ============================================================================
// Mock Provider (Deterministic Hash-Based)
// ============================================================================

/// Generate deterministic mock embedding via FNV-1a hashing
/// Matches TypeScript implementation for compatibility
fn embed_mock(text: &str) -> Embedding {
    const DIM: usize = 384;
    let mut vec = vec![0.0f64; DIM];

    // Tokenize (lowercase, alphanumeric only)
    let tokens: Vec<String> = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|s| s.to_string())
        .collect();

    // FNV-1a hashing (matches TypeScript)
    for token in tokens {
        let mut hash: u32 = 2166136261;
        for byte in token.bytes() {
            hash ^= byte as u32;
            hash = hash.wrapping_mul(16777619);
        }
        let idx = (hash as usize) % DIM;
        vec[idx] += 1.0;
    }

    // L2 normalization
    let norm = vec.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm > 0.0 {
        for x in &mut vec {
            *x /= norm;
        }
    }

    vec
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Compute cosine similarity between two embeddings
pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f64 = a.iter().map(|x| x * x).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|x| x * x).sum::<f64>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_from_env() {
        std::env::set_var("FOREST_EMBED_PROVIDER", "local");
        assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::Local);

        std::env::set_var("FOREST_EMBED_PROVIDER", "openai");
        assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::OpenAI);

        std::env::set_var("FOREST_EMBED_PROVIDER", "none");
        assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::None);

        std::env::set_var("FOREST_EMBED_PROVIDER", "mock");
        assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::Mock);
    }

    #[test]
    fn test_mock_embedding_deterministic() {
        let text = "The quick brown fox jumps over the lazy dog";
        let e1 = embed_mock(text);
        let e2 = embed_mock(text);

        assert_eq!(e1.len(), 384);
        assert_eq!(e1, e2, "Mock embeddings should be deterministic");
    }

    #[test]
    fn test_mock_embedding_normalized() {
        let text = "test text for normalization";
        let embedding = embed_mock(text);

        let magnitude: f64 = embedding.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((magnitude - 1.0).abs() < 1e-6, "Embedding should be L2 normalized");
    }

    #[test]
    fn test_mock_embedding_similarity() {
        let e1 = embed_mock("machine learning artificial intelligence");
        let e2 = embed_mock("machine learning AI");
        let e3 = embed_mock("cooking recipes food");

        let sim_12 = cosine_similarity(&e1, &e2);
        let sim_13 = cosine_similarity(&e1, &e3);

        assert!(sim_12 > sim_13, "Similar text should have higher similarity");
        assert!(sim_12 > 0.5, "Related text should have positive similarity");
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let c = vec![0.0, 1.0, 0.0];

        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);
        assert!((cosine_similarity(&a, &c) - 0.0).abs() < 1e-6);
    }
}
