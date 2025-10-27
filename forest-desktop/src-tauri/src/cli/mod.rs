use anyhow::Result;
use tauri_plugin_cli::CliExt;

mod stats;
mod capture;
mod search;
mod node;
mod health;
mod edges;

/// CLI command router
///
/// Parses CLI arguments and dispatches to appropriate command handlers.
/// Returns Ok(true) if a CLI command was executed, Ok(false) if GUI mode should start.
pub async fn handle_cli(app: &tauri::AppHandle) -> Result<bool> {
    // Get CLI matches from tauri-plugin-cli
    let cli_matches = app.cli().matches()?;

    // Check if any subcommand was invoked
    if let Some(subcommand) = cli_matches.subcommand {
        match subcommand.name.as_str() {
            "stats" => {
                stats::handle_stats_command(&subcommand).await?;
                return Ok(true);
            }
            "capture" => {
                capture::handle_capture_command(&subcommand).await?;
                return Ok(true);
            }
            "search" => {
                search::handle_search_command(&subcommand).await?;
                return Ok(true);
            }
            "node" => {
                node::handle_node_command(&subcommand).await?;
                return Ok(true);
            }
            "health" => {
                health::handle_health_command(&subcommand).await?;
                return Ok(true);
            }
            "edges" => {
                edges::handle_edges_command(&subcommand).await?;
                return Ok(true);
            }
            _ => {
                eprintln!("Unknown command: {}", subcommand.name);
                std::process::exit(1);
            }
        }
    }

    // No subcommand means GUI mode
    Ok(false)
}
