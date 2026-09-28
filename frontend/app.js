/**
 * Knowledge Intelligence Engine — Frontend Application
 * Offline-first Knowledge OS
 */
const API = (window.location.port === '8000' || window.location.hostname === 'localhost')
  ? (window.location.protocol + '//' + window.location.hostname + ':8000/api')
  : '/api';

const state = {
  page: 'dashboard',
  searchMode: 'search',
  lastSearch: null,
};

async function api(path, opts) {
  opts = opts || {};
  const url = API + path;
  const conf = { headers: {}, ...opts };
  if (opts.body && !(opts.body instanceof FormData)) {
    conf.headers['Content-Type'] = 'application/json';
    conf.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(url, conf);
    if (!res.ok) {
      const err = await res.json().catch(function() { return { detail: res.statusText }; });
      throw new Error(err.detail || err.message || ('HTTP ' + res.status));
    }
    return await res.json();
  } catch (e) {
    if (e.message && e.message.indexOf('Failed to fetch') !== -1) {
      throw new Error('Backend unreachable. Start: uvicorn app.main:app --port 8000');
    }
    throw e;
  }
}

function $(sel) { return document.querySelector(sel); }

function badge(status) {
  const map = {
    ready: 'badge-ready', crawling: 'badge-crawling', pending: 'badge-pending',
    failed: 'badge-failed', paused: 'badge-paused', indexing: 'badge-indexing'
  };
  return '<span class="badge ' + (map[status] || '') + '">' + status + '</span>';
}

function showModal(title, bodyHtml) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-overlay').hidden = false;
}
function hideModal() { $('#modal-overlay').hidden = true; }

function toast(msg, type) {
  type = type || 'info';
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' +
    (type === 'error' ? '#7f1d1d' : '#1e3a5f') +
    ';color:#fff;padding:10px 20px;border-radius:8px;z-index:200;font-size:13px;';
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3500);
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatBytes(b) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return b.toFixed(i ? 1 : 0) + ' ' + u[i];
}

async function renderDashboard() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading…</p></div>';
  try {
    const stats = await api('/dashboard');
    content.innerHTML =
      '<div class="page-header"><h1>Dashboard</h1><p>Overview of your local Knowledge Base</p></div>' +
      '<div class="stats-grid">' +
      '<div class="stat-card"><div class="stat-value">' + stats.total_sources + '</div><div class="stat-label">Sources</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.total_documents + '</div><div class="stat-label">Documents</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.total_chunks + '</div><div class="stat-label">Chunks</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.total_concepts + '</div><div class="stat-label">Concepts</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.total_categories + '</div><div class="stat-label">Categories</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.failed_sources + '</div><div class="stat-label">Failed</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + stats.quality_issues + '</div><div class="stat-label">Quality Issues</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + formatBytes(stats.database_size_bytes) + '</div><div class="stat-label">DB Size</div></div>' +
      '</div>' +
      '<div class="panel"><div class="panel-header"><h2>System Status</h2></div><div class="panel-body">' +
      '<p><strong>Index:</strong> ' + stats.index_status + '</p>' +
      '<p><strong>Last Crawl:</strong> ' + (stats.last_crawl || 'Never') + '</p>' +
      '<p style="margin-top:12px;color:var(--text-muted);font-size:13px;">All data is stored locally. Search and browse work fully offline after ingestion.</p>' +
      '</div></div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><div class="icon">⚠</div><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderSearch(initialQuery) {
  initialQuery = initialQuery || '';
  const content = $('#content');
  content.innerHTML =
    '<div class="page-header"><h1>Search</h1><p>Hybrid search across your entire Knowledge Base</p></div>' +
    '<div class="search-modes">' +
    '<button class="mode-btn ' + (state.searchMode === 'search' ? 'active' : '') + '" data-mode="search">Search</button>' +
    '<button class="mode-btn ' + (state.searchMode === 'explain' ? 'active' : '') + '" data-mode="explain">Explain</button>' +
    '<button class="mode-btn ' + (state.searchMode === 'research' ? 'active' : '') + '" data-mode="research">Research</button>' +
    '</div>' +
    '<div class="panel"><div class="panel-body"><div style="display:flex;gap:10px;">' +
    '<input class="form-control" id="search-input" value="' + esc(initialQuery) + '" placeholder="Ask or search…" style="flex:1;" />' +
    '<button class="btn btn-primary" id="search-go">Search</button>' +
    '</div></div></div><div id="search-results"></div>';

  content.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.onclick = function() {
      state.searchMode = btn.dataset.mode;
      content.querySelectorAll('.mode-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.mode === state.searchMode);
      });
    };
  });

  async function doSearch() {
    const q = $('#search-input').value.trim();
    if (!q) return;
    const box = $('#search-results');
    box.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const data = await api('/search', {
        method: 'POST',
        body: { query: q, answer_mode: state.searchMode, mode: 'hybrid', limit: 20 }
      });
      state.lastSearch = data;
      var html = '';

      if (data.answer) {
        html += '<div class="answer-box"><h3>' + (data.mode === 'research' ? 'Research Report' : 'Answer') +
          (data.ai_available ? '' : ' (Extractive)') + '</h3>' +
          '<div class="answer-text">' + esc(data.answer) + '</div>';
        if (data.sources && data.sources.length) {
          html += '<div class="sources-list"><strong style="font-size:12px;color:var(--text-muted);">SOURCES</strong>';
          data.sources.forEach(function(s) {
            html += '<div class="source-ref">[' + s.index + '] <a href="#" onclick="viewDocument(' + s.document_id + ');return false;">' +
              esc(s.title) + '</a> — ' + esc(s.source_name || '') +
              (s.url ? ' · <a href="' + esc(s.url) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>';
          });
          html += '</div>';
        }
        if (data.sufficient_data === false) {
          html += '<p style="color:var(--warning);margin-top:10px;font-size:13px;">Insufficient data in Knowledge Base.</p>';
        }
        html += '</div>';
      }

      if (data.expanded_terms && data.expanded_terms.length) {
        html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Expanded: ' +
          data.expanded_terms.map(function(t) { return '<span class="badge" style="margin:2px;">' + esc(t) + '</span>'; }).join(' ') +
          ' · ' + data.total + ' results · ' + data.took_ms + 'ms</p>';
      }

      if (data.hits && data.hits.length) {
        html += '<div class="panel"><div class="panel-header"><h2>Results (' + data.total + ')</h2></div>';
        data.hits.forEach(function(h) {
          html += '<div class="search-hit" onclick="viewDocument(' + h.document_id + ')">' +
            '<div class="hit-title">' + esc(h.title) + '</div>' +
            '<div class="hit-meta"><span>' + esc(h.source_name) + '</span>' +
            '<span class="hit-score">' + ((h.score * 100).toFixed(0)) + '%</span>' +
            '<span>' + h.match_type + '</span></div>' +
            '<div class="hit-content">' + esc(h.content) + '</div>' +
            (h.reason ? '<div class="hit-reason">' + esc(h.reason) + '</div>' : '') +
            '</div>';
        });
        html += '</div>';
      } else if (!data.answer) {
        html += '<div class="empty-state"><div class="icon">⌕</div><p>No results found.</p></div>';
      }
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">' + esc(e.message) + '</p></div>';
    }
  }

  $('#search-go').onclick = doSearch;
  $('#search-input').onkeydown = function(e) { if (e.key === 'Enter') doSearch(); };
  if (initialQuery) doSearch();
}

async function renderSources() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const sources = await api('/sources');
    var rows = sources.map(function(s) {
      return '<tr><td><strong>' + esc(s.name) + '</strong>' +
        (s.url ? '<br><span style="font-size:11px;color:var(--text-muted);">' + esc(s.url).slice(0, 50) + '</span>' : '') +
        '</td><td>' + s.source_type + '</td><td>' + badge(s.status) + '</td>' +
        '<td class="mono">' + s.document_count + '</td><td class="mono">' + s.chunk_count + '</td>' +
        '<td class="mono">v' + s.version + '</td>' +
        '<td style="font-size:12px;">' + (s.last_crawled ? new Date(s.last_crawled).toLocaleString() : '—') + '</td>' +
        '<td><div class="btn-group">' +
        (['website', 'sitemap', 'rss'].indexOf(s.source_type) !== -1 ?
          '<button class="btn btn-sm btn-secondary" onclick="crawlSource(' + s.id + ')">Refresh</button>' +
          '<button class="btn btn-sm btn-secondary" onclick="pauseSource(' + s.id + ')">Pause</button>' : '') +
        '<button class="btn btn-sm btn-danger" onclick="deleteSource(' + s.id + ')">Delete</button>' +
        '</div></td></tr>';
    }).join('');

    content.innerHTML =
      '<div class="page-header"><h1>Sources</h1><p>Manage knowledge sources</p></div>' +
      '<div class="btn-group" style="margin-bottom:16px;"><button class="btn btn-primary" onclick="navigate(\'import\')">+ Add Source</button></div>' +
      '<div class="panel"><div class="table-wrap"><table><thead><tr>' +
      '<th>Name</th><th>Type</th><th>Status</th><th>Docs</th><th>Chunks</th><th>Version</th><th>Last Crawl</th><th>Actions</th>' +
      '</tr></thead><tbody>' +
      (sources.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No sources yet.</td></tr>' : rows) +
      '</tbody></table></div></div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderImport() {
  $('#content').innerHTML =
    '<div class="page-header"><h1>Import Center</h1><p>Ingest knowledge from multiple source types</p></div>' +
    '<div class="import-grid">' +
    '<div class="import-card" onclick="showImportForm(\'url\')"><div class="icon">🌐</div><div class="label">Website / URL</div><div class="desc">Crawl pages with depth control</div></div>' +
    '<div class="import-card" onclick="showImportForm(\'file\')"><div class="icon">📄</div><div class="label">File</div><div class="desc">PDF, DOCX, TXT, MD, CSV, JSON</div></div>' +
    '<div class="import-card" onclick="showImportForm(\'text\')"><div class="icon">✎</div><div class="label">Text / Note</div><div class="desc">Paste or write content manually</div></div>' +
    '<div class="import-card" onclick="showImportForm(\'rss\')"><div class="icon">📡</div><div class="label">RSS / Sitemap</div><div class="desc">Feed or sitemap URL</div></div>' +
    '</div><div id="import-form-area"></div>';
}

function showImportForm(type) {
  const area = $('#import-form-area');
  if (type === 'url' || type === 'rss') {
    area.innerHTML =
      '<div class="panel"><div class="panel-header"><h2>' + (type === 'rss' ? 'RSS / Sitemap' : 'Website Crawl') + '</h2></div><div class="panel-body">' +
      '<div class="form-group"><label>Name</label><input class="form-control" id="imp-name" /></div>' +
      '<div class="form-group"><label>URL</label><input class="form-control" id="imp-url" dir="ltr" placeholder="https://example.com" /></div>' +
      '<div class="form-row"><div class="form-group"><label>Crawl Depth</label><input class="form-control" id="imp-depth" type="number" value="2" min="0" max="5" /></div>' +
      '<div class="form-group"><label>Max Pages</label><input class="form-control" id="imp-max" type="number" value="20" min="1" max="200" /></div></div>' +
      '<div class="form-group"><label>Tags</label><input class="form-control" id="imp-tags" /></div>' +
      '<button class="btn btn-primary" id="imp-submit">Start Crawl</button></div></div>';
    $('#imp-submit').onclick = async function() {
      var name = $('#imp-name').value || $('#imp-url').value;
      var url = $('#imp-url').value;
      if (!url) return toast('URL required', 'error');
      try {
        var res = await api('/import/url', {
          method: 'POST',
          body: {
            name: name, url: url,
            source_type: type === 'rss' ? 'rss' : 'website',
            crawl_depth: parseInt($('#imp-depth').value) || 2,
            max_pages: parseInt($('#imp-max').value) || 20,
            tags: ($('#imp-tags').value || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean)
          }
        });
        toast('Crawl started for source #' + res.source_id);
        navigate('sources');
      } catch (e) { toast(e.message, 'error'); }
    };
  } else if (type === 'file') {
    area.innerHTML =
      '<div class="panel"><div class="panel-header"><h2>Upload File</h2></div><div class="panel-body">' +
      '<div class="form-group"><label>Name</label><input class="form-control" id="imp-name" /></div>' +
      '<div class="form-group"><label>File</label><input class="form-control" id="imp-file" type="file" accept=".pdf,.txt,.md,.docx,.csv,.json,.html" /></div>' +
      '<div class="form-group"><label>Tags</label><input class="form-control" id="imp-tags" /></div>' +
      '<button class="btn btn-primary" id="imp-submit">Upload & Index</button></div></div>';
    $('#imp-submit').onclick = async function() {
      var fileInput = $('#imp-file');
      if (!fileInput.files.length) return toast('Select a file', 'error');
      var fd = new FormData();
      fd.append('file', fileInput.files[0]);
      if ($('#imp-name').value) fd.append('name', $('#imp-name').value);
      fd.append('tags', $('#imp-tags').value || '');
      try {
        var res = await api('/import/file', { method: 'POST', body: fd });
        toast('Indexed: ' + res.chunk_count + ' chunks');
        navigate('sources');
      } catch (e) { toast(e.message, 'error'); }
    };
  } else if (type === 'text') {
    area.innerHTML =
      '<div class="panel"><div class="panel-header"><h2>Manual Text</h2></div><div class="panel-body">' +
      '<div class="form-group"><label>Title</label><input class="form-control" id="imp-title" /></div>' +
      '<div class="form-group"><label>Content</label><textarea class="form-control" id="imp-content" rows="10"></textarea></div>' +
      '<div class="form-group"><label>Tags</label><input class="form-control" id="imp-tags" /></div>' +
      '<button class="btn btn-primary" id="imp-submit">Ingest</button></div></div>';
    $('#imp-submit').onclick = async function() {
      var title = $('#imp-title').value;
      var content = $('#imp-content').value;
      if (!title || !content) return toast('Title and content required', 'error');
      try {
        var res = await api('/import/text', {
          method: 'POST',
          body: {
            title: title, content: content,
            tags: ($('#imp-tags').value || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean)
          }
        });
        toast('Ingested: ' + res.chunk_count + ' chunks');
        navigate('explorer');
      } catch (e) { toast(e.message, 'error'); }
    };
  }
}

async function renderExplorer() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var docs = await api('/documents?limit=30');
    var cats = await api('/categories');
    var concepts = await api('/concepts?limit=20');
    content.innerHTML =
      '<div class="page-header"><h1>Knowledge Explorer</h1><p>Browse without search</p></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">' +
      '<div class="panel"><div class="panel-header"><h2>Categories</h2></div><div class="panel-body">' +
      cats.map(function(c) {
        return '<div class="tree-item" style="' + (c.parent_id ? 'padding-right:28px;' : '') + '">' +
          '<span>' + (c.icon || '📁') + '</span><span>' + esc(c.name) + '</span>' +
          '<span style="color:var(--text-muted);font-size:11px;margin-right:auto;">' + c.document_count + '</span></div>';
      }).join('') +
      '</div></div>' +
      '<div class="panel"><div class="panel-header"><h2>Top Concepts</h2></div><div class="panel-body">' +
      concepts.map(function(c) {
        return '<div class="tree-item" onclick="viewConceptGraph(' + c.id + ')"><span>⬡</span><span>' + esc(c.name) + '</span>' +
          '<span style="color:var(--text-muted);font-size:11px;margin-right:auto;">' + c.mention_count + '</span></div>';
      }).join('') +
      '</div></div></div>' +
      '<div class="panel" style="margin-top:20px;"><div class="panel-header"><h2>Recent Documents (' + docs.total + ')</h2></div>' +
      docs.documents.map(function(d) {
        return '<div class="search-hit" onclick="viewDocument(' + d.id + ')">' +
          '<div class="hit-title">' + esc(d.title) + '</div>' +
          '<div class="hit-meta"><span>' + d.word_count + ' words</span></div>' +
          '<div class="hit-content">' + esc(d.summary || '') + '</div></div>';
      }).join('') + '</div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderGraph() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var graph = await api('/graph?limit=40');
    content.innerHTML =
      '<div class="page-header"><h1>Knowledge Graph</h1><p>' + graph.nodes.length + ' concepts · ' + graph.edges.length + ' relationships</p></div>' +
      '<div class="graph-container" id="graph-canvas"></div>' +
      '<div class="panel" style="margin-top:16px;"><div class="panel-header"><h2>Concepts</h2></div>' +
      '<div class="panel-body" style="display:flex;flex-wrap:wrap;gap:8px;">' +
      graph.nodes.map(function(n) {
        return '<span class="badge" style="cursor:pointer;padding:6px 12px;font-size:12px;" onclick="viewConceptGraph(' + n.id + ')">' +
          esc(n.name) + ' (' + n.mentions + ')</span>';
      }).join('') + '</div></div>';
    var canvas = $('#graph-canvas');
    var w = canvas.clientWidth || 600;
    var h = 500;
    graph.nodes.forEach(function(n, i) {
      var angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      var r = 120 + (n.mentions || 1) * 8;
      var x = Math.max(10, Math.min(w - 100, w / 2 + Math.cos(angle) * r - 40));
      var y = Math.max(10, Math.min(h - 30, h / 2 + Math.sin(angle) * r - 12));
      var node = document.createElement('div');
      node.className = 'graph-node';
      node.textContent = n.name;
      node.style.cssText = 'left:' + x + 'px;top:' + y + 'px;';
      node.onclick = function() { viewConceptGraph(n.id); };
      canvas.appendChild(node);
    });
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderCategories() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var cats = await api('/categories');
    content.innerHTML =
      '<div class="page-header"><h1>Categories</h1><p>Hierarchical taxonomy</p></div>' +
      '<div class="btn-group" style="margin-bottom:16px;"><button class="btn btn-primary" onclick="showAddCategory()">+ Add Category</button></div>' +
      '<div class="panel"><div class="panel-body">' +
      cats.map(function(c) {
        return '<div class="tree-item" style="' + (c.parent_id ? 'padding-right:32px;opacity:0.9;' : 'font-weight:600;') + '">' +
          '<span>' + (c.icon || '📁') + '</span><span>' + esc(c.path || c.name) + '</span>' +
          '<span style="color:var(--text-muted);font-size:11px;margin-right:auto;">' + c.document_count + ' docs</span></div>';
      }).join('') + '</div></div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderQuality() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var issues = await api('/quality');
    content.innerHTML =
      '<div class="page-header"><h1>Data Quality</h1><p>Duplicates, empty docs, encoding issues</p></div>' +
      '<div class="panel"><div class="table-wrap"><table><thead><tr><th>Type</th><th>Entity</th><th>Description</th><th>Severity</th><th>Date</th></tr></thead><tbody>' +
      (issues.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No quality issues</td></tr>' :
        issues.map(function(i) {
          return '<tr><td><span class="badge">' + i.type + '</span></td><td>' + i.entity_type + ' #' + i.entity_id + '</td>' +
            '<td>' + esc(i.description) + '</td><td>' + i.severity + '</td>' +
            '<td style="font-size:12px;">' + new Date(i.created_at).toLocaleString() + '</td></tr>';
        }).join('')) +
      '</tbody></table></div></div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderActivity() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var history = await api('/search/history');
    content.innerHTML =
      '<div class="page-header"><h1>Activity</h1><p>Search history</p></div>' +
      '<div class="panel"><div class="panel-header"><h2>Search History</h2></div><div class="table-wrap"><table>' +
      '<thead><tr><th>Query</th><th>Mode</th><th>Results</th><th>Date</th></tr></thead><tbody>' +
      history.map(function(h) {
        return '<tr><td>' + esc(h.query) + '</td><td>' + h.mode + '</td><td class="mono">' + h.result_count + '</td>' +
          '<td style="font-size:12px;">' + new Date(h.created_at).toLocaleString() + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function renderSettings() {
  const content = $('#content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    var ai = await api('/ai/status');
    var health = await api('/health');
    content.innerHTML =
      '<div class="page-header"><h1>Settings</h1><p>System configuration — all local</p></div>' +
      '<div class="panel"><div class="panel-header"><h2>AI Layer (Optional)</h2></div><div class="panel-body">' +
      '<p><strong>Enabled:</strong> ' + (ai.enabled ? 'Yes' : 'No') + '</p>' +
      '<p><strong>Provider:</strong> ' + ai.provider + '</p>' +
      '<p><strong>Available:</strong> ' + (ai.available ? 'Connected' : 'Not available') + '</p>' +
      '<p style="margin-top:12px;color:var(--text-muted);font-size:13px;">System works fully without AI. Enable Ollama for local LLM answers.</p></div></div>' +
      '<div class="panel"><div class="panel-header"><h2>System</h2></div><div class="panel-body">' +
      '<p><strong>Version:</strong> ' + health.version + '</p>' +
      '<p><strong>Offline Mode:</strong> Active</p>' +
      '<p style="margin-top:12px;"><button class="btn btn-secondary" id="btn-do-backup">Create Backup</button></p></div></div>';
    $('#btn-do-backup').onclick = async function() {
      try {
        var res = await api('/backup', { method: 'POST' });
        toast('Backup created: ' + formatBytes(res.size));
      } catch (e) { toast(e.message, 'error'); }
    };
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>' + esc(e.message) + '</p></div>';
  }
}

async function viewDocument(id) {
  try {
    var doc = await api('/documents/' + id);
    showModal(doc.title,
      '<div style="margin-bottom:12px;"><span class="badge">' + (doc.source ? doc.source.type : '') + '</span>' +
      '<span style="color:var(--text-muted);font-size:12px;margin-right:8px;">' + doc.word_count + ' words</span></div>' +
      (doc.summary ? '<p style="color:var(--text-secondary);margin-bottom:12px;font-style:italic;">' + esc(doc.summary) + '</p>' : '') +
      '<div style="max-height:400px;overflow-y:auto;white-space:pre-wrap;font-size:13.5px;line-height:1.7;direction:auto;">' +
      esc((doc.content || '').slice(0, 8000)) + '</div>' +
      (doc.concepts && doc.concepts.length ?
        '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-subtle);">' +
        '<strong style="font-size:12px;color:var(--text-muted);">CONCEPTS</strong>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">' +
        doc.concepts.map(function(c) {
          return '<span class="badge" style="cursor:pointer;" onclick="hideModal();viewConceptGraph(' + c.id + ')">' + esc(c.name) + '</span>';
        }).join('') + '</div></div>' : '')
    );
  } catch (e) { toast(e.message, 'error'); }
}

async function viewConceptGraph(id) {
  try {
    var g = await api('/concepts/' + id + '/graph?depth=2');
    showModal('Concept Graph',
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">' +
      g.nodes.map(function(n) {
        return '<span class="badge" style="padding:6px 12px;' + (n.depth === 0 ? 'border:1px solid var(--accent);' : '') + '">' +
          esc(n.name) + ' (d' + n.depth + ')</span>';
      }).join('') + '</div>' +
      (g.edges.length ?
        '<strong style="font-size:12px;color:var(--text-muted);">RELATIONSHIPS</strong><ul style="margin-top:8px;padding-right:18px;font-size:13px;">' +
        g.edges.map(function(e) {
          var from = g.nodes.find(function(n) { return n.id === e.from; });
          var to = g.nodes.find(function(n) { return n.id === e.to; });
          return '<li>' + (from ? from.name : e.from) + ' —[' + e.type + ']→ ' + (to ? to.name : e.to) + '</li>';
        }).join('') + '</ul>' : '<p style="color:var(--text-muted);">No relationships yet</p>')
    );
  } catch (e) { toast(e.message, 'error'); }
}

async function crawlSource(id) {
  try {
    await api('/sources/' + id + '/crawl', { method: 'POST' });
    toast('Crawl started');
    setTimeout(function() { navigate('sources'); }, 1000);
  } catch (e) { toast(e.message, 'error'); }
}

async function pauseSource(id) {
  try {
    await api('/sources/' + id + '/pause', { method: 'POST' });
    toast('Paused');
    navigate('sources');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSource(id) {
  if (!confirm('Delete this source and all its documents?')) return;
  try {
    await api('/sources/' + id, { method: 'DELETE' });
    toast('Deleted');
    navigate('sources');
  } catch (e) { toast(e.message, 'error'); }
}

function showAddCategory() {
  showModal('Add Category',
    '<div class="form-group"><label>Name</label><input class="form-control" id="cat-name" /></div>' +
    '<div class="form-group"><label>Icon</label><input class="form-control" id="cat-icon" value="📁" /></div>' +
    '<button class="btn btn-primary" id="cat-save">Create</button>'
  );
  $('#cat-save').onclick = async function() {
    var name = $('#cat-name').value;
    if (!name) return;
    try {
      await api('/categories', { method: 'POST', body: { name: name, icon: $('#cat-icon').value } });
      hideModal();
      navigate('categories');
    } catch (e) { toast(e.message, 'error'); }
  };
}

var pages = {
  dashboard: renderDashboard,
  search: function() { renderSearch(); },
  sources: renderSources,
  import: renderImport,
  explorer: renderExplorer,
  graph: renderGraph,
  categories: renderCategories,
  quality: renderQuality,
  activity: renderActivity,
  settings: renderSettings
};

function navigate(page) {
  state.page = page;
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.toggle('active', n.dataset.page === page);
  });
  $('#sidebar').classList.remove('open');
  if (pages[page]) pages[page]();
}

document.querySelectorAll('.nav-item').forEach(function(btn) {
  btn.onclick = function() { navigate(btn.dataset.page); };
});

$('#menu-toggle').onclick = function() { $('#sidebar').classList.toggle('open'); };
$('#modal-close').onclick = hideModal;
$('#modal-overlay').onclick = function(e) { if (e.target === $('#modal-overlay')) hideModal(); };

$('#global-search-btn').onclick = function() {
  var q = $('#global-search').value.trim();
  if (q) { navigate('search'); setTimeout(function() { renderSearch(q); }, 50); }
};
$('#global-search').onkeydown = function(e) {
  if (e.key === 'Enter') $('#global-search-btn').click();
};

$('#btn-backup').onclick = async function() {
  try {
    var res = await api('/backup', { method: 'POST' });
    toast('Backup: ' + formatBytes(res.size));
  } catch (e) { toast(e.message, 'error'); }
};

window.navigate = navigate;
window.viewDocument = viewDocument;
window.viewConceptGraph = viewConceptGraph;
window.crawlSource = crawlSource;
window.pauseSource = pauseSource;
window.deleteSource = deleteSource;
window.showImportForm = showImportForm;
window.showAddCategory = showAddCategory;
window.hideModal = hideModal;

navigate('dashboard');
