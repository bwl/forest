//! Capture command - create new notes with auto-linking
//!
//! This is the most important CLI command - it creates nodes and automatically
//! links them into the graph using the hybrid scoring algorithm.

use anyhow::{Context, Result};
use tauri_plugin_cli::SubcommandMatches;
use forest_desktop::db::{Database, NewNode};
use forest_desktop::core::{text, linking};
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
        position_x: None,
        position_y: None,
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
        let link_result = linking::auto_link_node(&db, &node_record).await?;

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
