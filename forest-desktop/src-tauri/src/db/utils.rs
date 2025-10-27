use crate::db::types::DbError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Generate a new UUID v4
pub fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
}

/// Get current ISO 8601 timestamp
pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

/// Serialize a value to JSON string for SQLite storage
pub fn to_json_string<T: Serialize + ?Sized>(value: &T) -> Result<String, DbError> {
    serde_json::to_string(value).map_err(DbError::JsonError)
}

/// Deserialize a JSON string from SQLite
pub fn from_json_string<'a, T: Deserialize<'a>>(json: &'a str) -> Result<T, DbError> {
    serde_json::from_str(json).map_err(DbError::JsonError)
}

/// Serialize tags (Vec<String>) to JSON for SQLite
pub fn serialize_tags(tags: &[String]) -> Result<String, DbError> {
    to_json_string(tags)
}

/// Deserialize tags from JSON stored in SQLite
pub fn deserialize_tags(json: &str) -> Result<Vec<String>, DbError> {
    from_json_string(json)
}

/// Serialize token counts (HashMap<String, i64>) to JSON for SQLite
pub fn serialize_token_counts(counts: &HashMap<String, i64>) -> Result<String, DbError> {
    to_json_string(counts)
}

/// Deserialize token counts from JSON stored in SQLite
pub fn deserialize_token_counts(json: &str) -> Result<HashMap<String, i64>, DbError> {
    from_json_string(json)
}

/// Serialize embedding (Vec<f64>) to JSON for SQLite
pub fn serialize_embedding(embedding: &[f64]) -> Result<String, DbError> {
    to_json_string(embedding)
}

/// Deserialize embedding from JSON stored in SQLite
pub fn deserialize_embedding(json: &str) -> Result<Vec<f64>, DbError> {
    from_json_string(json)
}

/// Normalize edge pair - ensures sourceId < targetId for undirected edges
pub fn normalize_edge_pair(a: &str, b: &str) -> (String, String) {
    if a < b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

/// Convert boolean to SQLite INTEGER (0 or 1)
pub fn bool_to_int(value: bool) -> i64 {
    if value { 1 } else { 0 }
}

/// Convert SQLite INTEGER to boolean
pub fn int_to_bool(value: i64) -> bool {
    value != 0
}

/// Extract short ID prefix (first 8 chars) from UUID
pub fn short_id(uuid: &str) -> String {
    uuid.chars().take(8).collect()
}

/// Validate UUID format
pub fn is_valid_uuid(s: &str) -> bool {
    Uuid::parse_str(s).is_ok()
}

/// Check if a string looks like a UUID prefix (hex chars, 4-36 length)
pub fn is_uuid_prefix(s: &str) -> bool {
    let len = s.len();
    len >= 4 && len <= 36 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// SHA-256 hash for checksums
pub fn hash_content(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_uuid() {
        let uuid = generate_uuid();
        assert!(is_valid_uuid(&uuid));
    }

    #[test]
    fn test_normalize_edge_pair() {
        let (a, b) = normalize_edge_pair("zzz", "aaa");
        assert_eq!(a, "aaa");
        assert_eq!(b, "zzz");

        let (a, b) = normalize_edge_pair("aaa", "zzz");
        assert_eq!(a, "aaa");
        assert_eq!(b, "zzz");
    }

    #[test]
    fn test_bool_conversion() {
        assert_eq!(bool_to_int(true), 1);
        assert_eq!(bool_to_int(false), 0);
        assert!(int_to_bool(1));
        assert!(int_to_bool(42));
        assert!(!int_to_bool(0));
    }

    #[test]
    fn test_short_id() {
        let uuid = "7fa7acb2-ed4a-4f3b-9c1e-8a2b3c4d5e6f";
        assert_eq!(short_id(uuid), "7fa7acb2");
    }

    #[test]
    fn test_is_uuid_prefix() {
        assert!(is_uuid_prefix("7fa7"));
        assert!(is_uuid_prefix("7fa7acb2"));
        assert!(is_uuid_prefix("7fa7acb2-ed4a"));
        assert!(!is_uuid_prefix("xyz"));
        assert!(!is_uuid_prefix("7f"));
    }

    #[test]
    fn test_serialize_tags() {
        let tags = vec!["rust".to_string(), "tauri".to_string()];
        let json = serialize_tags(&tags).unwrap();
        assert_eq!(json, r#"["rust","tauri"]"#);

        let deserialized: Vec<String> = deserialize_tags(&json).unwrap();
        assert_eq!(deserialized, tags);
    }

    #[test]
    fn test_serialize_token_counts() {
        let mut counts = HashMap::new();
        counts.insert("rust".to_string(), 5);
        counts.insert("tauri".to_string(), 3);

        let json = serialize_token_counts(&counts).unwrap();
        let deserialized: HashMap<String, i64> = deserialize_token_counts(&json).unwrap();

        assert_eq!(deserialized.get("rust"), Some(&5));
        assert_eq!(deserialized.get("tauri"), Some(&3));
    }
}
