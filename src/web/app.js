/* ============================================
   Forest Web UI — Application
   ============================================ */

// --- Configuration ---
const API_BASE = '/api/v1';

// --- State ---
const state = {
  apiKey: sessionStorage.getItem('forest_api_key') || '',
  authRequired: false,
  currentView: 'dashboard',
  currentNodeId: null,
  currentNodeBodyRaw: '',
  sidebarCollapsed: false,
  nodeBodyView: sessionStorage.getItem('forest_node_body_view') === 'source' ? 'source' : 'rendered',
};

// --- API Client ---
const api = {
  async fetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (state.apiKey) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
    }
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      state.apiKey = '';
      sessionStorage.removeItem('forest_api_key');
      app.showLogin('Session expired. Please reconnect.');
      throw new Error('Unauthorized');
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'API error');
    }
    return json.data;
  },

  // Convenience methods
  stats(top = 10) { return this.fetch(`/stats?top=${top}`); },
  nodes(params = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v != null && v !== '') q.set(k, v); }
    return this.fetch(`/nodes?${q}`);
  },
  node(id) { return this.fetch(`/nodes/${id}?includeBody=true&includeEdges=true&edgesLimit=50`); },
  nodeNeighborhood(id, depth = 1, limit = 100) {
    return this.fetch(`/nodes/${id}/neighborhood?depth=${depth}&limit=${limit}`);
  },
  edges(params = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v != null && v !== '') q.set(k, v); }
    return this.fetch(`/edges?${q}`);
  },
  tags(sort = 'count', order = 'desc') { return this.fetch(`/tags?sort=${sort}&order=${order}`); },
  tagNodes(name, limit = 50, offset = 0) {
    return this.fetch(`/tags/${encodeURIComponent(name)}/nodes?limit=${limit}&offset=${offset}`);
  },
  tagStats(top = 20) { return this.fetch(`/tags/stats?top=${top}`); },
  searchSemantic(q, params = {}) {
    const qs = new URLSearchParams({ q, ...params });
    return this.fetch(`/search/semantic?${qs}`);
  },
  searchMetadata(params = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v != null && v !== '') q.set(k, v); }
    return this.fetch(`/search/metadata?${q}`);
  },
  exportJson(body = false, opts = {}) {
    const params = new URLSearchParams({ body: String(body), edges: 'true' });
    if (opts.minScore) params.set('minScore', opts.minScore);
    if (opts.edgeLimit) params.set('edgeLimit', opts.edgeLimit);
    return this.fetch(`/export/json?${params}`);
  },
  bridges(params = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v != null && v !== '') q.set(k, v); }
    return this.fetch(`/bridges?${q}`);
  },
  documents() { return this.fetch('/documents'); },
  document(id) { return this.fetch(`/documents/${id}`); },
  documentFull(id) { return this.fetch(`/documents/${id}/full`); },
};

// --- Utilities ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function shortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function scoreClass(score) {
  if (score >= 0.6) return 'score-high';
  if (score >= 0.35) return 'score-mid';
  return 'score-low';
}

function formatId(uuid) {
  return uuid ? uuid.substring(0, 8) : '';
}

function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function renderMarkdown(markdownText) {
  const source = markdownText || '';
  const parser = globalThis.marked;
  const sanitizer = globalThis.DOMPurify;

  if (
    parser &&
    typeof parser.parse === 'function' &&
    sanitizer &&
    typeof sanitizer.sanitize === 'function'
  ) {
    const rawHtml = parser.parse(source, { gfm: true, breaks: true });
    return sanitizer.sanitize(rawHtml, { USE_PROFILES: { html: true } });
  }

  return `<pre>${escapeHtml(source)}</pre>`;
}

function renderNodeBody(body, mode) {
  if (mode === 'source') {
    return escapeHtml(body || '');
  }
  return renderMarkdown(body || '');
}

// --- Components ---
const components = {
  loading() {
    return '<div class="loading"><div class="loading-spinner"></div><div>Loading...</div></div>';
  },

  empty(icon, message) {
    return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div>${escapeHtml(message)}</div></div>`;
  },

  tag(name, clickable = true) {
    if (clickable) {
      return `<span class="tag" onclick="app.navigate('tag/${encodeURIComponent(name)}')">#${escapeHtml(name)}</span>`;
    }
    return `<span class="tag">#${escapeHtml(name)}</span>`;
  },

  tags(tagList) {
    if (!tagList || tagList.length === 0) return '';
    return `<div class="tags">${tagList.map(t => components.tag(t)).join('')}</div>`;
  },

  nodeCard(node) {
    const preview = escapeHtml(node.bodyPreview || truncate(node.body, 150));
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title" onclick="app.navigate('node/${node.id}')">${escapeHtml(node.title)}</span>
          <span class="card-id">${escapeHtml(node.shortId)}</span>
        </div>
        ${preview ? `<div class="card-body-preview">${preview}</div>` : ''}
        ${components.tags(node.tags)}
        <div class="card-meta">
          <span>${timeAgo(node.createdAt)}</span>
          ${node.hasEmbedding ? '<span>&#9679; embedded</span>' : ''}
        </div>
      </div>`;
  },

  edgeItem(edge) {
    const connected = edge.connectedNode || {};
    const title = connected.title || 'Unknown';
    const shortId = connected.shortId || '????';
    const score = edge.score != null ? edge.score.toFixed(3) : '?';
    const targetId = connected.id || edge.connectedNodeId;
    const clickAttr = targetId ? ` onclick="app.navigate('node/${targetId}')"` : '';
    return `
      <div class="edge-item"${clickAttr}>
        <div>
          <span class="edge-node-title">${escapeHtml(title)}</span>
          <span class="edge-node-id">${escapeHtml(shortId)}</span>
        </div>
        <span class="edge-score ${scoreClass(edge.score)}">${score}</span>
      </div>`;
  },

  pagination(total, limit, offset, onPage) {
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return '';
    const prevDisabled = offset <= 0 ? 'disabled' : '';
    const nextDisabled = offset + limit >= total ? 'disabled' : '';
    return `
      <div class="pagination">
        <button ${prevDisabled} onclick="${onPage}(${offset - limit})">&#8592; Prev</button>
        <span class="page-info">${page} / ${totalPages} (${total} items)</span>
        <button ${nextDisabled} onclick="${onPage}(${offset + limit})">Next &#8594;</button>
      </div>`;
  },

  barChart(items, maxValue) {
    if (!items || items.length === 0) return '';
    const max = maxValue || Math.max(...items.map(i => i.value));
    return `<div class="bar-chart">${items.map(item => `
      <div class="bar-row" ${item.onclick ? `onclick="${item.onclick}" style="cursor:pointer"` : ''}>
        <span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${max > 0 ? (item.value / max * 100) : 0}%"></div>
        </div>
        <span class="bar-value">${item.value}</span>
      </div>`).join('')}</div>`;
  },
};

// --- Views ---
const views = {
  // ---- Dashboard ----
  async dashboard() {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    try {
      const data = await api.stats(15);

      content.innerHTML = `
        <div class="view-header">
          <h1 class="view-title">Dashboard</h1>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.nodes.total}</div>
            <div class="stat-label">Nodes</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.edges.total}</div>
            <div class="stat-label">Edges</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.tags.total}</div>
            <div class="stat-label">Tag Usages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.degree.avg?.toFixed(3) || '0'}</div>
            <div class="stat-label">Avg Degree</div>
          </div>
        </div>

        <div class="two-col">
          <div>
            <div class="section-header">
              <span class="section-title">Recent Nodes</span>
              <a href="#nodes" class="section-subtitle">View all &#8594;</a>
            </div>
            <div id="dashboard-recent"></div>
          </div>
          <div>
            <div class="section-header">
              <span class="section-title">Top Tags</span>
              <a href="#tags" class="section-subtitle">View all &#8594;</a>
            </div>
            <div id="dashboard-tags"></div>

            ${data.highDegreeNodes && data.highDegreeNodes.length > 0 ? `
              <div class="section-header" style="margin-top:24px">
                <span class="section-title">Hub Nodes</span>
              </div>
              <div id="dashboard-hubs"></div>
            ` : ''}
          </div>
        </div>
      `;

      // Recent nodes
      const recentEl = document.getElementById('dashboard-recent');
      if (data.nodes.recent && data.nodes.recent.length > 0) {
        recentEl.innerHTML = data.nodes.recent.map(n => `
          <div class="edge-item" onclick="app.navigate('node/${n.id}')">
            <span class="edge-node-title">${escapeHtml(n.title)}</span>
            <span style="font-size:12px;color:var(--text-tertiary)">${timeAgo(n.createdAt)}</span>
          </div>`).join('');
      } else {
        recentEl.innerHTML = components.empty('&#9673;', 'No nodes yet');
      }

      // Top tags bar chart
      const tagsEl = document.getElementById('dashboard-tags');
      if (data.tags.topTags && data.tags.topTags.length > 0) {
        tagsEl.innerHTML = components.barChart(
          data.tags.topTags.slice(0, 10).map(t => ({
            label: '#' + t.name,
            value: t.count,
            onclick: `app.navigate('tag/${encodeURIComponent(t.name)}')`,
          }))
        );
      } else {
        tagsEl.innerHTML = components.empty('#', 'No tags yet');
      }

      // Hub nodes
      const hubsEl = document.getElementById('dashboard-hubs');
      if (hubsEl && data.highDegreeNodes) {
        hubsEl.innerHTML = data.highDegreeNodes.slice(0, 5).map(n => `
          <div class="edge-item" onclick="app.navigate('node/${n.id}')">
            <span class="edge-node-title">${escapeHtml(n.title)}</span>
            <span class="edge-score score-high">${n.edgeCount} edges</span>
          </div>`).join('');
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load dashboard: ' + err.message);
    }
  },

  // ---- Nodes ----
  async nodes(params = {}) {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    const limit = 20;
    const offset = parseInt(params.offset) || 0;
    const search = params.search || '';
    const tags = params.tags || '';
    const sort = params.sort || 'created';
    const order = params.order || 'desc';

    try {
      const data = await api.nodes({ limit, offset, search, tags, sort, order });

      content.innerHTML = `
        <div class="view-header">
          <h1 class="view-title">Nodes</h1>
        </div>

        <div class="filters-bar">
          <input type="text" id="nodes-search" placeholder="Filter by text..." value="${escapeHtml(search)}" style="flex:1;min-width:200px">
          <input type="text" id="nodes-tags" placeholder="Filter by tags (comma-separated)" value="${escapeHtml(tags)}" style="min-width:200px">
          <select id="nodes-sort">
            <option value="created" ${sort === 'created' ? 'selected' : ''}>Created</option>
            <option value="updated" ${sort === 'updated' ? 'selected' : ''}>Updated</option>
            <option value="title" ${sort === 'title' ? 'selected' : ''}>Title</option>
          </select>
          <select id="nodes-order">
            <option value="desc" ${order === 'desc' ? 'selected' : ''}>Newest</option>
            <option value="asc" ${order === 'asc' ? 'selected' : ''}>Oldest</option>
          </select>
          <button class="btn btn-sm btn-secondary" onclick="views._applyNodeFilters()">Apply</button>
        </div>

        <div id="nodes-list"></div>
        <div id="nodes-pagination"></div>
      `;

      // Enter key in filters
      ['nodes-search', 'nodes-tags'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
          if (e.key === 'Enter') views._applyNodeFilters();
        });
      });

      const listEl = document.getElementById('nodes-list');
      const pagEl = document.getElementById('nodes-pagination');

      if (data.nodes && data.nodes.length > 0) {
        listEl.innerHTML = data.nodes.map(n => components.nodeCard(n)).join('');
        pagEl.innerHTML = components.pagination(
          data.pagination.total, data.pagination.limit, data.pagination.offset,
          'views._nodesPage'
        );
      } else {
        listEl.innerHTML = components.empty('&#9673;', 'No nodes found');
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load nodes: ' + err.message);
    }
  },

  _applyNodeFilters() {
    const search = document.getElementById('nodes-search')?.value || '';
    const tags = document.getElementById('nodes-tags')?.value || '';
    const sort = document.getElementById('nodes-sort')?.value || 'created';
    const order = document.getElementById('nodes-order')?.value || 'desc';
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tags) params.set('tags', tags);
    if (sort !== 'created') params.set('sort', sort);
    if (order !== 'desc') params.set('order', order);
    const qs = params.toString();
    location.hash = 'nodes' + (qs ? '?' + qs : '');
  },

  _nodesPage(offset) {
    const search = document.getElementById('nodes-search')?.value || '';
    const tags = document.getElementById('nodes-tags')?.value || '';
    const sort = document.getElementById('nodes-sort')?.value || 'created';
    const order = document.getElementById('nodes-order')?.value || 'desc';
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tags) params.set('tags', tags);
    if (sort !== 'created') params.set('sort', sort);
    if (order !== 'desc') params.set('order', order);
    if (offset > 0) params.set('offset', offset);
    const qs = params.toString();
    location.hash = 'nodes' + (qs ? '?' + qs : '');
  },

  // ---- Node Detail ----
  async nodeDetail(id) {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    try {
      const data = await api.node(id);
      const node = data.node;
      state.currentNodeId = node.id;
      state.currentNodeBodyRaw = node.body || '';
      const edges = [...(data.edges || [])].sort((a, b) => {
        const scoreA = Number.isFinite(a?.score) ? a.score : -Infinity;
        const scoreB = Number.isFinite(b?.score) ? b.score : -Infinity;
        return scoreB - scoreA;
      });

      const chunkBanner = node.isChunk && node.parentDocumentId
        ? `<div class="chunk-banner">
            <span>Part of a document${node.chunkOrder != null ? ` (chunk ${node.chunkOrder + 1})` : ''}</span>
            <a href="#document/${node.parentDocumentId}">View full document &#8594;</a>
          </div>`
        : '';

      content.innerHTML = `
        <div class="back-link" onclick="history.back()">&#8592; Back</div>

        ${chunkBanner}

        <div class="detail-header">
          <div class="detail-title">${escapeHtml(node.title)}</div>
          <div class="detail-meta">
            <span class="detail-meta-item"><span class="card-id">${escapeHtml(node.shortId)}</span></span>
            <span class="detail-meta-item">Created ${shortDate(node.createdAt)}</span>
            <span class="detail-meta-item">Updated ${timeAgo(node.updatedAt)}</span>
            ${node.bodyLength ? `<span class="detail-meta-item">${node.bodyLength} chars</span>` : ''}
            ${node.hasEmbedding ? '<span class="detail-meta-item">&#9679; embedded</span>' : ''}
          </div>
          ${components.tags(node.tags)}
        </div>

        <div class="section-header">
          <span class="section-title">Content</span>
          <div class="view-toggle">
            <button
              class="btn btn-sm btn-secondary ${state.nodeBodyView === 'rendered' ? 'active' : ''}"
              id="node-body-toggle-rendered"
              onclick="app.setNodeBodyView('rendered')"
            >Rendered</button>
            <button
              class="btn btn-sm btn-secondary ${state.nodeBodyView === 'source' ? 'active' : ''}"
              id="node-body-toggle-source"
              onclick="app.setNodeBodyView('source')"
            >Source</button>
          </div>
        </div>
        <div class="detail-body ${state.nodeBodyView === 'source' ? 'detail-body-source' : ''}" id="node-body">${renderNodeBody(node.body || '', state.nodeBodyView)}</div>

        ${edges.length > 0 ? `
          <div class="two-col">
            <div>
              <div class="section-header">
                <span class="section-title">Connected Nodes (${edges.length}${data.edgesTotal > edges.length ? ' of ' + data.edgesTotal : ''})</span>
              </div>
              <div class="edge-list">
                ${edges.map(e => components.edgeItem(e)).join('')}
              </div>
            </div>
            <div>
              <div class="section-header">
                <span class="section-title">Neighborhood</span>
                <button class="btn btn-sm btn-secondary" onclick="app.navigate('graph?focus=${node.id}')">Open in Graph &#8594;</button>
              </div>
              <div class="mini-graph" id="mini-graph"></div>
            </div>
          </div>
        ` : `
          <div class="section-header">
            <span class="section-title">Connected Nodes</span>
          </div>
          ${components.empty('&#11043;', 'No connections yet')}
        `}

        ${node.metadata ? `
          <div class="section-header" style="margin-top:24px">
            <span class="section-title">Metadata</span>
          </div>
          <div class="card" style="font-family:var(--font-mono);font-size:12px;white-space:pre-wrap;color:var(--text-secondary)">${escapeHtml(JSON.stringify(node.metadata, null, 2))}</div>
        ` : ''}
      `;

      // Render mini neighborhood graph
      if (edges.length > 0) {
        try {
          const neighborhood = await api.nodeNeighborhood(id, 1, 50);
          graphRenderer.renderMini('mini-graph', neighborhood, id);
        } catch (e) {
          // Not critical - graph is bonus
          const mg = document.getElementById('mini-graph');
          if (mg) mg.innerHTML = `<div class="empty-state" style="padding:20px"><div style="color:var(--text-tertiary)">Graph unavailable</div></div>`;
        }
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load node: ' + err.message);
    }
  },

  // ---- Graph ----
  async graph(params = {}) {
    const content = document.getElementById('content');
    const focusId = params.focus || '';

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Graph</h1>
      </div>
      <div class="filters-bar">
        <input type="text" id="graph-focus" placeholder="Focus on node ID..." value="${escapeHtml(focusId)}" style="width:280px">
        <select id="graph-depth">
          <option value="1">Depth 1</option>
          <option value="2" selected>Depth 2</option>
          <option value="3">Depth 3</option>
        </select>
        <button class="btn btn-sm btn-secondary" onclick="views._loadGraph()">Load</button>
        <button class="btn btn-sm btn-secondary" onclick="views._loadDocumentGraph()">Documents</button>
        <button class="btn btn-sm btn-secondary" onclick="views._loadCrossLinkGraph()">Cross-links</button>
      </div>
      <div class="graph-container" id="main-graph" style="height:calc(100vh - 200px)">
        <div class="graph-controls">
          <button onclick="graphRenderer.zoomIn()">+</button>
          <button onclick="graphRenderer.zoomOut()">-</button>
          <button onclick="graphRenderer.resetZoom()">Reset</button>
        </div>
        <div class="graph-tooltip" id="graph-tooltip"></div>
        <div class="graph-info" id="graph-info"></div>
        ${components.loading()}
      </div>
    `;

    if (focusId) {
      views._loadGraph();
    } else {
      views._loadDocumentGraph();
    }
  },

  async _loadGraph() {
    const focusId = document.getElementById('graph-focus')?.value?.trim();
    const depth = parseInt(document.getElementById('graph-depth')?.value) || 2;
    if (!focusId) {
      views._loadFullGraph();
      return;
    }
    try {
      const data = await api.nodeNeighborhood(focusId, depth, 150);
      graphRenderer.render('main-graph', data, focusId);
    } catch (err) {
      const el = document.getElementById('main-graph');
      if (el) el.innerHTML = components.empty('&#9888;', 'Failed to load graph: ' + err.message);
    }
  },

  async _loadFullGraph() {
    try {
      // Request only high-score edges from the server to avoid 500K+ edge payloads
      const data = await api.exportJson(false, { minScore: 0.65, edgeLimit: 15000 });
      const allNodes = (data.nodes || []);

      // Convert export format to neighborhood format
      const graphData = {
        nodes: allNodes.map(n => ({
          id: n.id,
          shortId: n.shortId,
          title: n.title,
          tags: n.tags || [],
          depth: 0,
          parentDocumentId: n.parentDocumentId || null,
        })),
        edges: (data.edges || []).map(e => ({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          score: e.score,
          edgeType: e.edgeType || 'semantic',
        })),
      };

      // Filter edges to only include nodes in our set
      const nodeIds = new Set(graphData.nodes.map(n => n.id));
      graphData.edges = graphData.edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

      // Keep top-K edges per node (max 5 per node) for a readable graph
      const MAX_EDGES_PER_NODE = 5;
      const edgesByNode = {};
      // Sort all edges by score descending
      graphData.edges.sort((a, b) => b.score - a.score);
      const keptEdges = [];
      for (const e of graphData.edges) {
        // Always keep structural edges (parent-child, sequential)
        const isStructural = e.edgeType === 'parent-child' || e.edgeType === 'sequential';
        const srcCount = edgesByNode[e.sourceId] || 0;
        const tgtCount = edgesByNode[e.targetId] || 0;
        if (isStructural || (srcCount < MAX_EDGES_PER_NODE && tgtCount < MAX_EDGES_PER_NODE)) {
          keptEdges.push(e);
          edgesByNode[e.sourceId] = srcCount + 1;
          edgesByNode[e.targetId] = tgtCount + 1;
        }
      }
      graphData.edges = keptEdges;

      graphRenderer.render('main-graph', graphData, null);
    } catch (err) {
      const el = document.getElementById('main-graph');
      if (el) el.innerHTML = components.empty('&#9888;', 'Failed to load graph: ' + err.message);
    }
  },

  // Document-level overview: one node per document, edges = aggregated cross-doc links
  async _loadDocumentGraph() {
    try {
      const data = await api.exportJson(false, { minScore: 0.6, edgeLimit: 30000 });
      const allNodes = data.nodes || [];
      const allEdges = data.edges || [];

      // Build doc membership: nodeId → docId (parentDocumentId or self for roots)
      const nodeDocMap = {};
      const docNodes = {};  // docId → root node info
      for (const n of allNodes) {
        const docId = n.parentDocumentId || n.id;
        nodeDocMap[n.id] = docId;
        if (!n.parentDocumentId) {
          // This is a root node or standalone
          docNodes[n.id] = n;
        }
      }

      // Count chunks per document
      const docChunkCount = {};
      for (const n of allNodes) {
        const docId = nodeDocMap[n.id];
        docChunkCount[docId] = (docChunkCount[docId] || 0) + 1;
      }

      // Aggregate edges across documents
      const crossDocEdges = {};  // "docA::docB" → { count, maxScore, totalScore }
      for (const e of allEdges) {
        const srcDoc = nodeDocMap[e.sourceId];
        const tgtDoc = nodeDocMap[e.targetId];
        if (!srcDoc || !tgtDoc || srcDoc === tgtDoc) continue;  // skip intra-doc
        const key = srcDoc < tgtDoc ? `${srcDoc}::${tgtDoc}` : `${tgtDoc}::${srcDoc}`;
        if (!crossDocEdges[key]) {
          crossDocEdges[key] = { srcDoc: srcDoc < tgtDoc ? srcDoc : tgtDoc, tgtDoc: srcDoc < tgtDoc ? tgtDoc : srcDoc, count: 0, maxScore: 0, totalScore: 0 };
        }
        crossDocEdges[key].count++;
        crossDocEdges[key].maxScore = Math.max(crossDocEdges[key].maxScore, e.score);
        crossDocEdges[key].totalScore += e.score;
      }

      // Build graph data with only document-level nodes
      const graphData = {
        nodes: Object.values(docNodes).map(n => ({
          id: n.id,
          shortId: (n.id || '').substring(0, 8),
          title: n.title,
          tags: n.tags || [],
          depth: 0,
          parentDocumentId: null,
          chunkCount: docChunkCount[n.id] || 1,
        })),
        edges: Object.values(crossDocEdges)
          .filter(e => e.count >= 3)  // only show docs with 3+ cross-links
          .map(e => ({
            sourceId: e.srcDoc,
            targetId: e.tgtDoc,
            score: e.maxScore,
            count: e.count,
            avgScore: e.totalScore / e.count,
          })),
      };

      graphRenderer.render('main-graph', graphData, null);
    } catch (err) {
      const el = document.getElementById('main-graph');
      if (el) el.innerHTML = components.empty('&#9888;', 'Failed to load graph: ' + err.message);
    }
  },

  // Cross-link view: only chunks that connect to a different document
  async _loadCrossLinkGraph() {
    try {
      const data = await api.exportJson(false, { minScore: 0.7, edgeLimit: 20000 });
      const allNodes = data.nodes || [];
      const allEdges = data.edges || [];

      // Build doc membership
      const nodeDocMap = {};
      for (const n of allNodes) {
        nodeDocMap[n.id] = n.parentDocumentId || n.id;
      }

      // Find cross-document edges only
      const crossEdges = allEdges.filter(e => {
        const srcDoc = nodeDocMap[e.sourceId];
        const tgtDoc = nodeDocMap[e.targetId];
        return srcDoc && tgtDoc && srcDoc !== tgtDoc;
      });

      // Keep only top 3 cross-doc edges per node
      crossEdges.sort((a, b) => b.score - a.score);
      const perNode = {};
      const keptEdges = [];
      for (const e of crossEdges) {
        const sc = perNode[e.sourceId] || 0;
        const tc = perNode[e.targetId] || 0;
        if (sc < 3 && tc < 3) {
          keptEdges.push(e);
          perNode[e.sourceId] = sc + 1;
          perNode[e.targetId] = tc + 1;
        }
      }

      // Only include nodes that appear in kept edges
      const usedIds = new Set();
      keptEdges.forEach(e => { usedIds.add(e.sourceId); usedIds.add(e.targetId); });

      const nodeMap = {};
      allNodes.forEach(n => { nodeMap[n.id] = n; });

      const graphData = {
        nodes: [...usedIds].map(id => {
          const n = nodeMap[id] || { id, title: id, tags: [] };
          return {
            id: n.id,
            shortId: (n.id || '').substring(0, 8),
            title: n.title,
            tags: n.tags || [],
            depth: 0,
            parentDocumentId: n.parentDocumentId || null,
          };
        }),
        edges: keptEdges.map(e => ({
          sourceId: e.sourceId,
          targetId: e.targetId,
          score: e.score,
        })),
      };

      graphRenderer.render('main-graph', graphData, null);
    } catch (err) {
      const el = document.getElementById('main-graph');
      if (el) el.innerHTML = components.empty('&#9888;', 'Failed to load graph: ' + err.message);
    }
  },

  // ---- Tags ----
  async tagsView() {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    try {
      const [tagsData, statsData] = await Promise.all([
        api.tags('count', 'desc'),
        api.tagStats(20),
      ]);

      content.innerHTML = `
        <div class="view-header">
          <h1 class="view-title">Tags</h1>
          <span class="section-subtitle">${tagsData.total} tags</span>
        </div>

        <div class="two-col">
          <div>
            <div class="section-header">
              <span class="section-title">All Tags</span>
            </div>
            <div class="tag-cloud" id="tag-cloud"></div>
          </div>
          <div>
            <div class="section-header">
              <span class="section-title">Top Tags</span>
            </div>
            <div id="tags-chart"></div>

            ${statsData.coOccurrences && statsData.coOccurrences.length > 0 ? `
              <div class="section-header" style="margin-top:24px">
                <span class="section-title">Co-occurrences</span>
              </div>
              <div id="tags-pairs"></div>
            ` : ''}
          </div>
        </div>
      `;

      // Tag cloud
      const cloudEl = document.getElementById('tag-cloud');
      if (tagsData.tags && tagsData.tags.length > 0) {
        cloudEl.innerHTML = tagsData.tags.map(t =>
          `<span class="tag-cloud-item" onclick="app.navigate('tag/${encodeURIComponent(t.name)}')">
            #${escapeHtml(t.name)}<span class="tag-count">${t.count}</span>
          </span>`
        ).join('');
      } else {
        cloudEl.innerHTML = components.empty('#', 'No tags yet');
      }

      // Bar chart
      const chartEl = document.getElementById('tags-chart');
      if (statsData.topTags && statsData.topTags.length > 0) {
        chartEl.innerHTML = components.barChart(
          statsData.topTags.map(t => ({
            label: '#' + t.name,
            value: t.count,
            onclick: `app.navigate('tag/${encodeURIComponent(t.name)}')`,
          }))
        );
      }

      // Co-occurrences
      const pairsEl = document.getElementById('tags-pairs');
      if (pairsEl && statsData.coOccurrences) {
        pairsEl.innerHTML = `<div class="pair-list">${statsData.coOccurrences.slice(0, 15).map(p => `
          <div class="pair-item">
            <div class="pair-tags">
              ${components.tag(p.pair[0])}
              ${components.tag(p.pair[1])}
            </div>
            <span class="pair-count">${p.count}</span>
          </div>`).join('')}</div>`;
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load tags: ' + err.message);
    }
  },

  // ---- Tag Detail ----
  async tagDetail(tagName, params = {}) {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    const limit = 20;
    const offset = parseInt(params.offset) || 0;

    try {
      const data = await api.tagNodes(tagName, limit, offset);

      content.innerHTML = `
        <div class="back-link" onclick="app.navigate('tags')">&#8592; All Tags</div>
        <div class="view-header">
          <h1 class="view-title">#${escapeHtml(data.tag)}</h1>
          <span class="section-subtitle">${data.pagination.total} nodes</span>
        </div>
        <div id="tag-nodes"></div>
        <div id="tag-pagination"></div>
      `;

      const listEl = document.getElementById('tag-nodes');
      const pagEl = document.getElementById('tag-pagination');

      if (data.nodes && data.nodes.length > 0) {
        listEl.innerHTML = data.nodes.map(n => components.nodeCard(n)).join('');
        pagEl.innerHTML = components.pagination(
          data.pagination.total, data.pagination.limit, data.pagination.offset,
          `(function(o){location.hash='tag/${encodeURIComponent(tagName)}?offset='+o})`
        );
      } else {
        listEl.innerHTML = components.empty('&#9673;', 'No nodes with this tag');
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load tag: ' + err.message);
    }
  },

  // ---- Bridges ----
  async bridges(params = {}) {
    const content = document.getElementById('content');
    const limit = parseInt(params.limit) || 20;

    content.innerHTML = `
      <div class="view-header">
        <h2>Bridge Nodes</h2>
        <p class="view-subtitle">Passages that connect across different documents</p>
      </div>
      <div id="bridges-list" class="node-list">
        ${components.loading()}
      </div>`;

    try {
      const data = await api.bridges({ limit });
      const listEl = document.getElementById('bridges-list');

      if (data.bridges.length === 0) {
        listEl.innerHTML = components.empty('\u21F5', 'No cross-document bridges found. Import multiple documents to discover connections.');
        return;
      }

      listEl.innerHTML = data.bridges.map((bridge, i) => {
        const shortId = formatId(bridge.nodeId);
        const docLabel = bridge.documentTitle ? escapeHtml(bridge.documentTitle) : 'standalone';
        const connections = (bridge.topConnections || []).map(conn => {
          const connDoc = conn.documentTitle ? escapeHtml(conn.documentTitle) : '';
          return `<div class="bridge-connection">
            <span class="score-badge ${scoreClass(conn.score)}">${conn.score.toFixed(2)}</span>
            <a href="#node/${conn.nodeId}" class="bridge-link">${escapeHtml(truncate(conn.nodeTitle, 60))}</a>
            ${connDoc ? `<span class="bridge-doc-label">${connDoc}</span>` : ''}
          </div>`;
        }).join('');

        return `
          <div class="card bridge-card">
            <div class="bridge-header">
              <span class="bridge-rank">${i + 1}</span>
              <a href="#node/${bridge.nodeId}" class="bridge-title">${escapeHtml(truncate(bridge.nodeTitle, 80))}</a>
              <code class="mono">${shortId}</code>
            </div>
            <div class="bridge-meta">
              <span class="bridge-doc-label">${docLabel}</span>
              <span class="bridge-stat">\u2194 ${bridge.connectedDocCount} docs</span>
              <span class="bridge-stat">${bridge.crossDocDegree} cross-links</span>
              <span class="score-badge ${scoreClass(bridge.maxScore)}">best: ${bridge.maxScore.toFixed(2)}</span>
            </div>
            ${connections ? `<div class="bridge-connections">${connections}</div>` : ''}
          </div>`;
      }).join('');
    } catch (err) {
      content.innerHTML = components.empty('\u26A0', 'Failed to load bridges: ' + err.message);
    }
  },

  // ---- Search ----
  async search(params = {}) {
    const content = document.getElementById('content');
    const q = params.q || '';
    const mode = params.mode || 'semantic';

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Search</h1>
      </div>
      <div class="filters-bar">
        <input type="text" id="search-query" placeholder="Search query..." value="${escapeHtml(q)}" style="flex:1;min-width:250px">
        <select id="search-mode">
          <option value="semantic" ${mode === 'semantic' ? 'selected' : ''}>Semantic</option>
          <option value="metadata" ${mode === 'metadata' ? 'selected' : ''}>Metadata</option>
        </select>
        <button class="btn btn-sm" onclick="views._doSearch()">Search</button>
      </div>
      <div id="search-results">
        ${q ? components.loading() : components.empty('&#8981;', 'Enter a query to search')}
      </div>
    `;

    document.getElementById('search-query')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') views._doSearch();
    });

    if (q) {
      views._executeSearch(q, mode);
    }
  },

  _doSearch() {
    const q = document.getElementById('search-query')?.value?.trim() || '';
    const mode = document.getElementById('search-mode')?.value || 'semantic';
    if (!q) return;
    location.hash = `search?q=${encodeURIComponent(q)}&mode=${mode}`;
  },

  // ---- Documents List ----
  async documentsView() {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    try {
      const data = await api.documents();

      content.innerHTML = `
        <div class="view-header">
          <h1 class="view-title">Documents</h1>
          <span class="section-subtitle">${data.count} documents</span>
        </div>
        <div id="documents-list"></div>
      `;

      const listEl = document.getElementById('documents-list');

      if (data.documents && data.documents.length > 0) {
        listEl.innerHTML = data.documents.map(doc => {
          const meta = doc.metadata || {};
          const strategy = meta.chunkStrategy || 'unknown';
          const chunkCount = meta.chunkCount || '?';
          return `
            <div class="card" style="cursor:pointer" onclick="app.navigate('document/${doc.id}')">
              <div class="card-header">
                <span class="card-title">${escapeHtml(doc.title)}</span>
                <span class="card-id">${escapeHtml(formatId(doc.id))}</span>
              </div>
              <div class="card-meta">
                <span>${chunkCount} chunks</span>
                <span>${strategy}</span>
                <span>${shortDate(doc.createdAt)}</span>
              </div>
            </div>`;
        }).join('');
      } else {
        listEl.innerHTML = components.empty('&#9776;', 'No documents imported yet');
      }
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load documents: ' + err.message);
    }
  },

  // ---- Document Reader ----
  async documentReader(id) {
    const content = document.getElementById('content');
    content.innerHTML = components.loading();

    try {
      const data = await api.documentFull(id);
      const doc = data.document;
      const chunks = data.chunks || [];

      // Split document body by chunk boundaries
      const bodyText = doc.body || '';

      content.innerHTML = `
        <div class="back-link" onclick="app.navigate('documents')">&#8592; All Documents</div>

        <div class="detail-header">
          <div class="detail-title">${escapeHtml(doc.title)}</div>
          <div class="detail-meta">
            <span class="detail-meta-item"><span class="card-id">${escapeHtml(formatId(doc.id))}</span></span>
            <span class="detail-meta-item">${chunks.length} chunks</span>
            <span class="detail-meta-item">Created ${shortDate(doc.createdAt)}</span>
            <span class="detail-meta-item">v${doc.version}</span>
          </div>
        </div>

        ${chunks.length > 1 ? `
          <div class="chunk-index">
            <div class="chunk-index-title">Sections</div>
            <div class="chunk-index-list">
              ${chunks.map((c, i) => `
                <div class="chunk-index-item" onclick="document.getElementById('chunk-${i}').scrollIntoView({behavior:'smooth',block:'start'})">
                  <span class="chunk-index-num">${i + 1}.</span>
                  <span>${escapeHtml(c.title)}</span>
                </div>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="document-reader">
          ${chunks.map((c, i) => {
            const chunkBody = bodyText.substring(c.offset, c.offset + c.length);
            return `
              <div class="chunk-boundary" id="chunk-${i}">
                <div class="chunk-boundary-label">
                  <span>Chunk ${i + 1} of ${chunks.length}</span>
                  <a href="#node/${c.nodeId}" onclick="event.stopPropagation()">${escapeHtml(c.shortId)}</a>
                </div>
                <div class="chunk-content">${escapeHtml(chunkBody)}</div>
              </div>`;
          }).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = components.empty('&#9888;', 'Failed to load document: ' + err.message);
    }
  },

  async _executeSearch(q, mode) {
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = components.loading();

    try {
      let results;
      if (mode === 'semantic') {
        const data = await api.searchSemantic(q, { limit: 30 });
        results = (data.nodes || []).map(n => ({ ...n, score: n.similarity }));
      } else {
        const data = await api.searchMetadata({ term: q, limit: 30 });
        results = data.matches || [];
      }

      if (results.length === 0) {
        resultsEl.innerHTML = components.empty('&#8981;', 'No results found');
        return;
      }

      resultsEl.innerHTML = results.map(n => `
        <div class="search-result" onclick="app.navigate('node/${n.id}')">
          <div class="search-result-header">
            <span class="search-result-title">${escapeHtml(n.title)}</span>
            ${n.score != null ? `<span class="search-result-score ${scoreClass(n.score)}">${n.score.toFixed(3)}</span>` : ''}
          </div>
          <div class="search-result-body">${escapeHtml(n.bodyPreview || truncate(n.body, 200))}</div>
          ${components.tags(n.tags)}
        </div>
      `).join('');
    } catch (err) {
      resultsEl.innerHTML = components.empty('&#9888;', 'Search failed: ' + err.message);
    }
  },
};

// --- Graph Renderer (D3) ---
const graphRenderer = {
  simulation: null,
  svg: null,
  zoom: null,
  container: null,

  render(containerId, data, focusNodeId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous
    const existingSvg = container.querySelector('svg');
    if (existingSvg) existingSvg.remove();
    if (this.simulation) this.simulation.stop();

    // Keep controls and tooltip
    const controls = container.querySelector('.graph-controls');
    const tooltip = container.querySelector('.graph-tooltip');
    const info = container.querySelector('.graph-info');

    // Remove loading spinner
    const loading = container.querySelector('.loading');
    if (loading) loading.remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!data.nodes || data.nodes.length === 0) {
      container.innerHTML = components.empty('&#11043;', 'No nodes to display');
      return;
    }

    // Re-add controls
    if (controls) container.appendChild(controls);
    if (tooltip) container.appendChild(tooltip);
    if (info) container.appendChild(info);

    // Build D3 data
    const nodes = data.nodes.map(n => ({
      id: n.id,
      shortId: n.shortId,
      title: n.title,
      tags: n.tags || [],
      depth: n.depth ?? 0,
      isFocus: n.id === focusNodeId,
      parentDocumentId: n.parentDocumentId || null,
    }));

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const links = (data.edges || [])
      .filter(e => nodeIdSet.has(e.sourceId || e.source) && nodeIdSet.has(e.targetId || e.target))
      .map(e => ({
        source: e.sourceId || e.source,
        target: e.targetId || e.target,
        score: e.score || 0,
      }));

    // Degree calculation
    const degreeMap = {};
    links.forEach(l => {
      degreeMap[l.source] = (degreeMap[l.source] || 0) + 1;
      degreeMap[l.target] = (degreeMap[l.target] || 0) + 1;
    });
    nodes.forEach(n => { n.degree = degreeMap[n.id] || 0; });

    // Document color mapping — chunks from the same document share a color
    const docColors = {};
    const colorPalette = [
      '#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff',
      '#39d353', '#f0883e', '#db61a2', '#79c0ff', '#56d364',
      '#e3b341', '#ff7b72', '#d2a8ff', '#7ee787', '#ffa657',
    ];
    let colorIdx = 0;
    nodes.forEach(n => {
      // Group by document: use parentDocumentId for chunks, own id for root/standalone nodes
      const docKey = n.parentDocumentId || n.id;
      if (!docColors[docKey]) {
        docColors[docKey] = colorPalette[colorIdx % colorPalette.length];
        colorIdx++;
      }
      n._docKey = docKey;
    });

    // Standalone nodes (not part of any document) that each got a unique color
    // should fall back to neutral gray to avoid wasting palette slots
    const docKeyCounts = {};
    nodes.forEach(n => { docKeyCounts[n._docKey] = (docKeyCounts[n._docKey] || 0) + 1; });

    function nodeColor(d) {
      if (d.isFocus) return '#58a6ff';
      // Only use document colors for groups of 2+ nodes (actual documents)
      if (docKeyCounts[d._docKey] > 1) return docColors[d._docKey];
      return '#8b949e';
    }

    function nodeRadius(d) {
      if (d.isFocus) return 10;
      // Document-level nodes: size by chunk count
      if (d.chunkCount) return Math.max(10, Math.min(40, 10 + Math.sqrt(d.chunkCount) * 3));
      return Math.max(4, Math.min(12, 4 + d.degree * 1.5));
    }

    // SVG
    const svg = d3.select(container)
      .insert('svg', ':first-child')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Zoom
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    this.zoom = zoomBehavior;
    this.svg = svg;
    this.container = container;

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke-width', d => d.count ? Math.max(1, Math.min(8, Math.sqrt(d.count) * 0.5)) : 0.5 + d.score * 2)
      .attr('stroke-opacity', d => d.count ? 0.4 + Math.min(0.5, d.count / 500) : 0.2 + d.score * 0.5);

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', d => `graph-node ${d.isFocus ? 'highlighted' : ''}`)
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    node.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => nodeColor(d))
      .attr('stroke', d => d.isFocus ? '#58a6ff' : 'transparent')
      .attr('stroke-width', d => d.isFocus ? 3 : 0);

    const isDocLevel = nodes.some(n => n.chunkCount);
    node.append('text')
      .text(d => truncate(d.title, isDocLevel ? 40 : 20))
      .attr('dx', d => nodeRadius(d) + 4)
      .attr('dy', 3)
      .attr('font-size', d => d.chunkCount ? '13px' : d.isFocus ? '12px' : '10px')
      .attr('fill', d => (d.isFocus || d.chunkCount) ? '#e6edf3' : '#8b949e');

    // Tooltip
    const tooltipEl = document.getElementById('graph-tooltip');
    node.on('mouseover', (event, d) => {
      if (tooltipEl) {
        const chunkInfo = d.chunkCount ? ` &middot; ${d.chunkCount} chunks` : '';
        tooltipEl.innerHTML = `
          <div class="tooltip-title">${escapeHtml(d.title)}</div>
          <div class="tooltip-id">${escapeHtml(d.shortId)} &middot; ${d.degree} connections${chunkInfo}</div>
          ${d.tags.length > 0 ? `<div class="tooltip-tags">${d.tags.map(t => '#' + t).join(' ')}</div>` : ''}
        `;
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = (event.offsetX + 15) + 'px';
        tooltipEl.style.top = (event.offsetY - 10) + 'px';
      }
    }).on('mousemove', (event) => {
      if (tooltipEl) {
        tooltipEl.style.left = (event.offsetX + 15) + 'px';
        tooltipEl.style.top = (event.offsetY - 10) + 'px';
      }
    }).on('mouseout', () => {
      if (tooltipEl) tooltipEl.style.display = 'none';
    }).on('click', (event, d) => {
      app.navigate('node/' + d.id);
    });

    // Simulation — scale forces for large graphs
    const isLarge = nodes.length > 500;
    const linkDist = isLarge ? 30 : 80;
    const chargeStr = isLarge ? -50 : -200;
    const alphaDecay = isLarge ? 0.04 : 0.0228;

    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(linkDist))
      .force('charge', d3.forceManyBody().strength(chargeStr).distanceMax(isLarge ? 300 : Infinity))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + (isLarge ? 2 : 5)))
      .alphaDecay(alphaDecay)
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    // Info
    if (info) {
      info.textContent = `${nodes.length} nodes, ${links.length} edges`;
    }

    // Initial zoom to fit
    setTimeout(() => {
      this.resetZoom();
    }, 500);
  },

  renderMini(containerId, data, focusNodeId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!data.nodes || data.nodes.length === 0) return;

    const nodes = data.nodes.map(n => ({
      id: n.id,
      title: n.title,
      tags: n.tags || [],
      isFocus: n.id === focusNodeId,
    }));

    const nodeIdSet = new Set(nodes.map(n => n.id));
    const links = (data.edges || [])
      .filter(e => nodeIdSet.has(e.sourceId || e.source) && nodeIdSet.has(e.targetId || e.target))
      .map(e => ({
        source: e.sourceId || e.source,
        target: e.targetId || e.target,
        score: e.score || 0,
      }));

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke-width', 1);

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.isFocus ? 7 : 4)
      .attr('fill', d => d.isFocus ? '#58a6ff' : '#3fb950')
      .attr('stroke', d => d.isFocus ? '#58a6ff' : 'transparent')
      .attr('stroke-width', d => d.isFocus ? 2 : 0)
      .style('cursor', 'pointer')
      .on('click', (event, d) => app.navigate('node/' + d.id));

    node.append('title').text(d => d.title);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(40))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
      });

    // Zoom
    svg.call(d3.zoom().scaleExtent([0.5, 3]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));
  },

  zoomIn() {
    if (this.svg && this.zoom) {
      this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.5);
    }
  },

  zoomOut() {
    if (this.svg && this.zoom) {
      this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.67);
    }
  },

  resetZoom() {
    if (!this.svg || !this.zoom || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.svg.transition().duration(500).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2)
    );
  },
};

// --- Router ---
const router = {
  parse(hash) {
    const raw = hash.replace(/^#/, '');
    const [path, queryString] = raw.split('?');
    const params = {};
    if (queryString) {
      for (const [k, v] of new URLSearchParams(queryString)) {
        params[k] = v;
      }
    }
    const segments = path.split('/').filter(Boolean);
    return { segments, params };
  },

  async route(hash) {
    const { segments, params } = this.parse(hash || 'dashboard');
    const view = segments[0] || 'dashboard';

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    switch (view) {
      case 'dashboard':
        await views.dashboard();
        break;
      case 'nodes':
        await views.nodes(params);
        break;
      case 'node':
        if (segments[1]) await views.nodeDetail(segments[1]);
        break;
      case 'graph':
        await views.graph(params);
        break;
      case 'tags':
        await views.tagsView();
        break;
      case 'tag':
        if (segments[1]) await views.tagDetail(decodeURIComponent(segments[1]), params);
        break;
      case 'documents':
        await views.documentsView();
        break;
      case 'document':
        if (segments[1]) await views.documentReader(segments[1]);
        break;
      case 'bridges':
        await views.bridges(params);
        break;
      case 'search':
        await views.search(params);
        break;
      default:
        await views.dashboard();
    }
  },
};

// --- App ---
const app = {
  async init() {
    // Check auth requirement
    try {
      const loginScreen = document.getElementById('login-screen');
      const mainApp = document.getElementById('main-app');
      const loginStatus = document.getElementById('login-status');
      const loginForm = document.getElementById('login-form');

      loginForm.style.display = 'none';
      loginStatus.style.display = 'block';

      // Try connecting without auth first
      const res = await fetch(`${API_BASE}/stats?top=1`, {
        headers: state.apiKey ? { 'Authorization': `Bearer ${state.apiKey}` } : {},
      });

      if (res.ok) {
        // Connected successfully
        this.showApp();
      } else if (res.status === 401) {
        // Auth required
        state.authRequired = true;
        if (state.apiKey) {
          // Stored key is invalid
          state.apiKey = '';
          sessionStorage.removeItem('forest_api_key');
        }
        this.showLogin();
      } else {
        this.showLogin('Server error: ' + res.status);
      }
    } catch (err) {
      this.showLogin('Cannot connect to server');
    }

    // Event listeners
    document.getElementById('login-btn')?.addEventListener('click', () => this.login());
    document.getElementById('api-key-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('global-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.globalSearch();
    });

    // Hash routing
    window.addEventListener('hashchange', () => router.route(location.hash));
  },

  showLogin(errorMsg) {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const loginStatus = document.getElementById('login-status');
    const loginError = document.getElementById('login-error');

    mainApp.style.display = 'none';
    loginScreen.style.display = 'flex';
    loginForm.style.display = 'block';
    loginStatus.style.display = 'none';

    if (errorMsg) {
      loginError.textContent = errorMsg;
    } else {
      loginError.textContent = '';
    }

    document.getElementById('api-key-input')?.focus();
  },

  async login() {
    const input = document.getElementById('api-key-input');
    const btn = document.getElementById('login-btn');
    const error = document.getElementById('login-error');

    const key = input?.value?.trim();
    if (!key) {
      error.textContent = 'Please enter an API key';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Connecting...';
    error.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/stats?top=1`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });

      if (res.ok) {
        state.apiKey = key;
        sessionStorage.setItem('forest_api_key', key);
        this.showApp();
      } else if (res.status === 401) {
        error.textContent = 'Invalid API key';
      } else {
        error.textContent = 'Server error: ' + res.status;
      }
    } catch (err) {
      error.textContent = 'Cannot connect to server';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Connect';
    }
  },

  showApp() {
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';

    // Route to current hash or dashboard
    router.route(location.hash || 'dashboard');
  },

  logout() {
    state.apiKey = '';
    sessionStorage.removeItem('forest_api_key');
    if (state.authRequired) {
      this.showLogin();
    } else {
      // No auth required, just reload
      location.reload();
    }
  },

  navigate(path) {
    location.hash = path;
  },

  setNodeBodyView(mode) {
    if (mode !== 'rendered' && mode !== 'source') return;

    state.nodeBodyView = mode;
    sessionStorage.setItem('forest_node_body_view', mode);

    const bodyEl = document.getElementById('node-body');
    if (bodyEl) {
      bodyEl.classList.toggle('detail-body-source', mode === 'source');
      bodyEl.innerHTML = renderNodeBody(state.currentNodeBodyRaw, mode);
    }

    const renderedBtn = document.getElementById('node-body-toggle-rendered');
    const sourceBtn = document.getElementById('node-body-toggle-source');
    renderedBtn?.classList.toggle('active', mode === 'rendered');
    sourceBtn?.classList.toggle('active', mode === 'source');
  },

  globalSearch() {
    const q = document.getElementById('global-search')?.value?.trim();
    if (q) {
      location.hash = `search?q=${encodeURIComponent(q)}&mode=semantic`;
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('mobile-open');
    state.sidebarCollapsed = !state.sidebarCollapsed;
  },
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => app.init());
