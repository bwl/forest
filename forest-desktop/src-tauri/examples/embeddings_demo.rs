//! Embeddings Demo
//!
//! Demonstrates the embedding service in action with all providers.
//!
//! Run with:
//! ```bash
//! # Mock provider (default)
//! cargo run --example embeddings_demo
//!
//! # Local provider (downloads model on first run)
//! FOREST_EMBED_PROVIDER=local cargo run --example embeddings_demo
//!
//! # OpenAI provider (requires API key)
//! FOREST_EMBED_PROVIDER=openai OPENAI_API_KEY=sk-... cargo run --example embeddings_demo
//! ```

use forest_desktop::core::embeddings::{EmbeddingService, cosine_similarity};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("🌲 Forest Desktop - Embeddings Demo\n");

    // Create embedding service (reads FOREST_EMBED_PROVIDER)
    let service = EmbeddingService::new()?;
    let provider = service.provider();

    println!("📊 Provider: {:?}", provider);
    println!("📏 Expected dimension: {}\n", provider.dimension());

    // Test sentences
    let sentences = vec![
        "Machine learning and artificial intelligence",
        "Deep learning neural networks",
        "Cooking recipes and food preparation",
    ];

    println!("🔤 Embedding test sentences...\n");

    let mut embeddings = Vec::new();
    for sentence in &sentences {
        print!("  - \"{}\"", sentence);
        let start = std::time::Instant::now();
        let embedding = service.embed_text(sentence).await?;
        let duration = start.elapsed();

        if let Some(emb) = embedding {
            println!(" ✓ ({:.2?}, dim: {})", duration, emb.len());
            embeddings.push(emb);
        } else {
            println!(" ⊗ (None - embeddings disabled)");
        }
    }

    if embeddings.len() >= 3 {
        println!("\n🔗 Similarity Matrix:\n");
        println!("       | S1   | S2   | S3   |");
        println!("-------|------|------|------|");

        for (i, emb_i) in embeddings.iter().enumerate() {
            print!("  S{}  |", i + 1);
            for emb_j in &embeddings {
                let sim = cosine_similarity(emb_i, emb_j);
                print!(" {:.2} |", sim);
            }
            println!();
        }

        // Analyze relationships
        let sim_12 = cosine_similarity(&embeddings[0], &embeddings[1]);
        let sim_13 = cosine_similarity(&embeddings[0], &embeddings[2]);
        let sim_23 = cosine_similarity(&embeddings[1], &embeddings[2]);

        println!("\n📈 Analysis:");
        println!(
            "  ML ↔ DL:      {:.3} {}",
            sim_12,
            if sim_12 > 0.5 { "✓ Related" } else { "✗ Unrelated" }
        );
        println!(
            "  ML ↔ Cooking: {:.3} {}",
            sim_13,
            if sim_13 > 0.5 { "✓ Related" } else { "✗ Unrelated" }
        );
        println!(
            "  DL ↔ Cooking: {:.3} {}",
            sim_23,
            if sim_23 > 0.5 { "✓ Related" } else { "✗ Unrelated" }
        );

        println!("\n✓ Semantic understanding is working correctly!");
    }

    // Demo: Node embedding (title + body)
    println!("\n📝 Node Embedding Demo:\n");

    let title = "Rust Programming Language";
    let body = "Rust is a systems programming language focused on safety, speed, and concurrency.";

    print!("  Embedding node: \"{}\"...", title);
    let start = std::time::Instant::now();
    let node_emb = service.embed_node(title, body).await?;
    let duration = start.elapsed();

    if let Some(emb) = node_emb {
        println!(" ✓ ({:.2?}, dim: {})", duration, emb.len());

        // Compare with test sentences
        println!("\n  Similarity to test sentences:");
        for (i, test_emb) in embeddings.iter().enumerate() {
            let sim = cosine_similarity(&emb, test_emb);
            println!("    - S{}: {:.3}", i + 1, sim);
        }
    } else {
        println!(" ⊗ (None - embeddings disabled)");
    }

    println!("\n🎯 Demo complete!");
    Ok(())
}
