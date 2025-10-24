use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use forest_desktop::db::{Database, EdgeStatus, EdgeFilters, Pagination, NewNode, NewEdge};
use forest_desktop::core::{search, text, linking};
use forest_desktop::EMBEDDING_SERVICE;

#[derive(Debug, Serialize, Deserialize)]
pub struct ForestStats {
    pub nodes: i64,
    pub edges: i64,
    pub suggested: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub similarity: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeDetail {
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeConnection {
    pub node_id: String,
    pub title: String,
    pub score: f64,
    pub edge_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCreationResult {
    pub id: String,
    pub title: String,
    pub accepted_edges: usize,
    pub suggested_edges: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EdgeProposal {
    pub edge_id: String,
    pub source_id: String,
    pub source_title: String,
    pub target_id: String,
    pub target_title: String,
    pub score: f64,
}

/// Get graph statistics
#[tauri::command]
pub async fn get_stats() -> Result<ForestStats, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;
    let stats = db.get_stats().await.map_err(|e| e.to_string())?;
    db.close().await;

    Ok(ForestStats {
        nodes: stats.nodes,
        edges: stats.edges,
        suggested: stats.suggested,
    })
}

/// Search nodes using semantic similarity
#[tauri::command]
pub async fn search_nodes(query: String, limit: usize) -> Result<Vec<SearchResult>, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    let results = search::semantic_search(&db, &query, limit)
        .await
        .map_err(|e| e.to_string())?;

    db.close().await;

    // Convert to serializable format for frontend
    let search_results: Vec<SearchResult> = results
        .into_iter()
        .map(|r| SearchResult {
            id: r.node.id,
            title: r.node.title,
            body: r.node.body,
            tags: r.node.tags,
            similarity: r.similarity,
        })
        .collect();

    Ok(search_results)
}

/// Get a single node by ID
#[tauri::command]
pub async fn get_node(id: String) -> Result<NodeDetail, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;
    let node = db.get_node_by_id(&id).await.map_err(|e| e.to_string())?;
    db.close().await;

    Ok(NodeDetail {
        id: node.id,
        title: node.title,
        body: node.body,
        tags: node.tags,
        created_at: node.created_at,
        updated_at: node.updated_at,
    })
}

/// Get connected nodes for a given node
#[tauri::command]
pub async fn get_node_connections(id: String) -> Result<Vec<NodeConnection>, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Get all edges involving this node
    let edges = db.get_edges_for_node(&id).await.map_err(|e| e.to_string())?;

    let mut connections = Vec::new();

    for edge in edges {
        // Only include accepted edges (not suggestions)
        if edge.status != EdgeStatus::Accepted {
            continue;
        }

        // Determine which node is the "other" node
        let other_id = if edge.source_id == id {
            &edge.target_id
        } else {
            &edge.source_id
        };

        // Fetch the other node
        let other_node = db.get_node_by_id(other_id).await.map_err(|e| e.to_string())?;

        connections.push(NodeConnection {
            node_id: other_node.id.clone(),
            title: other_node.title,
            score: edge.score,
            edge_type: format!("{:?}", edge.edge_type),
        });
    }

    db.close().await;
    Ok(connections)
}

/// Create a new node with auto-linking
#[tauri::command]
pub async fn create_node(
    title: String,
    body: String,
    tags: Option<Vec<String>>,
    auto_link: bool,
) -> Result<NodeCreationResult, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Process text
    let token_counts = text::tokenize(&body);

    let final_tags = if let Some(t) = tags {
        t
    } else {
        let full_text = format!("{title}\n{body}");
        text::extract_tags(&full_text, Some(&token_counts), 5)
    };

    // Compute embedding
    let embedding = EMBEDDING_SERVICE.embed_node(&title, &body)
        .await.map_err(|e| e.to_string())?;

    // Create node
    let new_node = NewNode {
        title: title.clone(),
        body: body.clone(),
        tags: final_tags.clone(),
        token_counts,
        embedding,
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
        position_x: None,
        position_y: None,
    };

    let node_record = db.insert_node(new_node).await.map_err(|e| e.to_string())?;

    // Auto-link if requested
    let mut accepted = 0;
    let mut suggested = 0;

    if auto_link {
        let link_result = linking::auto_link_node(&db, &node_record)
            .await.map_err(|e| e.to_string())?;
        accepted = link_result.accepted;
        suggested = link_result.suggested;
    }

    db.close().await;

    Ok(NodeCreationResult {
        id: node_record.id,
        title: node_record.title,
        accepted_edges: accepted,
        suggested_edges: suggested,
    })
}

/// Get edge proposals (suggested edges)
#[tauri::command]
pub async fn get_edge_proposals(limit: usize) -> Result<Vec<EdgeProposal>, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    let filters = EdgeFilters {
        status: Some(EdgeStatus::Suggested),
        ..Default::default()
    };

    let pagination = Pagination {
        limit: limit as i64,
        offset: 0,
    };

    let suggestions = db.list_edges(filters, pagination)
        .await.map_err(|e| e.to_string())?;

    let mut proposals = Vec::new();

    for edge in suggestions {
        let source = db.get_node_by_id(&edge.source_id).await.map_err(|e| e.to_string())?;
        let target = db.get_node_by_id(&edge.target_id).await.map_err(|e| e.to_string())?;

        proposals.push(EdgeProposal {
            edge_id: edge.id,
            source_id: edge.source_id,
            source_title: source.title,
            target_id: edge.target_id,
            target_title: target.title,
            score: edge.score,
        });
    }

    db.close().await;
    Ok(proposals)
}

/// Accept an edge proposal (change status from suggested to accepted)
#[tauri::command]
pub async fn accept_edge(source_id: String, target_id: String) -> Result<(), String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Get the edge
    let edge = db.get_edges_for_node(&source_id)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|e| {
            (e.source_id == source_id && e.target_id == target_id) ||
            (e.source_id == target_id && e.target_id == source_id)
        })
        .ok_or_else(|| "Edge not found".to_string())?;

    // Update edge to accepted status
    let updated_edge = NewEdge {
        source_id: edge.source_id,
        target_id: edge.target_id,
        score: edge.score,
        status: EdgeStatus::Accepted,
        edge_type: edge.edge_type,
        metadata: edge.metadata,
    };

    db.upsert_edge(updated_edge).await.map_err(|e| e.to_string())?;
    db.close().await;
    Ok(())
}

/// Reject an edge proposal (delete it)
#[tauri::command]
pub async fn reject_edge(source_id: String, target_id: String) -> Result<(), String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;
    let deleted = db.delete_edge(&source_id, &target_id)
        .await.map_err(|e| e.to_string())?;

    db.close().await;

    if deleted {
        Ok(())
    } else {
        Err("Edge not found".to_string())
    }
}

// ===== Graph Visualization Commands =====

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub connection_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub score: f64,
}

/// Get all nodes and edges for graph visualization
#[tauri::command]
pub async fn get_graph_data() -> Result<GraphData, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Get all nodes
    let nodes = db.list_nodes(Pagination { limit: 10000, offset: 0 })
        .await.map_err(|e| e.to_string())?;

    // Get all accepted edges
    let edges = db.list_edges(
        EdgeFilters {
            status: Some(EdgeStatus::Accepted),
            ..Default::default()
        },
        Pagination { limit: 10000, offset: 0 }
    )
    .await.map_err(|e| e.to_string())?;

    // Count connections per node
    let mut connection_counts: HashMap<String, usize> = HashMap::new();
    for edge in &edges {
        *connection_counts.entry(edge.source_id.clone()).or_insert(0) += 1;
        *connection_counts.entry(edge.target_id.clone()).or_insert(0) += 1;
    }

    db.close().await;

    Ok(GraphData {
        nodes: nodes.into_iter().map(|n| GraphNode {
            id: n.id.clone(),
            title: n.title,
            tags: n.tags,
            position_x: n.position_x,
            position_y: n.position_y,
            connection_count: *connection_counts.get(&n.id).unwrap_or(&0),
        }).collect(),
        edges: edges.into_iter().map(|e| GraphEdge {
            id: e.id,
            source: e.source_id,
            target: e.target_id,
            score: e.score,
        }).collect(),
    })
}

/// Update node position for graph persistence
#[tauri::command]
pub async fn update_node_position(
    id: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    db.update_node_position(&id, x, y)
        .await
        .map_err(|e| e.to_string())?;

    db.close().await;
    Ok(())
}

/// Update node content (title, body, tags)
#[tauri::command]
pub async fn update_node(
    id: String,
    title: Option<String>,
    body: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Get existing node to fill in any fields not being updated
    let node = db.get_node_by_id(&id)
        .await
        .map_err(|e| e.to_string())?;

    let updated_title = title.unwrap_or(node.title);
    let updated_body = body.unwrap_or(node.body);
    let updated_tags = tags.unwrap_or(node.tags);

    // Recompute token counts and embedding
    let token_counts = text::tokenize(&updated_body);
    let embedding = EMBEDDING_SERVICE.embed_node(&updated_title, &updated_body)
        .await
        .map_err(|e| e.to_string())?;

    // Build update struct
    let update = forest_desktop::db::UpdateNode {
        title: Some(updated_title),
        body: Some(updated_body),
        tags: Some(updated_tags),
        token_counts: Some(token_counts),
        embedding: embedding,  // Already an Option<Vec<f64>>
    };

    // Update in database
    db.update_node(&id, update)
        .await
        .map_err(|e| e.to_string())?;

    db.close().await;
    Ok(())
}

/// Quick node creation from command palette (text only)
#[tauri::command]
pub async fn create_node_quick(text: String) -> Result<NodeCreationResult, String> {
    let db = Database::new().await.map_err(|e| e.to_string())?;

    // Smart title/body split
    let (title, body) = if text.len() <= 80 {
        (text.clone(), text)
    } else {
        let title = text.chars().take(50).collect::<String>() + "...";
        (title, text)
    };

    // Process text
    let token_counts = text::tokenize(&body);
    let tags = text::extract_tags(&body, Some(&token_counts), 5);

    // Embed
    let embedding = EMBEDDING_SERVICE.embed_node(&title, &body)
        .await.map_err(|e| e.to_string())?;

    // Create node
    let new_node = NewNode {
        title: title.clone(),
        body,
        tags,
        token_counts,
        embedding,
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
        position_x: None,
        position_y: None,
    };

    let node_record = db.insert_node(new_node).await.map_err(|e| e.to_string())?;

    // Auto-link
    let link_result = linking::auto_link_node(&db, &node_record)
        .await.map_err(|e| e.to_string())?;

    db.close().await;

    Ok(NodeCreationResult {
        id: node_record.id,
        title: node_record.title,
        accepted_edges: link_result.accepted,
        suggested_edges: link_result.suggested,
    })
}

/// Log a message from the frontend to the terminal
#[tauri::command]
pub fn log_to_terminal(level: String, message: String) {
    match level.as_str() {
        "error" => eprintln!("[FRONTEND ERROR] {}", message),
        "warn" => eprintln!("[FRONTEND WARN] {}", message),
        _ => println!("[FRONTEND] {}", message),
    }
}
