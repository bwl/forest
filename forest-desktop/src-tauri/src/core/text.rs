//! Text processing module - tokenization, stemming, tag extraction
//!
//! This module provides the lexical analysis foundation for Forest's scoring algorithm.
//! All functions are ported from TypeScript to ensure identical behavior.

use std::collections::{HashMap, HashSet};
use lazy_static::lazy_static;

lazy_static! {
    /// Stopwords - common words filtered from tokenization (70+ words)
    static ref STOPWORDS: HashSet<&'static str> = {
        let mut s = HashSet::new();
        // Articles, prepositions, conjunctions
        s.insert("a");
        s.insert("an");
        s.insert("and");
        s.insert("are");
        s.insert("as");
        s.insert("at");
        s.insert("be");
        s.insert("but");
        s.insert("by");
        s.insert("for");
        s.insert("if");
        s.insert("in");
        s.insert("into");
        s.insert("is");
        s.insert("it");
        s.insert("no");
        s.insert("not");
        s.insert("of");
        s.insert("on");
        s.insert("or");
        s.insert("such");
        s.insert("that");
        s.insert("the");
        s.insert("their");
        s.insert("then");
        s.insert("there");
        s.insert("these");
        s.insert("they");
        s.insert("this");
        s.insert("to");
        s.insert("was");
        s.insert("will");
        s.insert("with");
        s.insert("we");
        s.insert("you");
        s.insert("i");
        // Modal/auxiliary/filler
        s.insert("can");
        s.insert("could");
        s.insert("should");
        s.insert("would");
        s.insert("may");
        s.insert("might");
        s.insert("must");
        s.insert("also");
        s.insert("very");
        s.insert("much");
        s.insert("more");
        s.insert("most");
        s.insert("many");
        s.insert("few");
        s.insert("several");
        s.insert("often");
        s.insert("usually");
        s.insert("sometimes");
        s.insert("generally");
        // Discourse/connectives
        s.insert("from");
        s.insert("after");
        s.insert("before");
        s.insert("between");
        s.insert("across");
        s.insert("along");
        s.insert("within");
        s.insert("without");
        s.insert("via");
        s.insert("per");
        s.insert("because");
        s.insert("however");
        s.insert("therefore");
        s.insert("thus");
        // Generic verbs
        s.insert("ensure");
        s.insert("include");
        s.insert("including");
        s.insert("includes");
        s.insert("using");
        s.insert("use");
        s.insert("used");
        s.insert("based");
        s.insert("make");
        s.insert("made");
        s.insert("makes");
        s.insert("provide");
        s.insert("provides");
        s.insert("provided");
        s.insert("create");
        s.insert("creates");
        s.insert("created");
        // Domain-agnostic nouns
        s.insert("system");
        s.insert("systems");
        s.insert("process");
        s.insert("processes");
        s.insert("structure");
        s.insert("pattern");
        s.insert("patterns");
        s.insert("interface");
        s.insert("method");
        s.insert("methods");
        s.insert("approach");
        s.insert("approaches");
        s.insert("way");
        s.insert("ways");
        s
    };

    /// Tag blacklist - generic terms excluded from auto-tag extraction
    static ref TAG_BLACKLIST: HashSet<&'static str> = {
        let mut s = HashSet::new();
        s.insert("idea");
        s.insert("plan");
        s.insert("project");
        s.insert("projects");
        s.insert("system");
        s.insert("systems");
        s
    };

    /// Generic technical terms down-weighted in scoring
    static ref GENERIC_TECH: HashSet<&'static str> = {
        let mut s = HashSet::new();
        s.insert("flow");
        s.insert("flows");
        s.insert("stream");
        s.insert("streams");
        s.insert("pipe");
        s.insert("pipes");
        s.insert("branch");
        s.insert("branches");
        s.insert("terminal");
        s.insert("terminals");
        s
    };
}

/// Lightweight stemmer: handles plural/verb endings and comparatives
///
/// Matches TypeScript normalizeToken() behavior exactly.
fn normalize_token(token: &str) -> String {
    if token.len() <= 3 {
        return token.to_string();
    }

    // Common plurals: policies -> policy
    if token.ends_with("ies") && token.len() > 4 {
        return format!("{}y", &token[..token.len() - 3]);
    }

    // Double consonant plurals: classes -> class
    if token.ends_with("sses") {
        return token[..token.len() - 2].to_string();
    }

    // -ches, -shes, -xes, -zes: branches -> branch
    if token.ends_with("ches") || token.ends_with("shes") ||
       token.ends_with("xes") || token.ends_with("zes") {
        return token[..token.len() - 2].to_string();
    }

    // Gerund: flowing -> flow
    if token.ends_with("ing") && token.len() > 5 {
        return token[..token.len() - 3].to_string();
    }

    // Past tense: flowed -> flow
    if token.ends_with("ed") && token.len() > 4 {
        return token[..token.len() - 2].to_string();
    }

    // Simple plural 's' (avoid ss/us/is): nodes -> node
    if token.ends_with('s') && token.len() > 4 {
        let suffix = &token[token.len() - 2..];
        if suffix != "ss" && suffix != "us" && suffix != "is" {
            return token[..token.len() - 1].to_string();
        }
    }

    token.to_string()
}

/// Get token weight for ranking (down-weight generic tech terms)
fn token_weight(token: &str) -> f64 {
    if GENERIC_TECH.contains(token) {
        0.4
    } else {
        1.0
    }
}

/// Tokenize text to list (for bigrams and title processing)
///
/// Returns a vector of normalized tokens in order.
fn tokenize_to_list(text: &str) -> Vec<String> {
    // Normalize: lowercase, keep only alphanumeric/# and spaces
    let normalized = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '#' || c.is_whitespace() { c } else { ' ' })
        .collect::<String>();

    // Split, filter short tokens and stopwords
    normalized
        .split_whitespace()
        .filter(|t| t.len() >= 2 && !STOPWORDS.contains(t))
        .map(|t| normalize_token(t))
        .collect()
}

/// Extract tags from text using lexical frequency analysis
///
/// This is the main tag extraction function that combines unigrams and bigrams
/// with frequency-based ranking.
///
/// # Arguments
/// * `text` - Full text (title + body)
/// * `token_counts` - Optional pre-computed token counts (if None, will compute)
/// * `limit` - Maximum number of tags to return (default: 5)
///
/// # Returns
/// Vector of tag strings, ranked by frequency × weight
pub fn extract_tags(text: &str, token_counts: Option<&HashMap<String, i64>>, limit: usize) -> Vec<String> {
    // Check for explicit hashtags first
    let hashtag_regex = regex::Regex::new(r"#[a-zA-Z0-9_-]+").unwrap();
    let matches: Vec<String> = hashtag_regex
        .find_iter(text)
        .map(|m| m.as_str()[1..].to_lowercase()) // Remove # and lowercase
        .collect::<HashSet<_>>() // Deduplicate
        .into_iter()
        .collect();

    if !matches.is_empty() {
        return matches;
    }

    // Fall through to lexical tagging
    extract_tags_lexical(text, token_counts, limit)
}

/// Lexical tag extraction using frequency-based ranking
///
/// Matches TypeScript extractTagsLexical() behavior exactly.
pub fn extract_tags_lexical(text: &str, token_counts: Option<&HashMap<String, i64>>, limit: usize) -> Vec<String> {
    // Build unigrams
    let counts = match token_counts {
        Some(tc) => tc.clone(),
        None => tokenize(text),
    };

    let mut unigram_entries: Vec<(String, f64)> = counts
        .iter()
        .filter(|(token, _)| token.len() >= 3 && !TAG_BLACKLIST.contains(token.as_str()))
        .map(|(token, count)| {
            let score = (*count as f64) * token_weight(token);
            (token.clone(), score)
        })
        .collect();

    // Build bigrams from body only (avoid title->body bridges)
    let body_only = if let Some(idx) = text.find('\n') {
        &text[idx + 1..]
    } else {
        text
    };

    let seq = tokenize_to_list(body_only);
    let mut bigram_counts: HashMap<String, i64> = HashMap::new();

    for i in 0..seq.len().saturating_sub(1) {
        let a = &seq[i];
        let b = &seq[i + 1];
        if a.len() < 3 || b.len() < 3 {
            continue;
        }
        let bigram = format!("{} {}", a, b);
        *bigram_counts.entry(bigram).or_insert(0) += 1;
    }

    let mut bigram_entries: Vec<(String, f64)> = bigram_counts
        .iter()
        .map(|(tag, count)| {
            let parts: Vec<&str> = tag.split(' ').collect();
            let w = 1.75 * token_weight(parts[0]).max(token_weight(parts[1]));
            let score = (*count as f64) * w;
            (tag.clone(), score)
        })
        .collect();

    // Combine and sort by score (desc), then by tag name (asc)
    let mut combined = Vec::new();
    combined.append(&mut unigram_entries);
    combined.append(&mut bigram_entries);
    combined.sort_by(|a, b| {
        if (b.1 - a.1).abs() < f64::EPSILON {
            a.0.cmp(&b.0)
        } else {
            b.1.partial_cmp(&a.1).unwrap()
        }
    });

    // Pick top tags, capping bigrams to avoid crowding
    let mut picked = Vec::new();
    let mut bigrams_used = 0;
    let max_bigrams = 1.max(limit / 2);

    for (tag, _score) in combined {
        let is_bigram = tag.contains(' ');
        if is_bigram && bigrams_used >= max_bigrams {
            continue;
        }
        if picked.contains(&tag) {
            continue;
        }
        picked.push(tag.clone());
        if is_bigram {
            bigrams_used += 1;
        }
        if picked.len() >= limit {
            break;
        }
    }

    picked
}

/// Tokenize text to frequency counts
///
/// Returns HashMap<token, count> with normalized tokens.
/// Matches TypeScript tokenize() behavior exactly.
pub fn tokenize(text: &str) -> HashMap<String, i64> {
    // Normalize: lowercase, keep only alphanumeric/# and spaces
    let normalized = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '#' || c.is_whitespace() { c } else { ' ' })
        .collect::<String>();

    // Split and filter
    let tokens: Vec<String> = normalized
        .split_whitespace()
        .filter(|token| token.len() >= 2 && !STOPWORDS.contains(token))
        .map(|t| normalize_token(t))
        .collect();

    // Count frequencies
    let mut counts = HashMap::new();
    for token in tokens {
        *counts.entry(token).or_insert(0) += 1;
    }

    counts
}

/// Extract tokens from title (for title similarity scoring)
///
/// Simpler than full tokenization - no stemming beyond basic normalization.
/// Matches TypeScript tokensFromTitle() behavior exactly.
pub fn tokens_from_title(title: &str) -> Vec<String> {
    // Normalize: lowercase, keep only alphanumeric and spaces
    let normalized = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect::<String>();

    // Split and filter
    normalized
        .split_whitespace()
        .filter(|token| token.len() >= 2 && !STOPWORDS.contains(token))
        .map(|t| normalize_token(t))
        .collect()
}

/// Pick title from body (fallback logic)
///
/// If no explicit title provided, use first non-empty line, or truncate body.
/// Matches TypeScript pickTitle() behavior exactly.
pub fn pick_title(raw_body: &str, provided_title: Option<&str>) -> String {
    // Use provided title if present and non-empty
    if let Some(title) = provided_title {
        let trimmed = title.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Use first non-empty line
    for line in raw_body.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    // Fallback: first 80 chars of body
    let truncated = if raw_body.len() > 80 {
        &raw_body[..80]
    } else {
        raw_body
    };

    let trimmed = truncated.trim();
    if trimmed.is_empty() {
        "Untitled Idea".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_token() {
        assert_eq!(normalize_token("policies"), "policy");
        assert_eq!(normalize_token("classes"), "class");
        assert_eq!(normalize_token("branches"), "branch");
        assert_eq!(normalize_token("flowing"), "flow");
        assert_eq!(normalize_token("flowed"), "flow");
        assert_eq!(normalize_token("nodes"), "node");
        assert_eq!(normalize_token("class"), "class"); // No change for 'ss'
        assert_eq!(normalize_token("bus"), "bus"); // No change for 'us'
        assert_eq!(normalize_token("is"), "is"); // No change for 'is'
        assert_eq!(normalize_token("cat"), "cat"); // Too short
    }

    #[test]
    fn test_tokenize() {
        let text = "The quick brown fox jumps over the lazy dog";
        let counts = tokenize(text);
        // 'the' is a stopword, should be filtered
        assert_eq!(counts.get("the"), None);
        assert_eq!(counts.get("quick"), Some(&1));
        assert_eq!(counts.get("brown"), Some(&1));
        assert_eq!(counts.get("fox"), Some(&1));
        assert_eq!(counts.get("jump"), Some(&1)); // 'jumps' -> 'jump'
        assert_eq!(counts.get("over"), Some(&1));
        assert_eq!(counts.get("lazy"), Some(&1));
        assert_eq!(counts.get("dog"), Some(&1));
    }

    #[test]
    fn test_tokens_from_title() {
        let title = "Building a Graph Database";
        let tokens = tokens_from_title(title);
        // 'a' is a stopword
        // Note: 'database' -> 'database' (no stemming for final 'e'), but we stem 'building' -> 'build'
        assert_eq!(tokens, vec!["build", "graph", "database"]);
    }

    #[test]
    fn test_extract_tags_hashtags() {
        let text = "This is about #rust and #tauri development";
        let tags = extract_tags(text, None, 5);
        assert!(tags.contains(&"rust".to_string()));
        assert!(tags.contains(&"tauri".to_string()));
        assert_eq!(tags.len(), 2);
    }

    #[test]
    fn test_extract_tags_lexical() {
        let text = "Flow control in stream processing with pipes and branches. Flow streams through pipes.";
        let tags = extract_tags_lexical(text, None, 5);
        // Should extract frequent terms, but 'flow' should be down-weighted
        assert!(tags.len() > 0);
        println!("Extracted tags: {:?}", tags);
    }

    #[test]
    fn test_pick_title() {
        // Provided title
        assert_eq!(pick_title("body text", Some("My Title")), "My Title");

        // First line of body
        assert_eq!(pick_title("First Line\nSecond Line", None), "First Line");

        // Single long line - uses first line logic, not truncation
        let long_body = "a".repeat(100);
        let title = pick_title(&long_body, None);
        // Since there's no newline, the entire string is treated as first line
        assert_eq!(title.len(), 100);

        // Multi-line with long first line
        let multi_line = format!("{}\nSecond", "a".repeat(100));
        let title2 = pick_title(&multi_line, None);
        assert_eq!(title2.len(), 100);

        // Empty lines followed by content - should skip to first non-empty
        let with_empty = "\n\n\nContent";
        assert_eq!(pick_title(with_empty, None), "Content");

        // Empty body
        assert_eq!(pick_title("", None), "Untitled Idea");

        // Only whitespace - should use truncation fallback
        let whitespace = "   ";
        assert_eq!(pick_title(whitespace, None), "Untitled Idea");
    }

    #[test]
    fn test_token_weight() {
        assert_eq!(token_weight("flow"), 0.4);
        assert_eq!(token_weight("stream"), 0.4);
        assert_eq!(token_weight("algorithm"), 1.0);
    }
}
