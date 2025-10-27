//! Edge management commands

use anyhow::{Context, Result};
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::{Database, EdgeStatus, EdgeFilters, Pagination};

/// Handle the `edges` command group
///
/// Routes to subcommands: propose, accept, reject
/// Default (no subcommand): list recent accepted edges
pub async fn handle_edges_command(matches: &SubcommandMatches) -> Result<()> {
    // Check if there's a subcommand
    if let Some(subcommand) = &matches.matches.subcommand {
        match subcommand.name.as_str() {
            "propose" => handle_propose_subcommand(&subcommand).await?,
            "accept" => handle_accept_subcommand(&subcommand).await?,
            "reject" => handle_reject_subcommand(&subcommand).await?,
            _ => {
                eprintln!("Unknown edges subcommand: {}", subcommand.name);
                eprintln!("Available: propose, accept, reject");
                std::process::exit(1);
            }
        }
    } else {
        // No subcommand - list recent accepted edges
        handle_list_edges().await?;
    }
    Ok(())
}

/// List recent accepted edges
async fn handle_list_edges() -> Result<()> {
    let db = Database::new().await?;
    let edges = db.list_edges(
        EdgeFilters {
            status: Some(EdgeStatus::Accepted),
            ..Default::default()
        },
        Pagination { limit: 20, offset: 0 }
    ).await?;

    if edges.is_empty() {
        println!("No connections yet. Use 'capture' to create notes and auto-link them.");
        db.close().await;
        return Ok(());
    }

    println!("Recent connections:\n");

    for edge in edges {
        let source = db.get_node_by_id(&edge.source_id).await
            .context("Failed to load source node")?;
        let target = db.get_node_by_id(&edge.target_id).await
            .context("Failed to load target node")?;

        println!("  {} ↔ {}",
            source.title,
            target.title
        );
        println!("    Score: {:.2} | Type: {:?}", edge.score, edge.edge_type);
        println!();
    }

    db.close().await;
    Ok(())
}

/// Handle `edges propose` subcommand
///
/// Lists suggested edges that haven't been accepted or rejected
async fn handle_propose_subcommand(_matches: &SubcommandMatches) -> Result<()> {
    let db = Database::new().await?;
    let suggestions = db.list_edges(
        EdgeFilters {
            status: Some(EdgeStatus::Suggested),
            ..Default::default()
        },
        Pagination { limit: 20, offset: 0 }
    ).await?;

    if suggestions.is_empty() {
        println!("No suggestions. All edges have been reviewed!");
        db.close().await;
        return Ok(());
    }

    println!("Edge proposals:\n");

    for edge in suggestions.iter() {
        let source = db.get_node_by_id(&edge.source_id).await
            .context("Failed to load source node")?;
        let target = db.get_node_by_id(&edge.target_id).await
            .context("Failed to load target node")?;

        let edge_ref = format_short_id(&edge.id);

        println!("  [{}] {} ↔ {}",
            edge_ref,
            source.title,
            target.title
        );
        println!("      Score: {:.2}", edge.score);
        println!();
    }

    println!("Use 'edges accept <id>' or 'edges reject <id>' to review.");

    db.close().await;
    Ok(())
}

/// Handle `edges accept` subcommand
///
/// Accepts a suggested edge, making it part of the graph
async fn handle_accept_subcommand(matches: &SubcommandMatches) -> Result<()> {
    let edge_id = get_arg_value(matches, "id")
        .ok_or_else(|| anyhow::anyhow!("Edge ID required"))?;

    let db = Database::new().await?;

    // Resolve short ID if needed
    let full_id = resolve_edge_id(&db, &edge_id).await?;

    // Update edge status directly via SQL
    let query = r#"
        UPDATE edges
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
    "#;

    sqlx::query(query)
        .bind(EdgeStatus::Accepted.as_str())
        .bind(&full_id)
        .execute(db.pool())
        .await
        .context("Failed to update edge status")?;

    println!("✓ Edge {} accepted", format_short_id(&full_id));

    db.close().await;
    Ok(())
}

/// Handle `edges reject` subcommand
///
/// Rejects a suggested edge, removing it from the database
async fn handle_reject_subcommand(matches: &SubcommandMatches) -> Result<()> {
    let edge_id = get_arg_value(matches, "id")
        .ok_or_else(|| anyhow::anyhow!("Edge ID required"))?;

    let db = Database::new().await?;

    // Resolve short ID if needed
    let full_id = resolve_edge_id(&db, &edge_id).await?;

    // Get edge to find source/target IDs
    let edge = db.get_edge_by_id(&full_id).await
        .context("Edge not found")?;

    // Delete the edge (rejected edges are not kept)
    db.delete_edge(&edge.source_id, &edge.target_id).await?;

    println!("✓ Edge {} rejected", format_short_id(&full_id));

    db.close().await;
    Ok(())
}

/// Resolve a short edge ID to full UUID
///
/// Supports both short (8-char) and full UUIDs
async fn resolve_edge_id(db: &Database, id_ref: &str) -> Result<String> {
    // If it looks like a full UUID, use it directly
    if id_ref.len() == 36 && id_ref.contains('-') {
        return Ok(id_ref.to_string());
    }

    // Otherwise, search for a matching prefix in suggested edges
    let suggestions = db.list_edges(
        EdgeFilters {
            status: Some(EdgeStatus::Suggested),
            ..Default::default()
        },
        Pagination { limit: 100, offset: 0 }
    ).await?;

    let matches: Vec<_> = suggestions.iter()
        .filter(|e| e.id.starts_with(id_ref))
        .collect();

    match matches.len() {
        0 => Err(anyhow::anyhow!("No edge found matching '{}'", id_ref)),
        1 => Ok(matches[0].id.clone()),
        _ => {
            eprintln!("Ambiguous edge ID '{}' matches {} edges:", id_ref, matches.len());
            for edge in matches.iter().take(5) {
                eprintln!("  {}", edge.id);
            }
            Err(anyhow::anyhow!("Use a longer prefix to disambiguate"))
        }
    }
}

/// Extract string argument value from matches
fn get_arg_value(matches: &SubcommandMatches, name: &str) -> Option<String> {
    matches.matches.args.get(name)
        .and_then(|arg| arg.value.as_str().map(|s| s.to_string()))
}

/// Format ID as short prefix (first 8 chars)
fn format_short_id(id: &str) -> String {
    if id.len() >= 8 {
        id[..8].to_string()
    } else {
        id.to_string()
    }
}
