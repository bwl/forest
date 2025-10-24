// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import the forest_desktop library
extern crate forest_desktop;

mod cli;
mod commands;

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
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_stats,
            commands::search_nodes,
        ])
        .setup(|_app| {
            // Setup hook - will be called before the main event loop starts
            // We need to determine mode here to prevent window creation in CLI mode
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
