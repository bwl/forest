// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import the forest_desktop library
extern crate forest_desktop;

mod cli;
mod commands;

use tauri::{window::Color, Manager};

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
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(true);
                let _ = window.set_background_color(Some(Color::from_rgba(0, 0, 0, 0)));

                #[cfg(target_os = "macos")]
                {
                    use tauri::TitleBarStyle;
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                    let _ = window.set_full_size_content_view(true);
                }

                #[cfg(target_os = "windows")]
                {
                    use tauri::window::effects::EffectsBuilder;
                    let acrylic = EffectsBuilder::new().acrylic().color((24, 32, 48, 200)).build();
                    if let Ok(effects) = acrylic {
                        let _ = window.apply_effects(effects);
                    } else {
                        let mica = EffectsBuilder::new().mica().build();
                        if let Ok(effect) = mica {
                            let _ = window.apply_effects(effect);
                        }
                    }
                }
            }

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
