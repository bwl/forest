use anyhow::Result;
use tauri_plugin_cli::SubcommandMatches;

use forest_desktop::db::Database;

/// Handle the `stats` CLI command
///
/// Shows graph statistics including node count, edge count, and suggested edges.
/// This is a simplified implementation for Phase 1 - full stats logic migrates in Phase 3.
pub async fn handle_stats_command(matches: &SubcommandMatches) -> Result<()> {
    // Parse flags (Tauri v2 plugin-cli API: matches.matches.args)
    let json_output = matches.matches.args.get("json").map_or(false, |arg| arg.value.as_bool().unwrap_or(false));

    // top is reserved for Phase 3 when we implement full stats with tag/node rankings
    let _top = matches.matches.args.get("top")
        .and_then(|arg| arg.value.as_str())
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10);

    // Connect to database
    let db = Database::new().await?;
    let stats = db.get_stats().await?;
    db.close().await;

    // Output in requested format
    if json_output {
        // JSON output for scripting
        let output = serde_json::json!({
            "counts": {
                "nodes": stats.nodes,
                "edges": stats.edges,
                "suggested": stats.suggested
            },
            "degree": {
                "avg": 0.0,
                "median": 0,
                "p90": 0,
                "max": 0
            },
            "tags": [],
            "tagPairs": [],
            "recent": [],
            "highDegree": [],
            "topSuggestions": []
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        // Human-readable output (matches TypeScript CLI format)
        println!("forest stats");
        println!("Nodes: {}", stats.nodes);
        println!("Accepted edges: {}", stats.edges);
        println!("Suggested edges: {}", stats.suggested);
        println!();
        println!("Degree — avg 0.000  median 0  p90 0  max 0");
        println!();

        // Phase 1: Simplified output
        // Phase 3 will add: recent captures, high-degree nodes, top tags, top suggestions
        if stats.nodes == 0 {
            println!("(Database is empty - use `forest capture` to add nodes)");
        }
    }

    Ok(())
}
