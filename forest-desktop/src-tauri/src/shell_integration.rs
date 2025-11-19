use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the directory containing the bundled forest CLI binary
pub fn get_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // On macOS, the binary is in Contents/MacOS/
    #[cfg(target_os = "macos")]
    let bin_dir = resource_dir.parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("MacOS"))
        .ok_or("Failed to locate MacOS directory")?;

    #[cfg(not(target_os = "macos"))]
    let bin_dir = resource_dir.clone();

    Ok(bin_dir)
}

/// Get the full path to the forest CLI binary
pub fn get_cli_path(app: &AppHandle) -> Result<PathBuf, String> {
    let bin_dir = get_bin_dir(app)?;
    let cli_path = bin_dir.join("forest");

    if !cli_path.exists() {
        return Err(format!("CLI binary not found at: {:?}", cli_path));
    }

    Ok(cli_path)
}

/// Resolve the app resources directory
pub fn get_resource_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))
}

/// Generate shell integration instructions
pub fn get_shell_integration_instructions(bin_dir: &PathBuf, resource_dir: &PathBuf) -> String {
    let bin_dir_str = bin_dir.to_string_lossy();
    // Locate completions directory inside Resources. Try common layouts in order:
    // 1) Resources/completions (ideal)
    // 2) Resources/resources/completions (when `resources/completions` is declared in tauri.conf)
    // 3) Fallback to Resources/
    let candidates = [
        resource_dir.join("completions"),
        resource_dir.join("resources").join("completions"),
    ];
    let mut completions_dir = resource_dir.clone();
    for cand in candidates.iter() {
        if cand.exists() {
            completions_dir = cand.clone();
            break;
        }
    }
    let completions_dir_str = completions_dir.to_string_lossy();

    format!(
        r#"# Forest CLI Installation

To make the `forest` command available in your terminal, add it to your PATH:

## Bash (~/.bashrc or ~/.bash_profile)
```bash
export PATH="$PATH:{}"
```

## Zsh (~/.zshrc)
```bash
export PATH="$PATH:{}"
```

## Fish (~/.config/fish/config.fish)
```fish
set -gx PATH $PATH {}
```

After adding this line, restart your terminal or run:
```bash
source ~/.zshrc  # or ~/.bashrc for Bash
```

## Shell Completions

Forest includes shell completion scripts. To install them:

```bash
# Bash
echo 'source {}/forest.bash' >> ~/.bashrc

# Zsh
echo 'source {}/forest.zsh' >> ~/.zshrc

# Fish
cp {}/*.fish ~/.config/fish/completions/
```
"#,
        bin_dir_str,
        bin_dir_str,
        bin_dir_str,
        completions_dir_str,
        completions_dir_str,
        completions_dir_str
    )
}

/// Tauri command to get CLI installation instructions
#[tauri::command]
pub fn get_cli_install_info(app: AppHandle) -> Result<CliInstallInfo, String> {
    let bin_dir = get_bin_dir(&app)?;
    let cli_path = get_cli_path(&app)?;
    let resource_dir = get_resource_dir(&app)?;
    let instructions = get_shell_integration_instructions(&bin_dir, &resource_dir);

    Ok(CliInstallInfo {
        cli_path: cli_path.to_string_lossy().to_string(),
        bin_dir: bin_dir.to_string_lossy().to_string(),
        instructions,
    })
}

/// Check if the forest CLI is already in the user's PATH
#[tauri::command]
pub fn check_cli_in_path() -> bool {
    if let Ok(path_var) = env::var("PATH") {
        // Try to find 'forest' in PATH
        for path in env::split_paths(&path_var) {
            let forest_path = path.join("forest");
            if forest_path.exists() {
                return true;
            }
        }
    }
    false
}

/// Information about CLI installation
#[derive(serde::Serialize)]
pub struct CliInstallInfo {
    pub cli_path: String,
    pub bin_dir: String,
    pub instructions: String,
}

/// Auto-install CLI to shell RC files (with user confirmation)
#[tauri::command]
pub fn auto_install_cli_path(app: AppHandle, shell: String) -> Result<String, String> {
    let bin_dir = get_bin_dir(&app)?;
    let bin_dir_str = bin_dir.to_string_lossy();

    let home = env::var("HOME").map_err(|_| "HOME environment variable not set")?;

    let (rc_file, export_line) = match shell.as_str() {
        "zsh" => (
            PathBuf::from(&home).join(".zshrc"),
            format!("export PATH=\"$PATH:{}\"", bin_dir_str),
        ),
        "bash" => (
            PathBuf::from(&home).join(".bashrc"),
            format!("export PATH=\"$PATH:{}\"", bin_dir_str),
        ),
        "fish" => (
            PathBuf::from(&home).join(".config/fish/config.fish"),
            format!("set -gx PATH $PATH {}", bin_dir_str),
        ),
        _ => return Err(format!("Unsupported shell: {}", shell)),
    };

    // Check if already added
    if rc_file.exists() {
        let content = fs::read_to_string(&rc_file)
            .map_err(|e| format!("Failed to read {}: {}", rc_file.display(), e))?;

        if content.contains(&bin_dir_str.to_string()) {
            return Ok(format!("PATH already contains Forest CLI directory in {}", rc_file.display()));
        }
    }

    // Append the export line
    let comment = format!("\n# Added by Forest Desktop\n{}\n", export_line);
    fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&rc_file)
        .and_then(|mut file| {
            use std::io::Write;
            file.write_all(comment.as_bytes())
        })
        .map_err(|e| format!("Failed to update {}: {}", rc_file.display(), e))?;

    Ok(format!(
        "✓ Added Forest CLI to PATH in {}\nRestart your terminal or run: source {}",
        rc_file.display(),
        rc_file.display()
    ))
}
