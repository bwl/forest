use crate::db::types::*;
use crate::db::utils::*;
use anyhow::{Context, Result};
use sqlx::SqlitePool;

/// Insert or update a document (upsert)
pub async fn upsert_document(pool: &SqlitePool, doc: NewDocument) -> Result<DocumentRecord> {
    let id = generate_uuid();
    let now = now_iso();

    let metadata_json = doc.metadata.as_ref().map(|m| to_json_string(m)).transpose()?;

    sqlx::query(
        r#"
        INSERT INTO documents (id, title, body, metadata, version, root_node_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
            title = excluded.title,
            body = excluded.body,
            metadata = excluded.metadata,
            version = excluded.version,
            root_node_id = excluded.root_node_id,
            updated_at = excluded.updated_at
        "#
    )
    .bind(&id)
    .bind(&doc.title)
    .bind(&doc.body)
    .bind(metadata_json.as_ref())
    .bind(doc.root_node_id.as_ref())
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .context("Failed to upsert document")?;

    Ok(DocumentRecord {
        id,
        title: doc.title,
        body: doc.body,
        metadata: doc.metadata,
        version: 1,
        root_node_id: doc.root_node_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get document by ID
pub async fn get_document_by_id(pool: &SqlitePool, id: &str) -> Result<DocumentRecord> {
    let row = sqlx::query(
        r#"
        SELECT id, title, body, metadata, version, root_node_id, created_at, updated_at
        FROM documents
        WHERE id = ?
        LIMIT 1
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => parse_document_row(&r),
        None => Err(DbError::DocumentNotFound(id.to_string()).into()),
    }
}

/// Parse a document row from the database
fn parse_document_row(row: &sqlx::sqlite::SqliteRow) -> Result<DocumentRecord> {
    use sqlx::Row;

    let id: String = row.try_get("id")?;
    let title: String = row.try_get("title")?;
    let body: String = row.try_get("body")?;
    let metadata_json: Option<String> = row.try_get("metadata")?;
    let version: i64 = row.try_get("version")?;
    let root_node_id: Option<String> = row.try_get("root_node_id")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;

    Ok(DocumentRecord {
        id,
        title,
        body,
        metadata: metadata_json.as_ref().map(|j| from_json_string(j)).transpose()?,
        version,
        root_node_id,
        created_at,
        updated_at,
    })
}

/// List all documents (ordered by most recently updated)
pub async fn list_documents(pool: &SqlitePool, pagination: Pagination) -> Result<Vec<DocumentRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT id, title, body, metadata, version, root_node_id, created_at, updated_at
        FROM documents
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
        "#
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_document_row).collect()
}

/// Get document by root node ID
pub async fn get_document_by_root_node(pool: &SqlitePool, root_node_id: &str) -> Result<Option<DocumentRecord>> {
    let row = sqlx::query(
        r#"
        SELECT id, title, body, metadata, version, root_node_id, created_at, updated_at
        FROM documents
        WHERE root_node_id = ?
        LIMIT 1
        "#
    )
    .bind(root_node_id)
    .fetch_optional(pool)
    .await?;

    row.map(|r| parse_document_row(&r)).transpose()
}

/// Update document version and body
pub async fn update_document_version(pool: &SqlitePool, id: &str, new_body: &str, new_version: i64) -> Result<()> {
    let now = now_iso();

    sqlx::query(
        r#"
        UPDATE documents
        SET body = ?, version = ?, updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(new_body)
    .bind(new_version)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Delete a document
pub async fn delete_document(pool: &SqlitePool, id: &str) -> Result<bool> {
    // First delete associated chunks
    sqlx::query("DELETE FROM document_chunks WHERE document_id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    // Then delete the document
    let result = sqlx::query("DELETE FROM documents WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

// ===== Document Chunks =====

/// Get all chunks for a document (ordered by chunk_order)
pub async fn get_document_chunks(pool: &SqlitePool, document_id: &str) -> Result<Vec<DocumentChunkRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT document_id, segment_id, node_id, offset, length, chunk_order, checksum, created_at, updated_at
        FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_order ASC
        "#
    )
    .bind(document_id)
    .fetch_all(pool)
    .await?;

    rows.iter().map(parse_document_chunk_row).collect()
}

/// Parse a document chunk row from the database
fn parse_document_chunk_row(row: &sqlx::sqlite::SqliteRow) -> Result<DocumentChunkRecord> {
    use sqlx::Row;

    let document_id: String = row.try_get("document_id")?;
    let segment_id: String = row.try_get("segment_id")?;
    let node_id: String = row.try_get("node_id")?;
    let offset: i64 = row.try_get("offset")?;
    let length: i64 = row.try_get("length")?;
    let chunk_order: i64 = row.try_get("chunk_order")?;
    let checksum: String = row.try_get("checksum")?;
    let created_at: String = row.try_get("created_at")?;
    let updated_at: String = row.try_get("updated_at")?;

    Ok(DocumentChunkRecord {
        document_id,
        segment_id,
        node_id,
        offset,
        length,
        chunk_order,
        checksum,
        created_at,
        updated_at,
    })
}

/// Get document chunk by node ID
pub async fn get_chunk_by_node_id(pool: &SqlitePool, node_id: &str) -> Result<Option<DocumentChunkRecord>> {
    let row = sqlx::query(
        r#"
        SELECT document_id, segment_id, node_id, offset, length, chunk_order, checksum, created_at, updated_at
        FROM document_chunks
        WHERE node_id = ?
        LIMIT 1
        "#
    )
    .bind(node_id)
    .fetch_optional(pool)
    .await?;

    row.map(|r| parse_document_chunk_row(&r)).transpose()
}

/// Replace all chunks for a document (transactional)
pub async fn replace_document_chunks(pool: &SqlitePool, document_id: &str, chunks: Vec<DocumentChunkRecord>) -> Result<()> {
    // Delete existing chunks
    sqlx::query("DELETE FROM document_chunks WHERE document_id = ?")
        .bind(document_id)
        .execute(pool)
        .await?;

    // Insert new chunks
    for chunk in chunks {
        sqlx::query(
            r#"
            INSERT INTO document_chunks
            (document_id, segment_id, node_id, offset, length, chunk_order, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&chunk.document_id)
        .bind(&chunk.segment_id)
        .bind(&chunk.node_id)
        .bind(chunk.offset)
        .bind(chunk.length)
        .bind(chunk.chunk_order)
        .bind(&chunk.checksum)
        .bind(&chunk.created_at)
        .bind(&chunk.updated_at)
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// Delete chunks for specific node IDs
pub async fn delete_chunks_for_nodes(pool: &SqlitePool, node_ids: &[String]) -> Result<i64> {
    if node_ids.is_empty() {
        return Ok(0);
    }

    // Build query with placeholders
    let placeholders: Vec<String> = (0..node_ids.len()).map(|_| "?".to_string()).collect();
    let query = format!(
        "DELETE FROM document_chunks WHERE node_id IN ({})",
        placeholders.join(", ")
    );

    let mut q = sqlx::query(&query);
    for node_id in node_ids {
        q = q.bind(node_id);
    }

    let result = q.execute(pool).await?;
    Ok(result.rows_affected() as i64)
}

/// Get document for a specific chunk node
pub async fn get_document_for_chunk_node(pool: &SqlitePool, node_id: &str) -> Result<Option<(DocumentRecord, DocumentChunkRecord)>> {
    // First get the chunk mapping
    let chunk = get_chunk_by_node_id(pool, node_id).await?;

    match chunk {
        Some(chunk_record) => {
            // Then get the document
            let doc = get_document_by_id(pool, &chunk_record.document_id).await?;
            Ok(Some((doc, chunk_record)))
        }
        None => Ok(None),
    }
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
    async fn test_upsert_document() {
        let pool = setup_test_db().await;

        let mut metadata = DocumentMetadata::default();
        metadata.chunk_count = Some(3);
        metadata.source = Some("import".to_string());

        let new_doc = NewDocument {
            title: "Test Document".to_string(),
            body: "This is a test document body.".to_string(),
            metadata: Some(metadata),
            root_node_id: Some("root-123".to_string()),
        };

        let inserted = upsert_document(&pool, new_doc).await.unwrap();
        assert_eq!(inserted.title, "Test Document");
        assert_eq!(inserted.version, 1);
        assert!(inserted.metadata.is_some());

        // Verify we can retrieve it
        let fetched = get_document_by_id(&pool, &inserted.id).await.unwrap();
        assert_eq!(fetched.id, inserted.id);
        assert_eq!(fetched.title, "Test Document");
    }

    #[tokio::test]
    async fn test_document_chunks() {
        let pool = setup_test_db().await;

        let new_doc = NewDocument {
            title: "Chunked Doc".to_string(),
            body: "Part 1\n\nPart 2\n\nPart 3".to_string(),
            metadata: None,
            root_node_id: None,
        };

        let doc = upsert_document(&pool, new_doc).await.unwrap();

        // Create chunks
        let chunks = vec![
            DocumentChunkRecord {
                document_id: doc.id.clone(),
                segment_id: "seg-1".to_string(),
                node_id: "node-1".to_string(),
                offset: 0,
                length: 6,
                chunk_order: 0,
                checksum: hash_content("Part 1"),
                created_at: now_iso(),
                updated_at: now_iso(),
            },
            DocumentChunkRecord {
                document_id: doc.id.clone(),
                segment_id: "seg-2".to_string(),
                node_id: "node-2".to_string(),
                offset: 8,
                length: 6,
                chunk_order: 1,
                checksum: hash_content("Part 2"),
                created_at: now_iso(),
                updated_at: now_iso(),
            },
        ];

        replace_document_chunks(&pool, &doc.id, chunks).await.unwrap();

        // Retrieve chunks
        let retrieved = get_document_chunks(&pool, &doc.id).await.unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].chunk_order, 0);
        assert_eq!(retrieved[1].chunk_order, 1);

        // Get chunk by node ID
        let chunk = get_chunk_by_node_id(&pool, "node-1").await.unwrap();
        assert!(chunk.is_some());
        assert_eq!(chunk.unwrap().segment_id, "seg-1");
    }

    #[tokio::test]
    async fn test_update_document_version() {
        let pool = setup_test_db().await;

        let new_doc = NewDocument {
            title: "Versioned Doc".to_string(),
            body: "Version 1".to_string(),
            metadata: None,
            root_node_id: None,
        };

        let doc = upsert_document(&pool, new_doc).await.unwrap();
        assert_eq!(doc.version, 1);

        // Update to version 2
        update_document_version(&pool, &doc.id, "Version 2 body", 2).await.unwrap();

        let updated = get_document_by_id(&pool, &doc.id).await.unwrap();
        assert_eq!(updated.version, 2);
        assert_eq!(updated.body, "Version 2 body");
    }

    #[tokio::test]
    async fn test_delete_document() {
        let pool = setup_test_db().await;

        let new_doc = NewDocument {
            title: "To Delete".to_string(),
            body: "Will be deleted".to_string(),
            metadata: None,
            root_node_id: None,
        };

        let doc = upsert_document(&pool, new_doc).await.unwrap();

        // Add a chunk
        let chunk = DocumentChunkRecord {
            document_id: doc.id.clone(),
            segment_id: "seg-1".to_string(),
            node_id: "node-1".to_string(),
            offset: 0,
            length: 10,
            chunk_order: 0,
            checksum: hash_content("test"),
            created_at: now_iso(),
            updated_at: now_iso(),
        };

        replace_document_chunks(&pool, &doc.id, vec![chunk]).await.unwrap();

        // Delete document (should also delete chunks)
        let deleted = delete_document(&pool, &doc.id).await.unwrap();
        assert!(deleted);

        // Verify document is gone
        let fetch_result = get_document_by_id(&pool, &doc.id).await;
        assert!(fetch_result.is_err());

        // Verify chunks are gone
        let chunks = get_document_chunks(&pool, &doc.id).await.unwrap();
        assert_eq!(chunks.len(), 0);
    }

    #[tokio::test]
    async fn test_get_document_for_chunk_node() {
        let pool = setup_test_db().await;

        let new_doc = NewDocument {
            title: "Doc with Chunks".to_string(),
            body: "Full body".to_string(),
            metadata: None,
            root_node_id: None,
        };

        let doc = upsert_document(&pool, new_doc).await.unwrap();

        let chunk = DocumentChunkRecord {
            document_id: doc.id.clone(),
            segment_id: "seg-1".to_string(),
            node_id: "node-123".to_string(),
            offset: 0,
            length: 9,
            chunk_order: 0,
            checksum: hash_content("Full body"),
            created_at: now_iso(),
            updated_at: now_iso(),
        };

        replace_document_chunks(&pool, &doc.id, vec![chunk]).await.unwrap();

        // Get document via chunk node
        let result = get_document_for_chunk_node(&pool, "node-123").await.unwrap();
        assert!(result.is_some());

        let (fetched_doc, fetched_chunk) = result.unwrap();
        assert_eq!(fetched_doc.id, doc.id);
        assert_eq!(fetched_chunk.node_id, "node-123");
    }
}
