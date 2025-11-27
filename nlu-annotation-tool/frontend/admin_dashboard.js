/**
 * frontend/admin_dashboard.js
 * Admin Dashboard: statistics, user management, model health, quick actions
 * 
 * Storage keys used:
 * - localStorage.nlu_token: JWT token for API auth
 * - localStorage.nlu_workspace: current workspace ID
 * 
 * API endpoints:
 * - GET /api/admin/stats?workspace_id=<id>
 * - GET /api/admin/users
 * - GET /api/admin/model_health?workspace_id=<id>
 * - POST /api/active_learning/retrain
 */

(function () {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');

    // Redirect to login if not authenticated
    if (!TOKEN) {
        console.warn('[admin_dashboard] No token found, redirecting to auth');
        window.location.replace('auth.html');
        throw new Error('No token');
    }

    // Load available workspaces and populate selector
    async function loadWorkspaces() {
        try {
            const resp = await fetch(`${API}/api/workspaces`, { headers: AUTH_HEADERS });
            if (!resp.ok) {
                console.error('[admin_dashboard] Failed to list workspaces', resp.status);
                return;
            }
            const data = await resp.json();
            const items = data.workspaces || [];
            const select = document.getElementById('workspace-select');
            if (!select) return;
            // clear existing
            select.innerHTML = '<option value="">Select workspace...</option>';
            items.forEach(ws => {
                const opt = document.createElement('option');
                opt.value = ws;
                opt.innerText = ws;
                select.appendChild(opt);
            });
            // if a workspace is already active, select it
            if (WORKSPACE) {
                select.value = WORKSPACE;
            }
        } catch (err) {
            console.error('[admin_dashboard] Error loading workspaces:', err);
        }
    }

    // Redirect to workspace selection only if no workspace
    if (!WORKSPACE) {
        console.warn('[admin_dashboard] No workspace found, redirecting to workspace selection');
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search || 'admin_dashboard.html');
        window.location.replace(`workspace.html?return_to=${returnTo}`);
        throw new Error('No workspace');
    }

    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    document.addEventListener('DOMContentLoaded', async function () {
        console.log('[admin_dashboard] DOM loaded, initializing...');

        // Display workspace
        const wsDisplay = document.getElementById('workspace-display');
        if (wsDisplay) {
            wsDisplay.innerText = WORKSPACE;
        }

        // Populate workspace selector and load data
        await loadWorkspaces();

        // Load default data for current workspace if present
        if (WORKSPACE) {
            await loadStats(WORKSPACE);
            await loadModelHealth(WORKSPACE);
        }
        await loadUsers();

        // Attach event listeners
        attachEventListeners();
    });

    function attachEventListeners() {
        const goToAL = document.getElementById('go-to-active-learning');
        const retrainSpacy = document.getElementById('retrain-spacy');
        const retrainRasa = document.getElementById('retrain-rasa');
        const retrainBoth = document.getElementById('retrain-both-models');

        if (goToAL) {
            goToAL.addEventListener('click', function () {
                window.location.href = 'active_learning.html';
            });
        }

        if (retrainSpacy) {
            retrainSpacy.addEventListener('click', function () {
                handleRetrain('spacy');
            });
        }

        if (retrainRasa) {
            retrainRasa.addEventListener('click', function () {
                handleRetrain('rasa');
            });
        }

        if (retrainBoth) {
            retrainBoth.addEventListener('click', function () {
                handleRetrain('both');
            });
        }

        // Workspace selector load button
        const wsSelect = document.getElementById('workspace-select');
        const wsLoad = document.getElementById('workspace-load');
        if (wsLoad && wsSelect) {
            wsLoad.addEventListener('click', async function () {
                const selected = wsSelect.value;
                if (!selected) return alert('Please select a workspace');
                const wsDisplay = document.getElementById('workspace-display');
                if (wsDisplay) wsDisplay.innerText = selected;
                // Load stats for selected workspace (do not change global localStorage)
                await loadStats(selected);
                await loadModelHealth(selected);
            });
        }
    }

    async function loadStats(workspaceId = WORKSPACE) {
        try {
            console.log('[admin_dashboard] Loading stats...');
            const resp = await fetch(
                `${API}/api/admin/stats?workspace_id=${encodeURIComponent(workspaceId)}`,
                { headers: AUTH_HEADERS }
            );

            if (!resp.ok) {
                console.error('[admin_dashboard] Failed to load stats:', resp.status);
                showNotification('Failed to load statistics', 'danger');
                return;
            }

            const stats = await resp.json();
            console.log('[admin_dashboard] Stats loaded:', stats);

            // Update stat cards
            updateStatCard('stat-annotations', stats.total_annotations || 0);
            updateStatCard('stat-entities', stats.num_entity_types || 0);
            updateStatCard('stat-intents', stats.num_intents || 0);
            updateStatCard('stat-uncertain', stats.total_uncertain || 0);

            // Update model accuracy card - use backend data
            const accEl = document.getElementById('stat-accuracy');
            if (accEl) {
                let acc = stats.accuracy;
                if (acc !== undefined && acc !== null && !isNaN(Number(acc))) {
                    accEl.innerText = Number(acc).toFixed(2) + '%';
                } else {
                    accEl.innerText = 'N/A';
                }
            }

            // Update detailed lists
            updateEntityList(stats.entity_types || []);
            updateIntentList(stats.intents || []);
        } catch (err) {
            console.error('[admin_dashboard] Error loading stats:', err);
            showNotification('Network error: ' + err.message, 'danger');
        }
    }

    function updateStatCard(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerText = value;
        }
    }

    function updateEntityList(entities) {
        const container = document.getElementById('entity-list');
        if (!container) return;

        if (!entities || entities.length === 0) {
            container.innerHTML = '<small class="text-muted">No entities</small>';
            return;
        }

        let html = entities.map(e => `
            <span class="badge bg-secondary">${e}</span>
        `).join(' ');
        container.innerHTML = html;
    }

    function updateIntentList(intents) {
        const container = document.getElementById('intent-list');
        if (!container) return;

        if (!intents || intents.length === 0) {
            container.innerHTML = '<small class="text-muted">No intents</small>';
            return;
        }

        let html = intents.map(i => `
            <span class="badge bg-primary">${i}</span>
        `).join(' ');
        container.innerHTML = html;
    }

    async function loadModelHealth() {
        try {
            console.log('[admin_dashboard] Loading model health...');
            // allow passing workspace param
            const workspaceId = arguments.length > 0 ? arguments[0] : WORKSPACE;
            const resp = await fetch(
                `${API}/api/admin/model_health?workspace_id=${encodeURIComponent(workspaceId)}`,
                { headers: AUTH_HEADERS }
            );

            if (!resp.ok) {
                console.error('[admin_dashboard] Failed to load model health:', resp.status);
                return;
            }

            const health = await resp.json();
            console.log('[admin_dashboard] Model health loaded:', health);

            const container = document.getElementById('model-health-container');
            if (!container) return;

            const lastTrained = health.last_trained 
                ? new Date(health.last_trained * 1000).toLocaleString()
                : 'Never';

            const spacyVersions = (health.model_versions && health.model_versions.spacy) || [];
            const rasaVersions = (health.model_versions && health.model_versions.rasa) || [];

            // Helper: find latest by timestamp
            function latestVersion(versions) {
                if (!versions || versions.length === 0) return null;
                return versions.reduce((best, cur) => {
                    try {
                        const ts = Number(cur.timestamp || 0);
                        const bestTs = Number(best.timestamp || 0);
                        return ts > bestTs ? cur : best;
                    } catch (e) { return best; }
                }, versions[0]);
            }

            const latestSpacy = latestVersion(spacyVersions);
            const latestRasa = latestVersion(rasaVersions);

            let html = `
                <div class="mb-3">
                    <p><strong>Last Trained:</strong> ${lastTrained}</p>
                    <p><strong>Model Accuracy:</strong> ${health.accuracy !== undefined && health.accuracy !== null && !isNaN(Number(health.accuracy)) ? Number(health.accuracy).toFixed(2) + '%' : 'N/A'}</p>
                </div>
                <h6>MODEL VERSIONS</h6>
                <div class="row">
                    <div class="col-md-12 mb-4">
                        <p class="fw-bold mb-2" style="color: #4facfe;">Spacy</p>
                        <div class="model-versions-container">
                        ${spacyVersions.length > 0 
                            ? spacyVersions.map(v => `
                                <span class="model-version-badge badge bg-info" title="${v.file}">
                                  ${v.file}
                                  ${latestSpacy && latestSpacy.file === v.file ? '<span class="ms-1">(latest)</span>' : ''}
                                </span>
                              `).join('')
                            : '<small class="text-muted">No models</small>'
                        }
                        </div>
                    </div>
                    <div class="col-md-12">
                        <p class="fw-bold mb-2" style="color: #fee140;">Rasa</p>
                        <div class="model-versions-container">
                        ${rasaVersions.length > 0
                            ? rasaVersions.map(v => `
                                <span class="model-version-badge badge bg-warning text-dark" title="${v.file}">
                                  ${v.file}
                                  ${latestRasa && latestRasa.file === v.file ? '<span class="ms-1">(latest)</span>' : ''}
                                </span>
                              `).join('')
                            : '<small class="text-muted">No models</small>'
                        }
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        } catch (err) {
            console.error('[admin_dashboard] Error loading model health:', err);
        }
    }

    async function loadUsers() {
        try {
            console.log('[admin_dashboard] Loading users...');
            const resp = await fetch(`${API}/api/admin/users`, { headers: AUTH_HEADERS });

            if (!resp.ok) {
                console.error('[admin_dashboard] Failed to load users:', resp.status);
                return;
            }

            const data = await resp.json();
            console.log('[admin_dashboard] Users loaded:', data);

            const container = document.getElementById('users-container');
            if (!container) return;

            const users = data.users || [];
            if (users.length === 0) {
                container.innerHTML = '<p class="text-muted">No users registered</p>';
                return;
            }

            let html = `
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            users.forEach(user => {
                html += `<tr><td>${user.email}</td></tr>`;
            });

            html += `
                    </tbody>
                </table>
                <small class="text-muted">Total: ${users.length} users</small>
            `;
            container.innerHTML = html;
        } catch (err) {
            console.error('[admin_dashboard] Error loading users:', err);
        }
    }

    async function handleRetrain(backend) {
        const confirmed = confirm(`Retrain ${backend === 'both' ? 'all models' : 'the ' + backend + ' model'}? This may take a few minutes.`);
        if (!confirmed) return;

        try {
            console.log(`[admin_dashboard] Starting retrain for backend: ${backend}`);
            showNotification(`Retraining ${backend}... Please wait.`, 'info');

            // determine workspace to retrain: prefer selector value, then WORKSPACE
            const wsSelect = document.getElementById('workspace-select');
            const workspaceToUse = (wsSelect && wsSelect.value) ? wsSelect.value : WORKSPACE;

            const resp = await fetch(`${API}/api/active_learning/retrain`, {
                method: 'POST',
                headers: AUTH_HEADERS,
                body: JSON.stringify({
                    workspace_id: workspaceToUse,
                    backend: backend
                })
            });

            const data = await resp.json();
            console.log('[admin_dashboard] Retrain response:', data);

            if (resp.ok && data.status === 'training_complete') {
                showNotification('Retraining completed successfully!', 'success');
                await loadStats();
                await loadModelHealth();
            } else {
                showNotification('Retraining failed: ' + (data.error || JSON.stringify(data)), 'danger');
            }
        } catch (err) {
            console.error('[admin_dashboard] Error during retrain:', err);
            showNotification('Network error: ' + err.message, 'danger');
        }
    }

    function showNotification(message, type = 'info') {
        const toastEl = document.getElementById('notification-toast');
        const messageEl = document.getElementById('notification-message');

        if (!toastEl || !messageEl) return;

        messageEl.innerText = message;
        messageEl.parentElement.className = 'toast-header bg-' + type;

        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

})();
