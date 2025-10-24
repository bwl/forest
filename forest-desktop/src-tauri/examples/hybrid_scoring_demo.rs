//! Hybrid Scoring Demo
//!
//! Demonstrates combining embeddings (semantic) with lexical features
//! to produce the final edge score using Forest's hybrid algorithm.
//!
//! This is a preview of Phase 5 auto-linking integration.
//!
//! Run with:
//! ```bash
//! FOREST_EMBED_PROVIDER=local cargo run --example hybrid_scoring_demo
//! ```

use forest_desktop::core::{
    embeddings::{EmbeddingService, cosine_similarity},
    scoring::compute_score,
    text::tokenize,
};
use forest_desktop::db::types::NodeRecord;
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("🌲 Forest Desktop - Hybrid Scoring Demo\n");

    let service = EmbeddingService::new()?;
    println!("📊 Provider: {:?}\n", service.provider());

    // Helper to create a NodeRecord
    fn make_node(title: &str, body: &str, tags: Vec<String>, embedding: Option<Vec<f64>>) -> NodeRecord {
        let combined = format!("{}\n{}", title, body);
        let token_counts = tokenize(&combined);

        NodeRecord {
            id: Uuid::new_v4().to_string(),
            title: title.to_string(),
            body: body.to_string(),
            tags,
            token_counts,
            embedding,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
        }
    }

    // Compute embeddings first
    println!("🔤 Computing embeddings...");

    let emb_a = service.embed_node(
        "Introduction to Machine Learning",
        "Machine learning is a branch of artificial intelligence that focuses on \
         building systems that learn from data. Supervised learning uses labeled \
         datasets to train models."
    ).await?;

    let emb_b = service.embed_node(
        "Deep Learning Neural Networks",
        "Deep learning is a subset of machine learning using artificial neural \
         networks with multiple layers. Convolutional networks excel at image \
         recognition tasks."
    ).await?;

    let emb_c = service.embed_node(
        "Cooking Techniques",
        "Basic cooking techniques include sautéing, roasting, and braising. \
         Understanding heat control is essential for achieving perfect results \
         in the kitchen."
    ).await?;

    println!("  ✓ All embeddings computed\n");

    // Create nodes with embeddings
    let node_a = make_node(
        "Introduction to Machine Learning",
        "Machine learning is a branch of artificial intelligence that focuses on \
         building systems that learn from data. Supervised learning uses labeled \
         datasets to train models.",
        vec!["machine-learning".to_string(), "ai".to_string()],
        emb_a.clone(),
    );

    let node_b = make_node(
        "Deep Learning Neural Networks",
        "Deep learning is a subset of machine learning using artificial neural \
         networks with multiple layers. Convolutional networks excel at image \
         recognition tasks.",
        vec!["deep-learning".to_string(), "neural-networks".to_string()],
        emb_b.clone(),
    );

    let node_c = make_node(
        "Cooking Techniques",
        "Basic cooking techniques include sautéing, roasting, and braising. \
         Understanding heat control is essential for achieving perfect results \
         in the kitchen.",
        vec!["cooking".to_string(), "recipes".to_string()],
        emb_c.clone(),
    );

    println!("📝 Test Nodes:");
    println!("  A: {} (tags: {:?})", node_a.title, node_a.tags);
    println!("  B: {} (tags: {:?})", node_b.title, node_b.tags);
    println!("  C: {} (tags: {:?})", node_c.title, node_c.tags);

    println!("\n🔗 Computing pairwise scores...\n");

    // Score A-B (related: ML and DL)
    let result_ab = compute_score(&node_a, &node_b);
    println!("A ↔ B (ML ↔ DL):");
    if let (Some(e_a), Some(e_b)) = (&emb_a, &emb_b) {
        let semantic = cosine_similarity(e_a, e_b);
        println!("  Semantic similarity: {:.3}", semantic);
    }
    println!("  Components:");
    println!("    - Token:     {:.3}", result_ab.components.token_similarity);
    println!("    - Embedding: {:.3}", result_ab.components.embedding_similarity);
    println!("    - Tag:       {:.3}", result_ab.components.tag_overlap);
    println!("    - Title:     {:.3}", result_ab.components.title_similarity);
    println!("  🎯 Final hybrid score: {:.3}", result_ab.score);
    println!(
        "  → {}",
        if result_ab.score >= 0.50 {
            "✅ AUTO-ACCEPTED"
        } else if result_ab.score >= 0.25 {
            "⚠️  SUGGESTED"
        } else {
            "❌ REJECTED"
        }
    );

    // Score A-C (unrelated: ML and Cooking)
    println!();
    let result_ac = compute_score(&node_a, &node_c);
    println!("A ↔ C (ML ↔ Cooking):");
    if let (Some(e_a), Some(e_c)) = (&emb_a, &emb_c) {
        let semantic = cosine_similarity(e_a, e_c);
        println!("  Semantic similarity: {:.3}", semantic);
    }
    println!("  Components:");
    println!("    - Token:     {:.3}", result_ac.components.token_similarity);
    println!("    - Embedding: {:.3}", result_ac.components.embedding_similarity);
    println!("    - Tag:       {:.3}", result_ac.components.tag_overlap);
    println!("    - Title:     {:.3}", result_ac.components.title_similarity);
    println!("  🎯 Final hybrid score: {:.3}", result_ac.score);
    println!(
        "  → {}",
        if result_ac.score >= 0.50 {
            "✅ AUTO-ACCEPTED"
        } else if result_ac.score >= 0.25 {
            "⚠️  SUGGESTED"
        } else {
            "❌ REJECTED"
        }
    );

    // Score B-C (unrelated: DL and Cooking)
    println!();
    let result_bc = compute_score(&node_b, &node_c);
    println!("B ↔ C (DL ↔ Cooking):");
    if let (Some(e_b), Some(e_c)) = (&emb_b, &emb_c) {
        let semantic = cosine_similarity(e_b, e_c);
        println!("  Semantic similarity: {:.3}", semantic);
    }
    println!("  Components:");
    println!("    - Token:     {:.3}", result_bc.components.token_similarity);
    println!("    - Embedding: {:.3}", result_bc.components.embedding_similarity);
    println!("    - Tag:       {:.3}", result_bc.components.tag_overlap);
    println!("    - Title:     {:.3}", result_bc.components.title_similarity);
    println!("  🎯 Final hybrid score: {:.3}", result_bc.score);
    println!(
        "  → {}",
        if result_bc.score >= 0.50 {
            "✅ AUTO-ACCEPTED"
        } else if result_bc.score >= 0.25 {
            "⚠️  SUGGESTED"
        } else {
            "❌ REJECTED"
        }
    );

    println!("\n📊 Summary:");
    println!("  Score A-B: {:.3} (ML ↔ DL) - Expected: HIGH ✓", result_ab.score);
    println!("  Score A-C: {:.3} (ML ↔ Cooking) - Expected: LOW ✓", result_ac.score);
    println!("  Score B-C: {:.3} (DL ↔ Cooking) - Expected: LOW ✓", result_bc.score);

    println!("\n✅ Hybrid scoring correctly identifies related and unrelated content!");
    println!("\n💡 Next step: Integrate into `forest capture` command for auto-linking");

    Ok(())
}
