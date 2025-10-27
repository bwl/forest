#!/usr/bin/env node

/**
 * WebSocket Test Script
 *
 * Tests the Forest WebSocket implementation by:
 * 1. Connecting to ws://localhost:3000/ws
 * 2. Subscribing to all events
 * 3. Creating a test node via REST API
 * 4. Verifying the WebSocket receives the node:created event
 */

const baseUrl = 'http://localhost:3000/api/v1';
const wsUrl = 'ws://localhost:3000/ws';

// Simple WebSocket client
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.events = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✓ WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('✗ WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('← Received:', JSON.stringify(message, null, 2));
        this.events.push(message);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
      };
    });
  }

  subscribe(eventTypes = []) {
    const msg = {
      type: 'subscribe',
      events: eventTypes,
    };
    console.log('→ Sending:', JSON.stringify(msg, null, 2));
    this.ws.send(JSON.stringify(msg));
  }

  waitForEvent(type, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const event = this.events.find(e => e.type === type);
        if (event) {
          resolve(event);
        } else if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for event: ${type}`));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// REST API client
async function createNode(data) {
  console.log('\n→ Creating node via REST API...');
  const response = await fetch(`${baseUrl}/nodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create node: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('✓ Node created:', result.data.node.id);
  return result;
}

async function deleteNode(nodeId) {
  console.log(`\n→ Deleting node ${nodeId}...`);
  const response = await fetch(`${baseUrl}/nodes/${nodeId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    console.log(`Failed to delete node: ${response.status}`);
  } else {
    console.log('✓ Node deleted');
  }
}

// Main test
async function runTest() {
  console.log('=== WebSocket Test ===\n');

  const client = new WebSocketClient(wsUrl);
  let testNodeId = null;

  try {
    // 1. Connect to WebSocket
    await client.connect();

    // 2. Subscribe to all events
    console.log('\n→ Subscribing to all events...');
    client.subscribe(); // Empty array = all events

    // 3. Wait for subscribed confirmation
    const subscribed = await client.waitForEvent('subscribed', 2000);
    console.log('✓ Subscribed. Session ID:', subscribed.sessionId);

    // 4. Create a test node
    const createResult = await createNode({
      title: 'WebSocket Test Node',
      body: 'This is a test node created to verify WebSocket event delivery.',
      tags: ['test', 'websocket'],
      autoLink: false,
    });

    testNodeId = createResult.data.node.id;

    // 5. Wait for node:created event
    console.log('\n→ Waiting for node:created event...');
    const nodeCreatedEvent = await client.waitForEvent('node:created', 3000);
    console.log('✓ Received node:created event!');

    // 6. Verify event data
    if (nodeCreatedEvent.data.node.id === testNodeId) {
      console.log('✓ Event contains correct node ID');
    } else {
      throw new Error('Event node ID mismatch');
    }

    if (nodeCreatedEvent.data.node.title === 'WebSocket Test Node') {
      console.log('✓ Event contains correct node title');
    } else {
      throw new Error('Event node title mismatch');
    }

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (testNodeId) {
      await deleteNode(testNodeId);
    }
    client.close();
    process.exit(0);
  }
}

// Run the test
runTest();
