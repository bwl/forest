//! Search command - semantic search using embeddings
//!
//! Computes query embedding and ranks all nodes by cosine similarity.

use anyhow::Result;
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::{Database, Pagination};
use forest_desktop::core::scoring;
use forest_desktop::EMBEDDING_SERVICE;

/// Handle the `search` CLI command
///
/// Workflow:
/// 1. Compute query embedding
/// 2. Load all nodes with embeddings
/// 3. Compute cosine similarity for each node
/// 4. Sort by similarity descending
/// 5. Display top N results
pub async fn handle_search_command(matches: &SubcommandMatches) -> Result<()> {
    // Parse arguments
    let query = get_arg_value(matches, "query")
        .ok_or_else(|| anyhow::anyhow!("Query is required"))?;

    let limit = get_arg_value(matches, "limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(20);

    println!("Searching for: \"{}\"", query);

    // Compute query embedding
    let query_embedding = EMBEDDING_SERVICE.embed_text(&query).await?;

    if query_embedding.is_none() {
        eprintln!("Warning: Embeddings are disabled (FOREST_EMBED_PROVIDER=none)");
        eprintln!("Semantic search requires embeddings. Use 'local', 'openai', or 'mock' provider.");
        std::process::exit(1);
    }

    let query_emb = query_embedding.unwrap();

    // Load all nodes
    let db = Database::new().await?;
    let all_nodes = db.list_nodes(Pagination { limit: 10000, offset: 0 }).await?;

    // Compute similarities
    let mut results: Vec<(&forest_desktop::db::NodeRecord, f64)> = all_nodes.iter()
        .filter_map(|node| {
            if let Some(node_emb) = &node.embedding {
                let similarity = scoring::cosine_embeddings(
                    Some(&query_emb),
                    Some(node_emb)
                );
                Some((node, similarity))
            } else {
                None
            }
        })
        .collect();

    // Sort by similarity descending
    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit);

    // Display results
    if results.is_empty() {
        println!("No results found");
    } else {
        println!("\nResults:\n");
        for (i, (node, similarity)) in results.iter().enumerate() {
            let sim_pct = similarity * 100.0;

            // Show position, ID, title, and similarity
            println!("{}. {} - {}", i + 1, format_short_id(&node.id), node.title);
            println!("   Similarity: {:.1}%", sim_pct);

            // Show tags if present
            if !node.tags.is_empty() {
                println!("   Tags: {}", node.tags.iter()
                    .map(|t| format!("#{}", t))
                    .collect::<Vec<_>>()
                    .join(" "));
            }

            println!();
        }

        println!("Showing {} of {} results with embeddings",
            results.len(),
            all_nodes.iter().filter(|n| n.embedding.is_some()).count()
        );
    }

    db.close().await;
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
