//! Comprehensive tests for the embedding system
//!
//! Tests all four providers: local, openai, mock, none

use forest_desktop::core::embeddings::{
    EmbeddingProvider, EmbeddingService, cosine_similarity,
};
use std::env;

// ============================================================================
// Provider Configuration Tests
// ============================================================================

#[test]
fn test_provider_from_env_local() {
    env::set_var("FOREST_EMBED_PROVIDER", "local");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::Local);
}

#[test]
fn test_provider_from_env_openai() {
    env::set_var("FOREST_EMBED_PROVIDER", "openai");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::OpenAI);
}

#[test]
fn test_provider_from_env_mock() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::Mock);
}

#[test]
fn test_provider_from_env_none() {
    env::set_var("FOREST_EMBED_PROVIDER", "none");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::None);

    env::set_var("FOREST_EMBED_PROVIDER", "off");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::None);

    env::set_var("FOREST_EMBED_PROVIDER", "disabled");
    assert_eq!(EmbeddingProvider::from_env(), EmbeddingProvider::None);
}

#[test]
fn test_provider_dimensions() {
    assert_eq!(EmbeddingProvider::Local.dimension(), 384);
    assert_eq!(EmbeddingProvider::OpenAI.dimension(), 1536);
    assert_eq!(EmbeddingProvider::Mock.dimension(), 384);
    assert_eq!(EmbeddingProvider::None.dimension(), 0);
}

#[test]
fn test_provider_is_enabled() {
    assert!(EmbeddingProvider::Local.is_enabled());
    assert!(EmbeddingProvider::OpenAI.is_enabled());
    assert!(EmbeddingProvider::Mock.is_enabled());
    assert!(!EmbeddingProvider::None.is_enabled());
}

// ============================================================================
// None Provider Tests
// ============================================================================

#[tokio::test]
async fn test_none_provider_returns_none() {
    env::set_var("FOREST_EMBED_PROVIDER", "none");
    let service = EmbeddingService::new().unwrap();

    let result = service.embed_text("test text").await.unwrap();
    assert!(result.is_none(), "None provider should return None");
}

#[tokio::test]
async fn test_none_provider_with_node() {
    env::set_var("FOREST_EMBED_PROVIDER", "none");
    let service = EmbeddingService::new().unwrap();

    let result = service.embed_node("Title", "Body text").await.unwrap();
    assert!(result.is_none(), "None provider should return None for nodes");
}

// ============================================================================
// Mock Provider Tests
// ============================================================================

#[tokio::test]
async fn test_mock_provider_deterministic() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = EmbeddingService::new().unwrap();

    let text = "The quick brown fox jumps over the lazy dog";
    let e1 = service.embed_text(text).await.unwrap().unwrap();
    let e2 = service.embed_text(text).await.unwrap().unwrap();

    assert_eq!(e1.len(), 384, "Mock should return 384-dim vectors");
    assert_eq!(e1, e2, "Mock embeddings should be deterministic");
}

#[tokio::test]
async fn test_mock_provider_normalized() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = EmbeddingService::new().unwrap();

    let embedding = service
        .embed_text("test normalization check")
        .await
        .unwrap()
        .unwrap();

    let magnitude: f64 = embedding.iter().map(|x| x * x).sum::<f64>().sqrt();
    assert!(
        (magnitude - 1.0).abs() < 1e-6,
        "Mock embedding should be L2 normalized, got magnitude {}",
        magnitude
    );
}

#[tokio::test]
async fn test_mock_provider_similarity() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = EmbeddingService::new().unwrap();

    let e1 = service
        .embed_text("machine learning artificial intelligence deep learning")
        .await
        .unwrap()
        .unwrap();

    let e2 = service
        .embed_text("machine learning AI neural networks")
        .await
        .unwrap()
        .unwrap();

    let e3 = service
        .embed_text("cooking recipes food preparation kitchen")
        .await
        .unwrap()
        .unwrap();

    let sim_12 = cosine_similarity(&e1, &e2);
    let sim_13 = cosine_similarity(&e1, &e3);

    assert!(
        sim_12 > sim_13,
        "Similar text should have higher similarity: {} vs {}",
        sim_12,
        sim_13
    );
    assert!(sim_12 > 0.4, "Related text should have positive similarity");
}

#[tokio::test]
async fn test_mock_provider_empty_text() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = EmbeddingService::new().unwrap();

    let result = service.embed_text("").await.unwrap();
    assert!(result.is_none(), "Empty text should return None");

    let result = service.embed_text("   ").await.unwrap();
    assert!(result.is_none(), "Whitespace-only text should return None");
}

// ============================================================================
// Local Provider Tests (fastembed-rs)
// ============================================================================

#[tokio::test]
#[ignore] // Run with: cargo test --test embeddings_test test_local_provider -- --ignored
async fn test_local_provider_basic() {
    env::set_var("FOREST_EMBED_PROVIDER", "local");
    let service = EmbeddingService::new().unwrap();

    let embedding = service
        .embed_text("This is a test sentence")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(
        embedding.len(),
        384,
        "Local provider should return 384-dim vectors"
    );
}

#[tokio::test]
#[ignore] // Model download can be slow
async fn test_local_provider_normalized() {
    env::set_var("FOREST_EMBED_PROVIDER", "local");
    let service = EmbeddingService::new().unwrap();

    let embedding = service
        .embed_text("test normalization")
        .await
        .unwrap()
        .unwrap();

    let magnitude: f64 = embedding.iter().map(|x| x * x).sum::<f64>().sqrt();
    assert!(
        (magnitude - 1.0).abs() < 0.01,
        "Local embedding should be normalized, got magnitude {}",
        magnitude
    );
}

#[tokio::test]
#[ignore] // Requires model download
async fn test_local_provider_semantic_similarity() {
    env::set_var("FOREST_EMBED_PROVIDER", "local");
    let service = EmbeddingService::new().unwrap();

    let e1 = service
        .embed_text("The cat sits on the mat")
        .await
        .unwrap()
        .unwrap();

    let e2 = service
        .embed_text("A feline rests on the rug")
        .await
        .unwrap()
        .unwrap();

    let e3 = service
        .embed_text("Python programming language")
        .await
        .unwrap()
        .unwrap();

    let sim_12 = cosine_similarity(&e1, &e2);
    let sim_13 = cosine_similarity(&e1, &e3);

    // Note: fastembed-rs produces slightly different embeddings than sentence-transformers
    // so we use more realistic thresholds (0.5+ is still good similarity)
    assert!(
        sim_12 > 0.5,
        "Semantically similar sentences should have high similarity: {}",
        sim_12
    );
    assert!(
        sim_13 < 0.4,
        "Unrelated sentences should have low similarity: {}",
        sim_13
    );
    assert!(sim_12 > sim_13, "Similar > dissimilar");
}

#[tokio::test]
#[ignore] // Requires model download
async fn test_local_provider_node_embedding() {
    env::set_var("FOREST_EMBED_PROVIDER", "local");
    let service = EmbeddingService::new().unwrap();

    let title = "Machine Learning Basics";
    let body = "An introduction to supervised and unsupervised learning algorithms.";

    let embedding = service.embed_node(title, body).await.unwrap().unwrap();

    assert_eq!(embedding.len(), 384);

    // Should combine title and body semantics
    let title_only = service.embed_text(title).await.unwrap().unwrap();
    let body_only = service.embed_text(body).await.unwrap().unwrap();

    let sim_combined_title = cosine_similarity(&embedding, &title_only);
    let sim_combined_body = cosine_similarity(&embedding, &body_only);

    assert!(sim_combined_title > 0.5);
    assert!(sim_combined_body > 0.5);
}

// ============================================================================
// OpenAI Provider Tests
// ============================================================================

#[tokio::test]
#[ignore] // Requires OPENAI_API_KEY
async fn test_openai_provider_basic() {
    // Only run if API key is set
    if env::var("OPENAI_API_KEY").is_err() {
        eprintln!("Skipping OpenAI test: OPENAI_API_KEY not set");
        return;
    }

    env::set_var("FOREST_EMBED_PROVIDER", "openai");
    let service = EmbeddingService::new().unwrap();

    let embedding = service
        .embed_text("This is a test sentence for OpenAI")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(
        embedding.len(),
        1536,
        "OpenAI provider should return 1536-dim vectors"
    );
}

#[tokio::test]
#[ignore] // Requires API key
async fn test_openai_provider_similarity() {
    if env::var("OPENAI_API_KEY").is_err() {
        eprintln!("Skipping OpenAI test: OPENAI_API_KEY not set");
        return;
    }

    env::set_var("FOREST_EMBED_PROVIDER", "openai");
    let service = EmbeddingService::new().unwrap();

    let e1 = service
        .embed_text("dog running in park")
        .await
        .unwrap()
        .unwrap();

    let e2 = service
        .embed_text("canine exercising outdoors")
        .await
        .unwrap()
        .unwrap();

    let sim = cosine_similarity(&e1, &e2);
    assert!(
        sim > 0.7,
        "OpenAI should recognize semantic similarity: {}",
        sim
    );
}

#[tokio::test]
async fn test_openai_provider_missing_key() {
    env::remove_var("OPENAI_API_KEY");
    env::set_var("FOREST_EMBED_PROVIDER", "openai");

    let result = EmbeddingService::new();
    assert!(
        result.is_err(),
        "OpenAI provider should fail without API key"
    );
}

// ============================================================================
// Cosine Similarity Tests
// ============================================================================

#[test]
fn test_cosine_similarity_identical() {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![1.0, 2.0, 3.0];

    let sim = cosine_similarity(&a, &b);
    assert!((sim - 1.0).abs() < 1e-10, "Identical vectors should have similarity 1.0");
}

#[test]
fn test_cosine_similarity_orthogonal() {
    let a = vec![1.0, 0.0, 0.0];
    let b = vec![0.0, 1.0, 0.0];

    let sim = cosine_similarity(&a, &b);
    assert!((sim - 0.0).abs() < 1e-10, "Orthogonal vectors should have similarity 0.0");
}

#[test]
fn test_cosine_similarity_opposite() {
    let a = vec![1.0, 0.0];
    let b = vec![-1.0, 0.0];

    let sim = cosine_similarity(&a, &b);
    assert!((sim - (-1.0)).abs() < 1e-10, "Opposite vectors should have similarity -1.0");
}

#[test]
fn test_cosine_similarity_different_lengths() {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![1.0, 2.0];

    let sim = cosine_similarity(&a, &b);
    assert_eq!(sim, 0.0, "Different length vectors should return 0.0");
}

#[test]
fn test_cosine_similarity_zero_vector() {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![0.0, 0.0, 0.0];

    let sim = cosine_similarity(&a, &b);
    assert_eq!(sim, 0.0, "Zero vector should return 0.0");
}

// ============================================================================
// Integration Tests
// ============================================================================

#[tokio::test]
async fn test_service_creation_with_fallback() {
    // Even with invalid provider, service should fallback to mock
    env::set_var("FOREST_EMBED_PROVIDER", "invalid-provider-name");
    let service = EmbeddingService::new().unwrap();

    let embedding = service
        .embed_text("test")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(embedding.len(), 384, "Fallback to mock should work");
}

#[tokio::test]
async fn test_multiple_embeddings_same_service() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = EmbeddingService::new().unwrap();

    let texts = vec![
        "First test text",
        "Second test text",
        "Third test text",
    ];

    for text in texts {
        let result = service.embed_text(text).await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 384);
    }
}

#[tokio::test]
async fn test_concurrent_embedding_requests() {
    env::set_var("FOREST_EMBED_PROVIDER", "mock");
    let service = std::sync::Arc::new(EmbeddingService::new().unwrap());

    let tasks: Vec<_> = (0..10)
        .map(|i| {
            let svc = service.clone();
            tokio::spawn(async move {
                let text = format!("Test text {}", i);
                svc.embed_text(&text).await.unwrap().unwrap()
            })
        })
        .collect();

    for task in tasks {
        let embedding = task.await.unwrap();
        assert_eq!(embedding.len(), 384);
    }
}
