//! Capture command - create new notes with auto-linking
//!
//! This is the most important CLI command - it creates nodes and automatically
//! links them into the graph using the hybrid scoring algorithm.

use anyhow::{Context, Result};
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::{Database, NewNode, NewEdge, EdgeType, Pagination};
use forest_desktop::core::{text, scoring};
use forest_desktop::EMBEDDING_SERVICE;

/// Handle the `capture` CLI command
///
/// Creates a new node with:
/// 1. Text processing (tokenization, tag extraction)
/// 2. Embedding generation
/// 3. Database insertion
/// 4. Auto-linking against existing nodes
pub async fn handle_capture_command(matches: &SubcommandMatches) -> Result<()> {
    // Parse input arguments
    let title_arg = get_arg_value(matches, "title");
    let body = get_body_input(matches).await?;
    let tags_arg = get_arg_value(matches, "tags");

    // Determine auto-link flag (default: true, unless --no-auto-link is set)
    let auto_link = !matches.matches.args.get("no-auto-link")
        .map_or(false, |arg| arg.value.as_bool().unwrap_or(true));

    // Process text: pick title if not provided
    let title = if let Some(t) = title_arg {
        t
    } else {
        text::pick_title(&body, None)
    };

    // Tokenize body
    let token_counts = text::tokenize(&body);

    // Extract or parse tags
    let tags = if let Some(tags_str) = tags_arg {
        // User provided tags - split by comma
        tags_str.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        // Auto-extract tags using lexical analysis
        let full_text = format!("{}\n{}", title, body);
        text::extract_tags(&full_text, Some(&token_counts), 5)
    };

    // Compute embedding
    println!("Computing embedding...");
    let embedding = EMBEDDING_SERVICE.embed_node(&title, &body).await?;

    // Insert node into database
    let db = Database::new().await?;
    let new_node = NewNode {
        title: title.clone(),
        body: body.clone(),
        tags: tags.clone(),
        token_counts: token_counts.clone(),
        embedding: embedding.clone(),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node_record = db.insert_node(new_node).await?;
    let node_id = &node_record.id;

    println!("✓ Created node {}", format_short_id(node_id));
    println!("  Title: {}", title);
    if !tags.is_empty() {
        println!("  Tags: {}", tags.iter()
            .map(|t| format!("#{}", t))
            .collect::<Vec<_>>()
            .join(" "));
    }

    // Auto-link if enabled
    if auto_link {
        println!("\nAuto-linking...");
        let link_result = auto_link_node(&db, &node_record).await?;

        if link_result.accepted > 0 || link_result.suggested > 0 {
            println!("  {} accepted, {} suggested",
                link_result.accepted, link_result.suggested);
        } else {
            println!("  No strong connections found");
        }
    }

    db.close().await;
    Ok(())
}

/// Auto-linking logic: score new node against all existing nodes
///
/// Creates edges based on score classification:
/// - score >= 0.5: accepted (auto-created)
/// - 0.25 <= score < 0.5: suggested (for review)
/// - score < 0.25: discarded (not stored)
async fn auto_link_node(db: &Database, new_node: &forest_desktop::db::NodeRecord) -> Result<LinkingResult> {
    let mut accepted = 0;
    let mut suggested = 0;

    // Get all existing nodes (except the one we just created)
    let all_nodes = db.list_nodes(Pagination { limit: 10000, offset: 0 }).await?;

    for other in all_nodes {
        if other.id == new_node.id {
            continue;
        }

        // Compute hybrid score
        let score_result = scoring::compute_score(new_node, &other);
        let classification = scoring::classify_score(score_result.score);

        // Convert classification to edge status
        let status = match scoring::classification_to_status(classification) {
            Some(s) => s,
            None => continue, // Discard - don't store
        };

        // Normalize edge pair (sourceId < targetId)
        let (source, target) = scoring::normalize_edge_pair(&new_node.id, &other.id);

        // Create edge
        let new_edge = NewEdge {
            source_id: source,
            target_id: target,
            score: score_result.score,
            status,
            edge_type: EdgeType::Semantic,
            metadata: None,
        };

        db.upsert_edge(new_edge).await?;

        // Track counts
        match status {
            forest_desktop::db::EdgeStatus::Accepted => accepted += 1,
            forest_desktop::db::EdgeStatus::Suggested => suggested += 1,
        }
    }

    Ok(LinkingResult { accepted, suggested })
}

/// Result of auto-linking operation
struct LinkingResult {
    accepted: usize,
    suggested: usize,
}

/// Get body input from --body, --file, or --stdin (priority order)
async fn get_body_input(matches: &SubcommandMatches) -> Result<String> {
    // Priority: --body > --file > --stdin
    if let Some(body) = get_arg_value(matches, "body") {
        return Ok(body);
    }

    if let Some(file_path) = get_arg_value(matches, "file") {
        return tokio::fs::read_to_string(&file_path)
            .await
            .with_context(|| format!("Failed to read file: {}", file_path));
    }

    if matches.matches.args.get("stdin").is_some() {
        use tokio::io::{AsyncReadExt, stdin};
        let mut buffer = String::new();
        stdin().read_to_string(&mut buffer).await
            .context("Failed to read from stdin")?;
        return Ok(buffer);
    }

    Err(anyhow::anyhow!(
        "No body provided. Use --body, --file, or --stdin"
    ))
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
