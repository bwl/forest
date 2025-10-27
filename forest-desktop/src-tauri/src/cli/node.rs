//! Node commands - read, delete, edit, link

use anyhow::{Context, Result};
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::{Database, EdgeStatus, EdgeType};
use forest_desktop::core::scoring;

/// Handle the `node` command group
///
/// Routes to subcommands: read, delete, edit, link
pub async fn handle_node_command(matches: &SubcommandMatches) -> Result<()> {
    match matches.matches.subcommand.as_ref().map(|s| s.name.as_str()) {
        Some("read") => handle_read(matches.matches.subcommand.as_ref().unwrap()).await,
        Some("delete") => handle_delete(matches.matches.subcommand.as_ref().unwrap()).await,
        Some("edit") => handle_edit(matches.matches.subcommand.as_ref().unwrap()).await,
        Some("link") => handle_link(matches.matches.subcommand.as_ref().unwrap()).await,
        _ => {
            eprintln!("Unknown node subcommand");
            eprintln!("Available: read, delete, edit, link");
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

/// Handle `node edit` subcommand
///
/// Opens node in $EDITOR, parses changes, and updates the node
async fn handle_edit(matches: &SubcommandMatches) -> Result<()> {
    let id_ref = get_arg_value(matches, "id")
        .ok_or_else(|| anyhow::anyhow!("Node ID is required"))?;

    let db = Database::new().await?;

    // Get node
    let node = db.get_node_by_id(&id_ref).await
        .context("Node not found")?;

    // Create temp file with content
    let temp_file = format!("/tmp/forest-edit-{}.md", &node.id[..8]);
    let content = format!("# {}\n\n{}", node.title, node.body);
    tokio::fs::write(&temp_file, content).await
        .context("Failed to write temp file")?;

    // Open in editor
    let editor = std::env::var("EDITOR").unwrap_or_else(|_| "vim".to_string());
    let status = std::process::Command::new(&editor)
        .arg(&temp_file)
        .status()
        .context("Failed to launch editor")?;

    if !status.success() {
        let _ = tokio::fs::remove_file(&temp_file).await;
        return Err(anyhow::anyhow!("Editor exited with non-zero status"));
    }

    // Read back and parse
    let edited = tokio::fs::read_to_string(&temp_file).await
        .context("Failed to read edited file")?;

    let lines: Vec<&str> = edited.lines().collect();
    let new_title = lines.first()
        .map(|l| l.trim_start_matches('#').trim())
        .filter(|s| !s.is_empty())
        .unwrap_or(&node.title)
        .to_string();

    // Body starts after first non-empty line following title
    let body_start = lines.iter()
        .skip(1)
        .position(|l| !l.trim().is_empty())
        .map(|pos| pos + 2) // +1 for skip(1), +1 for the line itself
        .unwrap_or(2);

    let new_body = lines.iter()
        .skip(body_start)
        .map(|s| *s)
        .collect::<Vec<_>>()
        .join("\n");

    // Update node using UpdateNode struct
    use forest_desktop::db::UpdateNode;
    use forest_desktop::core::text::{extract_tags, tokenize};
    use forest_desktop::EMBEDDING_SERVICE;

    // Re-tokenize and extract tags from updated content
    let full_text = format!("{} {}", new_title, new_body);
    let token_counts = tokenize(&full_text);
    let tags = extract_tags(&full_text, Some(&token_counts), 10);

    // Re-embed the content
    let embedding = EMBEDDING_SERVICE.embed_text(&full_text).await?;

    let update = UpdateNode {
        title: Some(new_title),
        body: Some(new_body),
        tags: Some(tags),
        token_counts: Some(token_counts),
        embedding,  // Already Option<Vec<f64>>
    };

    db.update_node(&node.id, update).await?;

    println!("✓ Node {} updated", format_short_id(&node.id));

    // Cleanup
    let _ = tokio::fs::remove_file(&temp_file).await;
    db.close().await;
    Ok(())
}

/// Handle `node link` subcommand
///
/// Manually creates an edge between two nodes with computed score
async fn handle_link(matches: &SubcommandMatches) -> Result<()> {
    let id1 = get_arg_value(matches, "id1")
        .ok_or_else(|| anyhow::anyhow!("First node ID required"))?;
    let id2 = get_arg_value(matches, "id2")
        .ok_or_else(|| anyhow::anyhow!("Second node ID required"))?;

    let db = Database::new().await?;

    // Verify both nodes exist
    let node1 = db.get_node_by_id(&id1).await
        .context("First node not found")?;
    let node2 = db.get_node_by_id(&id2).await
        .context("Second node not found")?;

    // Compute score
    let score_result = scoring::compute_score(&node1, &node2);

    // Normalize edge pair
    let (source, target) = scoring::normalize_edge_pair(&node1.id, &node2.id);

    // Create edge using NewEdge
    use forest_desktop::db::NewEdge;

    let edge = NewEdge {
        source_id: source.clone(),
        target_id: target.clone(),
        score: score_result.score,
        status: EdgeStatus::Accepted,
        edge_type: EdgeType::Manual,
        metadata: None,
    };

    db.upsert_edge(edge).await?;

    println!("✓ Linked {} ↔ {} (score: {:.2})",
        format_short_id(&source),
        format_short_id(&target),
        score_result.score
    );

    db.close().await;
    Ok(())
}

/// Format node ID as short prefix (first 8 chars)
fn format_short_id(id: &str) -> String {
    if id.len() >= 8 {
        id[..8].to_string()
    } else {
        id.to_string()
    }
}
