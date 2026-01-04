//! forest-embed - Lightweight embedding helper for Forest CLI
//!
//! This binary provides semantic embeddings using fastembed, enabling
//! the TypeScript CLI to use the same embedding engine as the desktop app.
//!
//! Usage:
//!   forest-embed <text>           - Embed text from argument
//!   echo "text" | forest-embed    - Embed text from stdin
//!
//! Output: JSON array of embedding values

use anyhow::{Context, Result};
use fastembed::TextEmbedding;
use std::io::{self, Read};

fn main() -> Result<()> {
    // Get input text from args or stdin
    let text = get_input_text()?;

    if text.trim().is_empty() {
        anyhow::bail!("Error: No input text provided");
    }

    // Initialize embedding model (all-MiniLM-L6-v2, 384-dim)
    let model = TextEmbedding::try_new(Default::default())
        .context("Failed to initialize embedding model")?;

    // Generate embedding
    let embeddings = model
        .embed(vec![text.clone()], None)
        .context("Failed to generate embedding")?;

    let embedding = embeddings
        .first()
        .context("No embedding returned")?;

    // Output as JSON array
    let json = serde_json::to_string(&embedding)
        .context("Failed to serialize embedding to JSON")?;

    println!("{}", json);

    Ok(())
}

fn get_input_text() -> Result<String> {
    // Priority 1: Command-line argument
    if let Some(arg) = std::env::args().nth(1) {
        return Ok(arg);
    }

    // Priority 2: Stdin
    let mut buffer = String::new();
    io::stdin()
        .read_to_string(&mut buffer)
        .context("Failed to read from stdin")?;

    if !buffer.is_empty() {
        return Ok(buffer);
    }

    anyhow::bail!("No input provided. Usage: forest-embed <text> or echo <text> | forest-embed");
}
