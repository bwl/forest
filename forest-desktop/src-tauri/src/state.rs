use crate::db::Database;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// User configuration stored in settings.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_theme_preference")]
    pub theme_preference: String, // "system", "light", or "dark"
}

fn default_theme_preference() -> String {
    "system".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            theme_preference: default_theme_preference(),
        }
    }
}

/// Application state managed by Tauri
///
/// This state is shared across all Tauri commands.
pub struct AppState {
    config: Arc<RwLock<Config>>,
    config_path: PathBuf,
}

impl AppState {
    /// Create a new AppState instance with config loaded from disk
    pub fn new() -> Result<Self> {
        let config_path = Self::get_config_path()?;
        let config = Self::load_config_from_disk(&config_path)?;

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
        })
    }

    /// Get the path to the config file
    fn get_config_path() -> Result<PathBuf> {
        // Use directories crate to get app data dir (cross-platform)
        let app_data = dirs::data_dir()
            .context("Failed to get app data directory")?
            .join("com.ettio.forest.desktop");
        Ok(app_data.join("settings.json"))
    }

    /// Load config from disk, or create default if not found
    fn load_config_from_disk(path: &PathBuf) -> Result<Config> {
        if path.exists() {
            let contents = std::fs::read_to_string(path)
                .context("Failed to read config file")?;
            let config: Config = serde_json::from_str(&contents)
                .context("Failed to parse config file")?;
            Ok(config)
        } else {
            // Create default config and save it
            let config = Config::default();
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)
                    .context("Failed to create config directory")?;
            }
            let json = serde_json::to_string_pretty(&config)
                .context("Failed to serialize default config")?;
            std::fs::write(path, json)
                .context("Failed to write default config")?;
            Ok(config)
        }
    }

    /// Get a copy of the current config
    pub async fn get_config(&self) -> Config {
        self.config.read().await.clone()
    }

    /// Update and persist the config
    pub async fn update_config<F>(&self, updater: F) -> Result<()>
    where
        F: FnOnce(&mut Config),
    {
        let mut config = self.config.write().await;
        updater(&mut config);

        // Persist to disk
        let json = serde_json::to_string_pretty(&*config)
            .context("Failed to serialize config")?;

        // Use blocking task to avoid blocking the async runtime
        let config_path = self.config_path.clone();
        tokio::task::spawn_blocking(move || {
            std::fs::write(&config_path, json)
                .context("Failed to write config file")
        })
        .await
        .context("Task join error")??;

        Ok(())
    }

    /// Create a new database connection
    ///
    /// Each command gets a fresh connection for now.
    /// This is safe and simple, with room for optimization later via connection pooling.
    pub async fn get_db(&self) -> Result<Database> {
        Database::new().await
    }
}
