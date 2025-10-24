//! Node commands - read, delete, and other node operations

use anyhow::Result;
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::Database;

/// Handle the `node` command group
///
/// Routes to subcommands: read, delete, edit, link
pub async fn handle_node_command(matches: &SubcommandMatches) -> Result<()> {
    match matches.matches.subcommand.as_ref().map(|s| s.name.as_str()) {
        Some("read") => handle_read(matches.matches.subcommand.as_ref().unwrap()).await,
        Some("delete") => handle_delete(matches.matches.subcommand.as_ref().unwrap()).await,
        _ => {
            eprintln!("Unknown node subcommand");
            eprintln!("Available: read, delete");
            std::process::exit(1);
        }
    }
}

/// Handle `node read` subcommand
///
/// Displays full node content including title, body, tags, and metadata.
async fn handle_read(matches: &SubcommandMatches) -> Result<()> {
    let id_ref = get_arg_value(matches, "id")
        .ok_or_else(|| anyhow::anyhow!("Node ID is required"))?;

    let db = Database::new().await?;

    // Get node (supports short ID prefix matching)
    let node = match db.get_node_by_id(&id_ref).await {
        Ok(n) => n,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };

    // Display node in human-readable format
    println!("\n{}", node.title);
    println!("{}", "=".repeat(node.title.len().min(80)));
    println!();
    println!("{}", node.body);
    println!();

    // Metadata section
    println!("---");
    println!("ID: {}", node.id);

    if !node.tags.is_empty() {
        println!("Tags: {}", node.tags.iter()
            .map(|t| format!("#{}", t))
            .collect::<Vec<_>>()
            .join(" "));
    }

    // Token count summary
    let total_tokens: i64 = node.token_counts.values().sum();
    let unique_tokens = node.token_counts.len();
    println!("Tokens: {} total, {} unique", total_tokens, unique_tokens);

    // Embedding status
    if let Some(emb) = &node.embedding {
        println!("Embedding: {} dimensions", emb.len());
    } else {
        println!("Embedding: none");
    }

    // Chunk info
    if node.is_chunk {
        println!("Chunk: true (order: {})", node.chunk_order.unwrap_or(0));
        if let Some(parent_id) = &node.parent_document_id {
            println!("Parent document: {}", format_short_id(parent_id));
        }
    }

    println!("Created: {}", node.created_at);
    println!("Updated: {}", node.updated_at);

    db.close().await;
    Ok(())
}

/// Handle `node delete` subcommand
///
/// Deletes a node and all associated edges. Prompts for confirmation unless --force is used.
async fn handle_delete(matches: &SubcommandMatches) -> Result<()> {
    let id_ref = get_arg_value(matches, "id")
        .ok_or_else(|| anyhow::anyhow!("Node ID is required"))?;

    let force = matches.matches.args.get("force").is_some();

    let db = Database::new().await?;

    // Get node to verify it exists and show info
    let node = match db.get_node_by_id(&id_ref).await {
        Ok(n) => n,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };

    // Confirm deletion unless --force
    if !force {
        println!("Delete node: {} ?", node.title);
        println!("ID: {}", format_short_id(&node.id));
        println!();
        println!("This will also delete all edges connected to this node.");
        println!("Type 'yes' to confirm:");

        use std::io::{self, BufRead};
        let stdin = io::stdin();
        let mut line = String::new();
        stdin.lock().read_line(&mut line)?;

        if line.trim() != "yes" {
            println!("Cancelled");
            return Ok(());
        }
    }

    // Delete node and edges
    let result = db.delete_node(&node.id).await?;

    println!("✓ Deleted node {}", format_short_id(&node.id));
    println!("  {} edges removed", result.edges_removed);

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
