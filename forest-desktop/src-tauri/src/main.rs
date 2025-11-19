// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import the forest_desktop library
extern crate forest_desktop;

mod cli;
mod commands;

use tauri::Manager;

/// Main entry point for Forest Desktop
///
/// This application supports two modes:
/// 1. CLI mode: When invoked with subcommands (e.g., `forest stats`)
/// 2. GUI mode: When launched without arguments (opens the desktop UI)
///
/// The mode is determined by checking if CLI arguments contain a subcommand.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Build the Tauri application with all required plugins
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init());

    // Add DevTools in debug mode only
    #[cfg(debug_assertions)]
    {
        // Clean up stale MCP socket file if it exists
        let socket_path = std::path::Path::new("/tmp/tauri-mcp.sock");
        if socket_path.exists() {
            let _ = std::fs::remove_file(socket_path);
        }

        builder = builder
            .plugin(tauri_plugin_devtools::init())
            .plugin(tauri_plugin_mcp::init_with_config(
                tauri_plugin_mcp::PluginConfig::new("forest-desktop".to_string())
                    .start_socket_server(true)
                    .socket_path("/tmp/tauri-mcp.sock".into())
            ));
    }

    let app = builder
        .invoke_handler(tauri::generate_handler![
            commands::get_stats,
            commands::search_nodes,
            commands::get_node,
            commands::get_node_connections,
            commands::create_node,
            commands::get_edge_proposals,
            commands::accept_edge,
            commands::reject_edge,
            commands::get_graph_data,
            commands::update_node_position,
            commands::update_node,
            commands::create_node_quick,
            commands::log_to_terminal,
            commands::get_theme_preference,
            commands::set_theme_preference,
            forest_desktop::shell_integration::get_cli_install_info,
            forest_desktop::shell_integration::check_cli_in_path,
            forest_desktop::shell_integration::auto_install_cli_path,
        ])
        .setup(|app| {
            // Initialize Tauri-managed application state
            let state = forest_desktop::AppState::new()
                .expect("Failed to initialize app state");
            app.manage(state);

            // Window customization removed - using native decorations from tauri.conf.json
            // This gives us native title bar with rounded corners on macOS

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Get the app handle for CLI processing
    let app_handle = app.handle();

    // Try to handle CLI commands
    match cli::handle_cli(&app_handle).await {
        Ok(true) => {
            // CLI command was executed successfully - exit without starting GUI
            std::process::exit(0);
        }
        Ok(false) => {
            // No CLI command - continue to GUI mode
            // The window will be created automatically by Tauri
            app.run(|_app_handle, event| {
                if let tauri::RunEvent::ExitRequested { api, .. } = event {
                    // Allow the app to exit
                    api.prevent_exit();
                }
            });
        }
        Err(e) => {
            // CLI command failed
            eprintln!("Error: {:#}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}
