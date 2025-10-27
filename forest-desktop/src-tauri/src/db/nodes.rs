use crate::db::types::*;
use crate::db::utils::*;
use anyhow::{Context, Result};
use sqlx::SqlitePool;

/// Insert a new node into the database
pub async fn insert_node(pool: &SqlitePool, node: NewNode) -> Result<NodeRecord> {
    let id = generate_uuid();
    let now = now_iso();

    let tags_json = serialize_tags(&node.tags)?;
    let token_counts_json = serialize_token_counts(&node.token_counts)?;
    let embedding_json = node.embedding.as_ref().map(|e| serialize_embedding(e)).transpose()?;

    sqlx::query(
        r#"
        INSERT INTO nodes (
            id, title, body, tags, token_counts, embedding,
            created_at, updated_at, is_chunk, parent_document_id, chunk_order,
            position_x, position_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&node.title)
    .bind(&node.body)
    .bind(&tags_json)
    .bind(&token_counts_json)
    .bind(embedding_json.as_ref())
    .bind(&now)
    .bind(&now)
    .bind(bool_to_int(node.is_chunk))
    .bind(node.parent_document_id.as_ref())
    .bind(node.chunk_order)
    .bind(node.position_x)
    .bind(node.position_y)
    .execute(pool)
    .await
    .context("Failed to insert node")?;

    Ok(NodeRecord {
        id,
        title: node.title,
        body: node.body,
        tags: node.tags,
        token_counts: node.token_counts,
        embedding: node.embedding,
        created_at: now.clone(),
        updated_at: now,
        is_chunk: node.is_chunk,
        parent_document_id: node.parent_document_id,
        chunk_order: node.chunk_order,
        position_x: node.position_x,
        position_y: node.position_y,
    })
}

/// Get node by ID - supports full UUID, short ID prefix, or progressive ID
pub async fn get_node_by_id(pool: &SqlitePool, id: &str) -> Result<NodeRecord> {
    // Try exact match first (fast path for full UUIDs)
    if let Some(node) = try_get_exact_node(pool, id).await? {
        return Ok(node);
    }

    // If it looks like a UUID prefix, try prefix matching
    if is_uuid_prefix(id) {
        let matches = find_nodes_by_prefix(pool, id).await?;

        return match matches.len() {
            0 => Err(DbError::NodeNotFound(id.to_string()).into()),
            1 => Ok(matches.into_iter().next().unwrap()),
            n => Err(DbError::AmbiguousId(id.to_string(), n).into()),
        };
    }

    Err(DbError::NodeNotFound(id.to_string()).into())
}

/// Try to get a node by exact ID match
async fn try_get_exact_node(pool: &SqlitePool, id: &str) -> Result<Option<NodeRecord>> {
    let row = sqlx::query(
        r#"
        SELECT id, title, body, tags, token_counts, embedding,
               created_at, updated_at, is_chunk, parent_document_id, chunk_order,
               position_x, position_y
        FROM nodes
        WHERE id = ?
        LIMIT 1
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    row.map(|r| parse_node_row(&r)).transpose()
}

/// Find nodes by UUID prefix
async fn find_nodes_by_prefix(pool: &SqlitePool, prefix: &str) -> Result<Vec<NodeRecord>> {
    let normalized = prefix.to_lowercase();
    let pattern = format!("{}%", normalized);

    let rows = sqlx::query(
        r#"
        SELECT id, title, body, tags, token_counts, embedding,
               created_at, updated_at, is_chunk, parent_document_id, chunk_order,
               position_x, position_y
        FROM nodes
        WHERE lower(id) LIKE ?
        "#
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_node_row).collect()
}

/// Parse a node row from the database
fn parse_node_row(row: &sqlx::sqlite::SqliteRow) -> Result<NodeRecord> {
    use sqlx::Row;

    let id: String = row.try_get("id")?;
    let title: String = row.try_get("title")?;
    let body: String = row.try_get("body")?;
    let tags_json: String = row.try_get("tags")?;
    let token_counts_json: String = row.try_get("token_counts")?;
    let embedding_json: Option<String> = row.try_get("embedding")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;
    let is_chunk_int: i64 = row.try_get("is_chunk")?;
    let parent_document_id: Option<String> = row.try_get("parent_document_id")?;
    let chunk_order: Option<i64> = row.try_get("chunk_order")?;
    let position_x: Option<f64> = row.try_get("position_x")?;
    let position_y: Option<f64> = row.try_get("position_y")?;

    Ok(NodeRecord {
        id,
        title,
        body,
        tags: deserialize_tags(&tags_json)?,
        token_counts: deserialize_token_counts(&token_counts_json)?,
        embedding: embedding_json.as_ref().map(|j| deserialize_embedding(j)).transpose()?,
        created_at,
        updated_at,
        is_chunk: int_to_bool(is_chunk_int),
        parent_document_id,
        chunk_order,
        position_x,
        position_y,
    })
}

/// Update a node
pub async fn update_node(pool: &SqlitePool, id: &str, update: UpdateNode) -> Result<NodeRecord> {
    // First verify node exists (and resolve short IDs)
    let existing = get_node_by_id(pool, id).await?;
    let full_id = &existing.id;

    let now = now_iso();

    // Apply updates to existing record
    let new_title = update.title.unwrap_or(existing.title);
    let new_body = update.body.unwrap_or(existing.body);
    let new_tags = update.tags.unwrap_or(existing.tags);
    let new_token_counts = update.token_counts.unwrap_or(existing.token_counts);
    let new_embedding = update.embedding.or(existing.embedding);

    let tags_json = serialize_tags(&new_tags)?;
    let token_counts_json = serialize_token_counts(&new_token_counts)?;
    let embedding_json = new_embedding.as_ref().map(|e| serialize_embedding(e)).transpose()?;

    sqlx::query(
        r#"
        UPDATE nodes
        SET title = ?, body = ?, tags = ?, token_counts = ?, embedding = ?, updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(&new_title)
    .bind(&new_body)
    .bind(&tags_json)
    .bind(&token_counts_json)
    .bind(embedding_json.as_ref())
    .bind(&now)
    .bind(full_id)
    .execute(pool)
    .await
    .context("Failed to update node")?;

    // Return updated node
    get_node_by_id(pool, full_id).await
}

/// Delete a node and return count of edges removed
pub async fn delete_node(pool: &SqlitePool, id: &str) -> Result<crate::db::DeleteNodeResult> {
    // Resolve short ID to full ID
    let existing = get_node_by_id(pool, id).await?;
    let full_id = &existing.id;

    // Count edges to be removed
    let edge_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM edges WHERE source_id = ? OR target_id = ?"
    )
    .bind(full_id)
    .bind(full_id)
    .fetch_one(pool)
    .await?;

    // Delete edges first
    sqlx::query("DELETE FROM edges WHERE source_id = ? OR target_id = ?")
        .bind(full_id)
        .bind(full_id)
        .execute(pool)
        .await?;

    // Delete document chunk mappings
    sqlx::query("DELETE FROM document_chunks WHERE node_id = ?")
        .bind(full_id)
        .execute(pool)
        .await?;

    // Delete the node
    let result = sqlx::query("DELETE FROM nodes WHERE id = ?")
        .bind(full_id)
        .execute(pool)
        .await?;

    Ok(crate::db::DeleteNodeResult {
        node_removed: result.rows_affected() > 0,
        edges_removed: edge_count,
    })
}

/// List all nodes with pagination
pub async fn list_nodes(pool: &SqlitePool, pagination: Pagination) -> Result<Vec<NodeRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT id, title, body, tags, token_counts, embedding,
               created_at, updated_at, is_chunk, parent_document_id, chunk_order,
               position_x, position_y
        FROM nodes
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
        "#
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_node_row).collect()
}

/// Search nodes by title substring (case-insensitive)
pub async fn search_nodes_by_title(pool: &SqlitePool, query: &str) -> Result<Vec<NodeRecord>> {
    let pattern = format!("%{}%", query.to_lowercase());

    let rows = sqlx::query(
        r#"
        SELECT id, title, body, tags, token_counts, embedding,
               created_at, updated_at, is_chunk, parent_document_id, chunk_order,
               position_x, position_y
        FROM nodes
        WHERE lower(title) LIKE ?
        ORDER BY updated_at DESC
        LIMIT 50
        "#
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_node_row).collect()
}

/// Update only token counts (used during re-indexing)
pub async fn update_node_tokens(pool: &SqlitePool, id: &str, token_counts: std::collections::HashMap<String, i64>) -> Result<()> {
    let existing = get_node_by_id(pool, id).await?;
    let full_id = &existing.id;

    let token_counts_json = serialize_token_counts(&token_counts)?;
    let now = now_iso();

    sqlx::query("UPDATE nodes SET token_counts = ?, updated_at = ? WHERE id = ?")
        .bind(&token_counts_json)
        .bind(&now)
        .bind(full_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Update chunk order (used during document editing)
pub async fn update_node_chunk_order(pool: &SqlitePool, id: &str, chunk_order: i64) -> Result<()> {
    let existing = get_node_by_id(pool, id).await?;
    let full_id = &existing.id;

    let now = now_iso();

    sqlx::query("UPDATE nodes SET chunk_order = ?, updated_at = ? WHERE id = ?")
        .bind(chunk_order)
        .bind(&now)
        .bind(full_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Update node position (used for graph visualization persistence)
pub async fn update_node_position(pool: &SqlitePool, id: &str, x: f64, y: f64) -> Result<()> {
    let existing = get_node_by_id(pool, id).await?;
    let full_id = &existing.id;

    sqlx::query("UPDATE nodes SET position_x = ?, position_y = ? WHERE id = ?")
        .bind(x)
        .bind(y)
        .bind(full_id)
        .execute(pool)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_insert_and_get_node() {
        let pool = setup_test_db().await;

        let mut token_counts = HashMap::new();
        token_counts.insert("test".to_string(), 5);

        let new_node = NewNode {
            title: "Test Node".to_string(),
            body: "This is a test".to_string(),
            tags: vec!["test".to_string()],
            token_counts,
            embedding: None,
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };

        let inserted = insert_node(&pool, new_node).await.unwrap();
        assert_eq!(inserted.title, "Test Node");
        assert_eq!(inserted.tags, vec!["test".to_string()]);

        // Get by full ID
        let fetched = get_node_by_id(&pool, &inserted.id).await.unwrap();
        assert_eq!(fetched.id, inserted.id);
        assert_eq!(fetched.title, "Test Node");

        // Get by short ID (first 8 chars)
        let short_id = &inserted.id[..8];
        let fetched_short = get_node_by_id(&pool, short_id).await.unwrap();
        assert_eq!(fetched_short.id, inserted.id);
    }

    #[tokio::test]
    async fn test_update_node() {
        let pool = setup_test_db().await;

        let new_node = NewNode {
            title: "Original".to_string(),
            body: "Original body".to_string(),
            tags: vec![],
            token_counts: HashMap::new(),
            embedding: None,
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };

        let inserted = insert_node(&pool, new_node).await.unwrap();

        let update = UpdateNode {
            title: Some("Updated".to_string()),
            body: Some("Updated body".to_string()),
            ..Default::default()
        };

        let updated = update_node(&pool, &inserted.id, update).await.unwrap();
        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.body, "Updated body");
    }

    #[tokio::test]
    async fn test_delete_node() {
        let pool = setup_test_db().await;

        let new_node = NewNode {
            title: "To Delete".to_string(),
            body: "Will be deleted".to_string(),
            tags: vec![],
            token_counts: HashMap::new(),
            embedding: None,
            is_chunk: false,
            parent_document_id: None,
            chunk_order: None,
            position_x: None,
            position_y: None,
        };

        let inserted = insert_node(&pool, new_node).await.unwrap();
        let result = delete_node(&pool, &inserted.id).await.unwrap();

        assert!(result.node_removed);

        // Verify it's gone
        let fetch_result = get_node_by_id(&pool, &inserted.id).await;
        assert!(fetch_result.is_err());
    }

    #[tokio::test]
    async fn test_list_nodes() {
        let pool = setup_test_db().await;

        // Insert multiple nodes
        for i in 0..3 {
            let new_node = NewNode {
                title: format!("Node {}", i),
                body: format!("Body {}", i),
                tags: vec![],
                token_counts: HashMap::new(),
                embedding: None,
                is_chunk: false,
                parent_document_id: None,
                chunk_order: None,
                position_x: None,
                position_y: None,
            };
            insert_node(&pool, new_node).await.unwrap();
        }

        let nodes = list_nodes(&pool, Pagination::default()).await.unwrap();
        assert_eq!(nodes.len(), 3);
    }
}
