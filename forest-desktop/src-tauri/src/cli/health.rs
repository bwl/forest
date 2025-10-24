//! Health check command - verify system is working correctly

use anyhow::Result;
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::Database;
use forest_desktop::EMBEDDING_SERVICE;

/// Handle the `health` command
///
/// Performs system health checks:
/// - Database connectivity and basic stats
/// - Embedding service availability
pub async fn handle_health_command(_matches: &SubcommandMatches) -> Result<()> {
    println!("🌲 Forest Desktop Health Check\n");

    // Check 1: Database connectivity
    print!("Database connection... ");
    match Database::new().await {
        Ok(db) => {
            let stats = db.get_stats().await?;
            println!("✓ OK ({} nodes, {} edges)", stats.nodes, stats.edges);
            db.close().await;
        }
        Err(e) => {
            println!("✗ FAILED: {}", e);
            return Err(e);
        }
    }

    // Check 2: Embedding service
    print!("Embedding service... ");
    match EMBEDDING_SERVICE.embed_text("test").await {
        Ok(Some(embedding)) => {
            println!("✓ OK ({}-dimensional vectors)", embedding.len());
        }
        Ok(None) => {
            println!("✓ OK (embeddings disabled)");
        }
        Err(e) => {
            println!("✗ FAILED: {}", e);
            return Err(e);
        }
    }

    println!("\n✅ All systems operational");
    Ok(())
}
