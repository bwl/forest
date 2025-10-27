use crate::db::types::*;
use crate::db::utils::*;
use crate::db::EdgeEventInput;
use anyhow::{Context, Result};
use sqlx::SqlitePool;

/// Insert or update an edge (upsert operation)
/// Enforces source_id < target_id normalization for undirected edges
pub async fn upsert_edge(pool: &SqlitePool, edge: NewEdge) -> Result<EdgeRecord> {
    let (source_id, target_id) = normalize_edge_pair(&edge.source_id, &edge.target_id);
    let id = generate_uuid();
    let now = now_iso();

    let metadata_json = edge.metadata.as_ref().map(|m| to_json_string(m)).transpose()?;

    sqlx::query(
        r#"
        INSERT INTO edges (id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id, target_id)
        DO UPDATE SET
            score = excluded.score,
            status = excluded.status,
            edge_type = excluded.edge_type,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
        "#
    )
    .bind(&id)
    .bind(&source_id)
    .bind(&target_id)
    .bind(edge.score)
    .bind(edge.status.as_str())
    .bind(edge.edge_type.as_str())
    .bind(metadata_json.as_ref())
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .context("Failed to upsert edge")?;

    // Fetch the edge (might have been updated, not inserted)
    get_edge_by_pair(pool, &source_id, &target_id).await
}

/// Get edge by exact ID
pub async fn get_edge_by_id(pool: &SqlitePool, id: &str) -> Result<EdgeRecord> {
    let row = sqlx::query(
        r#"
        SELECT id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at
        FROM edges
        WHERE id = ?
        LIMIT 1
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => parse_edge_row(&r),
        None => Err(DbError::EdgeNotFound(id.to_string()).into()),
    }
}

/// Get edge by node pair (source, target)
async fn get_edge_by_pair(pool: &SqlitePool, source_id: &str, target_id: &str) -> Result<EdgeRecord> {
    let (norm_source, norm_target) = normalize_edge_pair(source_id, target_id);

    let row = sqlx::query(
        r#"
        SELECT id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at
        FROM edges
        WHERE source_id = ? AND target_id = ?
        LIMIT 1
        "#
    )
    .bind(&norm_source)
    .bind(&norm_target)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => parse_edge_row(&r),
        None => Err(DbError::EdgeNotFound(format!("{} <-> {}", source_id, target_id)).into()),
    }
}

/// Parse an edge row from the database
fn parse_edge_row(row: &sqlx::sqlite::SqliteRow) -> Result<EdgeRecord> {
    use sqlx::Row;

    let id: String = row.try_get("id")?;
    let source_id: String = row.try_get("source_id")?;
    let target_id: String = row.try_get("target_id")?;
    let score: f64 = row.try_get("score")?;
    let status_str: String = row.try_get("status")?;
    let edge_type_str: String = row.try_get("edge_type")?;
    let metadata_json: Option<String> = row.try_get("metadata")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;

    Ok(EdgeRecord {
        id,
        source_id,
        target_id,
        score,
        status: EdgeStatus::from_str(&status_str)?,
        edge_type: EdgeType::from_str(&edge_type_str)?,
        metadata: metadata_json.as_ref().map(|j| from_json_string(j)).transpose()?,
        created_at,
        updated_at,
    })
}

/// List edges with optional filtering and pagination
pub async fn list_edges(pool: &SqlitePool, filters: EdgeFilters, pagination: Pagination) -> Result<Vec<EdgeRecord>> {
    let mut query = String::from(
        "SELECT id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at FROM edges WHERE 1=1"
    );
    let mut bindings: Vec<String> = vec![];

    if let Some(status) = filters.status {
        query.push_str(" AND status = ?");
        bindings.push(status.as_str().to_string());
    }

    if let Some(min_score) = filters.min_score {
        query.push_str(" AND score >= ?");
        bindings.push(min_score.to_string());
    }

    if let Some(max_score) = filters.max_score {
        query.push_str(" AND score <= ?");
        bindings.push(max_score.to_string());
    }

    if let Some(edge_type) = filters.edge_type {
        query.push_str(" AND edge_type = ?");
        bindings.push(edge_type.as_str().to_string());
    }

    if let Some(node_id) = &filters.node_id {
        query.push_str(" AND (source_id = ? OR target_id = ?)");
        bindings.push(node_id.clone());
        bindings.push(node_id.clone());
    }

    query.push_str(" ORDER BY updated_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query(&query);
    for binding in &bindings {
        q = q.bind(binding);
    }
    q = q.bind(pagination.limit).bind(pagination.offset);

    let rows = q.fetch_all(pool).await?;
    rows.iter().map(parse_edge_row).collect()
}

/// Get all edges for a specific node (where node is either source or target)
pub async fn get_edges_for_node(pool: &SqlitePool, node_id: &str) -> Result<Vec<EdgeRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at
        FROM edges
        WHERE source_id = ? OR target_id = ?
        ORDER BY score DESC
        "#
    )
    .bind(node_id)
    .bind(node_id)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_edge_row).collect()
}

/// Delete edge between two nodes
pub async fn delete_edge(pool: &SqlitePool, source_id: &str, target_id: &str) -> Result<bool> {
    let (norm_source, norm_target) = normalize_edge_pair(source_id, target_id);

    let result = sqlx::query("DELETE FROM edges WHERE source_id = ? AND target_id = ?")
        .bind(&norm_source)
        .bind(&norm_target)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Promote suggestions to accepted (bulk operation above min score threshold)
pub async fn promote_suggestions(pool: &SqlitePool, min_score: f64) -> Result<i64> {
    let now = now_iso();

    let result = sqlx::query(
        r#"
        UPDATE edges
        SET status = 'accepted', updated_at = ?
        WHERE status = 'suggested' AND score >= ?
        "#
    )
    .bind(&now)
    .bind(min_score)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as i64)
}

/// Delete a suggested edge by ID
pub async fn delete_suggestion(pool: &SqlitePool, edge_id: &str) -> Result<bool> {
    let result = sqlx::query("DELETE FROM edges WHERE id = ? AND status = 'suggested'")
        .bind(edge_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

// ===== Edge Events for Undo Support =====

/// Log an edge event for undo tracking
pub async fn log_edge_event(pool: &SqlitePool, event: EdgeEventInput) -> Result<i64> {
    let now = now_iso();
    let payload_json = event.payload.as_ref().map(|p| to_json_string(p)).transpose()?;

    let result = sqlx::query(
        r#"
        INSERT INTO edge_events (edge_id, source_id, target_id, prev_status, next_status, payload, created_at, undone)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        "#
    )
    .bind(event.edge_id.as_ref())
    .bind(&event.source_id)
    .bind(&event.target_id)
    .bind(event.prev_status.as_ref())
    .bind(&event.next_status)
    .bind(payload_json.as_ref())
    .bind(&now)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

/// Get the last (non-undone) edge event for a node pair
pub async fn get_last_edge_event(pool: &SqlitePool, source_id: &str, target_id: &str) -> Result<Option<EdgeEventRecord>> {
    let row = sqlx::query(
        r#"
        SELECT id, edge_id, source_id, target_id, prev_status, next_status, payload, created_at, undone
        FROM edge_events
        WHERE source_id = ? AND target_id = ? AND undone = 0
        ORDER BY id DESC
        LIMIT 1
        "#
    )
    .bind(source_id)
    .bind(target_id)
    .fetch_optional(pool)
    .await?;

    row.map(|r| parse_edge_event_row(&r)).transpose()
}

/// Parse an edge event row
fn parse_edge_event_row(row: &sqlx::sqlite::SqliteRow) -> Result<EdgeEventRecord> {
    use sqlx::Row;

    let id: i64 = row.try_get("id")?;
    let edge_id: Option<String> = row.try_get("edge_id")?;
    let source_id: String = row.try_get("source_id")?;
    let target_id: String = row.try_get("target_id")?;
    let prev_status: Option<String> = row.try_get("prev_status")?;
    let next_status: String = row.try_get("next_status")?;
    let payload_json: Option<String> = row.try_get("payload")?;
    let created_at: String = row.try_get("created_at")?;
    let undone_int: i64 = row.try_get("undone")?;

    Ok(EdgeEventRecord {
        id,
        edge_id,
        source_id,
        target_id,
        prev_status,
        next_status,
        payload: payload_json.as_ref().map(|j| from_json_string(j)).transpose()?,
        created_at,
        undone: int_to_bool(undone_int),
    })
}

/// Mark an edge event as undone
pub async fn mark_edge_event_undone(pool: &SqlitePool, event_id: i64) -> Result<()> {
    sqlx::query("UPDATE edge_events SET undone = 1 WHERE id = ?")
        .bind(event_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// List recent edge events (for debugging/auditing)
pub async fn list_edge_events(pool: &SqlitePool, limit: i64) -> Result<Vec<EdgeEventRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT id, edge_id, source_id, target_id, prev_status, next_status, payload, created_at, undone
        FROM edge_events
        WHERE undone = 0
        ORDER BY id DESC
        LIMIT ?
        "#
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_edge_event_row).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_upsert_edge() {
        let pool = setup_test_db().await;

        let new_edge = NewEdge {
            source_id: "node-1".to_string(),
            target_id: "node-2".to_string(),
            score: 0.75,
            status: EdgeStatus::Suggested,
            edge_type: EdgeType::Semantic,
            metadata: None,
        };

        let inserted = upsert_edge(&pool, new_edge).await.unwrap();
        assert_eq!(inserted.score, 0.75);
        assert_eq!(inserted.status, EdgeStatus::Suggested);

        // Upsert again with different score (should update)
        let update_edge = NewEdge {
            source_id: "node-1".to_string(),
            target_id: "node-2".to_string(),
            score: 0.85,
            status: EdgeStatus::Accepted,
            edge_type: EdgeType::Semantic,
            metadata: None,
        };

        let updated = upsert_edge(&pool, update_edge).await.unwrap();
        assert_eq!(updated.score, 0.85);
        assert_eq!(updated.status, EdgeStatus::Accepted);
    }

    #[tokio::test]
    async fn test_normalize_edge_pair() {
        let pool = setup_test_db().await;

        // Insert with node-2, node-1 (reversed order)
        let new_edge = NewEdge {
            source_id: "node-2".to_string(),
            target_id: "node-1".to_string(),
            score: 0.5,
            status: EdgeStatus::Suggested,
            edge_type: EdgeType::Semantic,
            metadata: None,
        };

        let inserted = upsert_edge(&pool, new_edge).await.unwrap();

        // Should be normalized to node-1 < node-2
        assert_eq!(inserted.source_id, "node-1");
        assert_eq!(inserted.target_id, "node-2");
    }

    #[tokio::test]
    async fn test_list_edges_with_filters() {
        let pool = setup_test_db().await;

        // Insert multiple edges
        upsert_edge(&pool, NewEdge {
            source_id: "a".to_string(),
            target_id: "b".to_string(),
            score: 0.9,
            status: EdgeStatus::Accepted,
            edge_type: EdgeType::Semantic,
            metadata: None,
        }).await.unwrap();

        upsert_edge(&pool, NewEdge {
            source_id: "a".to_string(),
            target_id: "c".to_string(),
            score: 0.3,
            status: EdgeStatus::Suggested,
            edge_type: EdgeType::Semantic,
            metadata: None,
        }).await.unwrap();

        // Filter by status
        let accepted = list_edges(&pool, EdgeFilters {
            status: Some(EdgeStatus::Accepted),
            ..Default::default()
        }, Pagination::default()).await.unwrap();

        assert_eq!(accepted.len(), 1);
        assert_eq!(accepted[0].status, EdgeStatus::Accepted);

        // Filter by min score
        let high_score = list_edges(&pool, EdgeFilters {
            min_score: Some(0.8),
            ..Default::default()
        }, Pagination::default()).await.unwrap();

        assert_eq!(high_score.len(), 1);
        assert!(high_score[0].score >= 0.8);
    }

    #[tokio::test]
    async fn test_promote_suggestions() {
        let pool = setup_test_db().await;

        // Insert suggestions with different scores
        for (score, i) in [(0.9, 1), (0.6, 2), (0.3, 3)] {
            upsert_edge(&pool, NewEdge {
                source_id: "a".to_string(),
                target_id: format!("node-{}", i),
                score,
                status: EdgeStatus::Suggested,
                edge_type: EdgeType::Semantic,
                metadata: None,
            }).await.unwrap();
        }

        // Promote edges with score >= 0.5
        let promoted_count = promote_suggestions(&pool, 0.5).await.unwrap();
        assert_eq!(promoted_count, 2);

        // Verify only 1 suggestion remains
        let remaining = list_edges(&pool, EdgeFilters {
            status: Some(EdgeStatus::Suggested),
            ..Default::default()
        }, Pagination::default()).await.unwrap();

        assert_eq!(remaining.len(), 1);
        assert!(remaining[0].score < 0.5);
    }

    #[tokio::test]
    async fn test_edge_events() {
        let pool = setup_test_db().await;

        let event = EdgeEventInput {
            edge_id: Some("edge-123".to_string()),
            source_id: "node-1".to_string(),
            target_id: "node-2".to_string(),
            prev_status: None,
            next_status: "suggested".to_string(),
            payload: None,
        };

        let event_id = log_edge_event(&pool, event).await.unwrap();
        assert!(event_id > 0);

        // Retrieve the event
        let retrieved = get_last_edge_event(&pool, "node-1", "node-2").await.unwrap();
        assert!(retrieved.is_some());

        let event_record = retrieved.unwrap();
        assert_eq!(event_record.edge_id, Some("edge-123".to_string()));
        assert!(!event_record.undone);

        // Mark as undone
        mark_edge_event_undone(&pool, event_id).await.unwrap();

        // Should not be returned now
        let after_undo = get_last_edge_event(&pool, "node-1", "node-2").await.unwrap();
        assert!(after_undo.is_none());
    }
}
