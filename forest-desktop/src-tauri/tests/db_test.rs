use forest_desktop::db::*;
use std::collections::HashMap;

#[tokio::test]
async fn test_full_crud_workflow() {
    // Use in-memory database for testing
    std::env::set_var("FOREST_DB_PATH", ":memory:");

    let db = Database::new().await.expect("Failed to create database");

    // Test 1: Insert a node
    println!("Test 1: Insert a node");
    let mut token_counts = HashMap::new();
    token_counts.insert("rust".to_string(), 5);
    token_counts.insert("tauri".to_string(), 3);

    let new_node = NewNode {
        title: "Test Node 1".to_string(),
        body: "This is a test node about Rust and Tauri".to_string(),
        tags: vec!["rust".to_string(), "tauri".to_string()],
        token_counts: token_counts.clone(),
        embedding: Some(vec![0.1, 0.2, 0.3, 0.4]),
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node1 = db.insert_node(new_node).await.expect("Failed to insert node");
    println!("✓ Inserted node: {} ({})", node1.title, node1.id);
    assert_eq!(node1.title, "Test Node 1");
    assert_eq!(node1.tags.len(), 2);

    // Test 2: Get node by ID (full ID)
    println!("\nTest 2: Get node by ID");
    let fetched = db.get_node_by_id(&node1.id).await.expect("Failed to get node");
    assert_eq!(fetched.id, node1.id);
    assert_eq!(fetched.title, "Test Node 1");
    println!("✓ Retrieved node by full ID");

    // Test 3: Get node by short ID
    println!("\nTest 3: Get node by short ID");
    let short_id = &node1.id[..8];
    let fetched_short = db.get_node_by_id(short_id).await.expect("Failed to get node by short ID");
    assert_eq!(fetched_short.id, node1.id);
    println!("✓ Retrieved node by short ID: {}", short_id);

    // Test 4: Insert another node
    println!("\nTest 4: Insert another node");
    let new_node2 = NewNode {
        title: "Test Node 2".to_string(),
        body: "Another test node".to_string(),
        tags: vec!["test".to_string()],
        token_counts: token_counts.clone(),
        embedding: None,
        is_chunk: false,
        parent_document_id: None,
        chunk_order: None,
    };

    let node2 = db.insert_node(new_node2).await.expect("Failed to insert node 2");
    println!("✓ Inserted node 2: {} ({})", node2.title, node2.id);

    // Test 5: Create an edge
    println!("\nTest 5: Create an edge");
    let new_edge = NewEdge {
        source_id: node1.id.clone(),
        target_id: node2.id.clone(),
        score: 0.75,
        status: EdgeStatus::Suggested,
        edge_type: EdgeType::Semantic,
        metadata: None,
    };

    let edge = db.upsert_edge(new_edge).await.expect("Failed to create edge");
    println!("✓ Created edge: {} <-> {} (score: {})", edge.source_id, edge.target_id, edge.score);
    assert_eq!(edge.score, 0.75);
    assert_eq!(edge.status, EdgeStatus::Suggested);

    // Test 6: List edges
    println!("\nTest 6: List edges");
    let edges = db.list_edges(EdgeFilters::default(), Pagination::default())
        .await
        .expect("Failed to list edges");
    assert_eq!(edges.len(), 1);
    println!("✓ Listed {} edge(s)", edges.len());

    // Test 7: Get edges for a node
    println!("\nTest 7: Get edges for a node");
    let node1_edges = db.get_edges_for_node(&node1.id).await.expect("Failed to get edges for node");
    assert_eq!(node1_edges.len(), 1);
    println!("✓ Node 1 has {} edge(s)", node1_edges.len());

    // Test 8: Update edge (promote to accepted)
    println!("\nTest 8: Promote edge to accepted");
    let updated_edge = NewEdge {
        source_id: node1.id.clone(),
        target_id: node2.id.clone(),
        score: 0.85,
        status: EdgeStatus::Accepted,
        edge_type: EdgeType::Semantic,
        metadata: None,
    };

    let edge2 = db.upsert_edge(updated_edge).await.expect("Failed to update edge");
    assert_eq!(edge2.status, EdgeStatus::Accepted);
    assert_eq!(edge2.score, 0.85);
    println!("✓ Updated edge status to accepted, score: {}", edge2.score);

    // Test 9: Create a document
    println!("\nTest 9: Create a document");
    let mut metadata = DocumentMetadata::default();
    metadata.chunk_count = Some(2);
    metadata.source = Some("import".to_string());

    let new_doc = NewDocument {
        title: "Test Document".to_string(),
        body: "This is a test document.\n\nWith multiple paragraphs.".to_string(),
        metadata: Some(metadata),
        root_node_id: Some(node1.id.clone()),
    };

    let doc = db.upsert_document(new_doc).await.expect("Failed to create document");
    println!("✓ Created document: {} (version {})", doc.title, doc.version);
    assert_eq!(doc.title, "Test Document");
    assert_eq!(doc.version, 1);

    // Test 10: Get stats
    println!("\nTest 10: Get stats");
    let stats = db.get_stats().await.expect("Failed to get stats");
    println!("✓ Database stats:");
    println!("  - Nodes: {}", stats.nodes);
    println!("  - Accepted edges: {}", stats.edges);
    println!("  - Suggested edges: {}", stats.suggested);
    assert_eq!(stats.nodes, 2);
    assert_eq!(stats.edges, 1);
    assert_eq!(stats.suggested, 0);

    // Test 11: Update node
    println!("\nTest 11: Update node");
    let update = UpdateNode {
        title: Some("Updated Title".to_string()),
        ..Default::default()
    };

    let updated_node = db.update_node(&node1.id, update).await.expect("Failed to update node");
    assert_eq!(updated_node.title, "Updated Title");
    println!("✓ Updated node title to: {}", updated_node.title);

    // Test 12: List nodes
    println!("\nTest 12: List nodes");
    let nodes = db.list_nodes(Pagination::default()).await.expect("Failed to list nodes");
    assert_eq!(nodes.len(), 2);
    println!("✓ Listed {} node(s)", nodes.len());

    // Test 13: Delete edge
    println!("\nTest 13: Delete edge");
    let deleted = db.delete_edge(&node1.id, &node2.id).await.expect("Failed to delete edge");
    assert!(deleted);
    println!("✓ Deleted edge");

    // Test 14: Delete node
    println!("\nTest 14: Delete node");
    let result = db.delete_node(&node2.id).await.expect("Failed to delete node");
    assert!(result.node_removed);
    println!("✓ Deleted node (removed {} edges)", result.edges_removed);

    // Final stats
    println!("\nFinal stats:");
    let final_stats = db.get_stats().await.expect("Failed to get final stats");
    println!("  - Nodes: {}", final_stats.nodes);
    println!("  - Accepted edges: {}", final_stats.edges);
    println!("  - Suggested edges: {}", final_stats.suggested);
    assert_eq!(final_stats.nodes, 1);

    db.close().await;
    println!("\n✅ All tests passed!");
}
