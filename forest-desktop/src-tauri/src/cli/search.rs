//! Search command - semantic search using embeddings
//!
//! Computes query embedding and ranks all nodes by cosine similarity.

use anyhow::Result;
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::Database;
use forest_desktop::core::search;
use forest_desktop::EMBEDDING_SERVICE;

/// Handle the `search` CLI command
///
/// Workflow:
/// 1. Parse arguments
/// 2. Check if embeddings are enabled
/// 3. Perform semantic search using core module
/// 4. Display results
pub async fn handle_search_command(matches: &SubcommandMatches) -> Result<()> {
    // Parse arguments
    let query = get_arg_value(matches, "query")
        .ok_or_else(|| anyhow::anyhow!("Query is required"))?;

    let limit = get_arg_value(matches, "limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(20);

    println!("Searching for: \"{}\"", query);

    // Check if embeddings are enabled
    let test_embedding = EMBEDDING_SERVICE.embed_text("test").await?;
    if test_embedding.is_none() {
        eprintln!("Warning: Embeddings are disabled (FOREST_EMBED_PROVIDER=none)");
        eprintln!("Semantic search requires embeddings. Use 'local', 'openai', or 'mock' provider.");
        std::process::exit(1);
    }

    // Perform semantic search using core module
    let db = Database::new().await?;
    let results = search::semantic_search(&db, &query, limit).await?;
    let total_with_embeddings = db.list_nodes(forest_desktop::db::Pagination {
        limit: 10000,
        offset: 0
    }).await?
        .iter()
        .filter(|n| n.embedding.is_some())
        .count();
    db.close().await;

    // Display results
    if results.is_empty() {
        println!("No results found");
    } else {
        println!("\nResults:\n");
        for (i, result) in results.iter().enumerate() {
            let sim_pct = result.similarity * 100.0;

            // Show position, ID, title, and similarity
            println!("{}. {} - {}", i + 1, format_short_id(&result.node.id), result.node.title);
            println!("   Similarity: {:.1}%", sim_pct);

            // Show tags if present
            if !result.node.tags.is_empty() {
                println!("   Tags: {}", result.node.tags.iter()
                    .map(|t| format!("#{}", t))
                    .collect::<Vec<_>>()
                    .join(" "));
            }

            println!();
        }

        println!("Showing {} of {} results with embeddings",
            results.len(),
            total_with_embeddings
        );
    }

    Ok(())
}

/// Extract string argument value from matches
fn get_arg_value(matches: &SubcommandMatches, name: &str) -> Option<String> {
    matches.matches.args.get(name)
        .and_then(|arg| arg.value.as_str().map(|s| s.to_string()))
}

/// Format node ID as short prefix (first 8 chars)
fn format_short_id(id: &str) -> String {
    if id.len() >= 8 {
        id[..8].to_string()
    } else {
        id.to_string()
    }
}
