/**
 * frontend/deployment.js
 * Deployment module: pipeline management, status checks, placeholders
 * 
 * Storage keys used:
 * - localStorage.nlu_token: JWT token for API auth
 * - localStorage.nlu_workspace: current workspace ID
 * 
 * API endpoints:
 * - GET /api/deployment/status?workspace_id=<id>
 */

(function () {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');

    // Redirect to login if not authenticated
    if (!TOKEN) {
        console.warn('[deployment] No token found, redirecting to auth');
        window.location.replace('auth.html');
        throw new Error('No token');
    }

    // Redirect to workspace selection only if no workspace
    if (!WORKSPACE) {
        console.warn('[deployment] No workspace found, redirecting to workspace selection');
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search || 'deployment.html');
        window.location.replace(`workspace.html?return_to=${returnTo}`);
        throw new Error('No workspace');
    }

    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    document.addEventListener('DOMContentLoaded', async function () {
        console.log('[deployment] DOM loaded, initializing...');

        // Load deployment status
        await loadDeploymentStatus();

        // Populate health details for first time
        await populateHealthDetails();
    });

    async function loadDeploymentStatus() {
        try {
            console.log('[deployment] Loading deployment status...');
            const resp = await fetch(
                `${API}/api/deployment/status?workspace_id=${WORKSPACE}`,
                { headers: AUTH_HEADERS }
            );

            if (!resp.ok) {
                console.error('[deployment] Failed to load status:', resp.status);
                return;
            }

            const status = await resp.json();
            console.log('[deployment] Status loaded:', status);

            const container = document.getElementById('deployment-status-container');
            if (!container) return;

            const deployedState = status.state || 'not_deployed';
            const stateClass = deployedState === 'deployed' ? 'text-success' : 'text-warning';
            const lastDeployed = status.last_deployed ? new Date(status.last_deployed).toLocaleString() : 'Never';

            let html = `
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Version:</strong> ${status.version || '1.0.0'}</p>
                        <p><strong>State:</strong> <span class="${stateClass}">${deployedState.toUpperCase()}</span></p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Last Deployed:</strong> ${lastDeployed}</p>
                        <p><strong>Status:</strong> ${status.message || 'No deployments yet'}</p>
                    </div>
                </div>
            `;
            container.innerHTML = html;
            
            // Load deployment history
            loadDeploymentHistory(status.history || []);
        } catch (err) {
            console.error('[deployment] Error loading status:', err);
        }
    }
    
    function loadDeploymentHistory(history) {
        const container = document.getElementById('deployment-history-container');
        if (!container) return;
        
        if (!history || history.length === 0) {
            container.innerHTML = '<p class="text-muted">No deployment history available</p>';
            return;
        }
        
        let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Date & Time</th><th>Image</th><th>Container</th><th>Port</th><th>Status</th></tr></thead><tbody>';
        
        history.forEach(deploy => {
            const timestamp = new Date(deploy.timestamp).toLocaleString();
            const statusBadge = deploy.status === 'success' ? 
                '<span class="badge bg-success">Success</span>' : 
                '<span class="badge bg-danger">Failed</span>';
            
            html += `
                <tr>
                    <td>${timestamp}</td>
                    <td><code>${deploy.image_name || 'N/A'}</code></td>
                    <td>${deploy.container_name || 'N/A'}</td>
                    <td>${deploy.port_mapping || 'N/A'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    async function populateHealthDetails() {
        try {
            const resp = await fetch(
                `${API}/api/deployment/status?workspace_id=${WORKSPACE}`,
                { headers: AUTH_HEADERS }
            );

            if (resp.ok) {
                const status = await resp.json();
                const container = document.getElementById('health-details');
                if (container) {
                    const lastDeployed = status.last_deployed ? new Date(status.last_deployed).toLocaleString() : 'Never';
                    const stateClass = status.state === 'deployed' ? 'success' : 'warning';
                    
                    let historyHtml = '';
                    if (status.history && status.history.length > 0) {
                        const latest = status.history[0];
                        historyHtml = `
                            <hr />
                            <h6>Latest Deployment Details:</h6>
                            <p><strong>Image:</strong> <code>${latest.image_name || 'N/A'}</code></p>
                            <p><strong>Container Name:</strong> ${latest.container_name || 'N/A'}</p>
                            <p><strong>Container ID:</strong> <code>${latest.container_id || 'N/A'}</code></p>
                            <p><strong>Port Mapping:</strong> ${latest.port_mapping || 'N/A'}</p>
                            <p><strong>Access URL:</strong> <a href="http://localhost:${latest.port_mapping ? latest.port_mapping.split(':')[0] : '8080'}" target="_blank">http://localhost:${latest.port_mapping ? latest.port_mapping.split(':')[0] : '8080'}</a></p>
                        `;
                    }
                    
                    container.innerHTML = `
                        <div class="alert alert-${stateClass}">
                            <h6>Deployment Health Status</h6>
                            <p><strong>Version:</strong> ${status.version}</p>
                            <p><strong>State:</strong> ${status.state ? status.state.toUpperCase() : 'NOT DEPLOYED'}</p>
                            <p><strong>Last Deployed:</strong> ${lastDeployed}</p>
                            <p><strong>Status:</strong> ${status.message || 'No deployments yet'}</p>
                            ${historyHtml}
                        </div>
                    `;
                }
            }
        } catch (err) {
            console.error('[deployment] Error populating health details:', err);
        }
    }

})();

// Global function to reload deployment status
async function loadDeploymentStatusGlobal() {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');
    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };
    
    try {
        const resp = await fetch(
            `${API}/api/deployment/status?workspace_id=${WORKSPACE}`,
            { headers: AUTH_HEADERS }
        );

        if (!resp.ok) return;

        const status = await resp.json();
        const container = document.getElementById('deployment-status-container');
        if (!container) return;

        const deployedState = status.state || 'not_deployed';
        const stateClass = deployedState === 'deployed' ? 'text-success' : 'text-warning';
        const lastDeployed = status.last_deployed ? new Date(status.last_deployed).toLocaleString() : 'Never';

        let html = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Version:</strong> ${status.version || '1.0.0'}</p>
                    <p><strong>State:</strong> <span class="${stateClass}">${deployedState.toUpperCase()}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Last Deployed:</strong> ${lastDeployed}</p>
                    <p><strong>Status:</strong> ${status.message || 'No deployments yet'}</p>
                </div>
            </div>
        `;
        container.innerHTML = html;
        
        // Reload history
        const historyContainer = document.getElementById('deployment-history-container');
        if (!historyContainer) return;
        
        const history = status.history || [];
        if (!history || history.length === 0) {
            historyContainer.innerHTML = '<p class="text-muted">No deployment history available</p>';
            return;
        }
        
        let historyHtml = '<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Date & Time</th><th>Image</th><th>Container</th><th>Port</th><th>Status</th></tr></thead><tbody>';
        
        history.forEach(deploy => {
            const timestamp = new Date(deploy.timestamp).toLocaleString();
            const statusBadge = deploy.status === 'success' ? 
                '<span class="badge bg-success">Success</span>' : 
                '<span class="badge bg-danger">Failed</span>';
            
            historyHtml += `
                <tr>
                    <td>${timestamp}</td>
                    <td><code>${deploy.image_name || 'N/A'}</code></td>
                    <td>${deploy.container_name || 'N/A'}</td>
                    <td>${deploy.port_mapping || 'N/A'}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
        
        historyHtml += '</tbody></table></div>';
        historyContainer.innerHTML = historyHtml;
    } catch (err) {
        console.error('[deployment] Error reloading status:', err);
    }
}

// Global function to build Docker image
async function buildDockerImage() {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');
    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    const imageName = document.getElementById('docker-image-name').value || 'nlu-tool';
    const tag = document.getElementById('docker-image-tag').value || 'latest';
    const buildBtn = document.getElementById('build-docker-btn');
    const outputDiv = document.getElementById('build-output');
    const outputText = document.getElementById('build-output-text');

    try {
        // Disable button and show loading
        buildBtn.disabled = true;
        buildBtn.innerText = 'Building...';
        outputDiv.classList.remove('d-none');
        outputDiv.classList.remove('alert-success', 'alert-danger');
        outputDiv.classList.add('alert-info');
        outputText.innerText = 'Starting Docker build process...\n\nThis may take 2-3 minutes on first build (downloading Python base image).\nPlease wait...';

        const resp = await fetch(`${API}/api/deployment/build_docker`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                workspace_id: WORKSPACE,
                image_name: imageName,
                tag: tag
            })
        });

        const result = await resp.json();

        if (resp.ok && result.status === 'success') {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-success');
            outputText.innerText = `✓ Success!\n\nImage: ${result.image_name}\nSize: ${result.size_mb} MB\n\n${result.output || ''}`;
            
            // Show success message
            setTimeout(() => {
                alert(`Docker image built successfully!\n\nImage: ${result.image_name}\nSize: ${result.size_mb} MB`);
            }, 500);
        } else {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-danger');
            outputText.innerText = `✗ Build Failed\n\n${result.message || result.error || 'Unknown error'}\n\n${result.output || ''}`;
        }
    } catch (err) {
        console.error('[deployment] Error building Docker image:', err);
        outputDiv.classList.remove('alert-info');
        outputDiv.classList.add('alert-danger');
        outputText.innerText = `✗ Error: ${err.message}`;
    } finally {
        buildBtn.disabled = false;
        buildBtn.innerText = 'Build Docker Image';
    }
}

// Global function to push Docker image
async function pushDockerImage() {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');
    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    const imageName = document.getElementById('push-image-name').value || 'nlu-tool:latest';
    const username = document.getElementById('push-registry-username').value.trim();
    const repoName = document.getElementById('push-repo-name').value || 'nlu-tool';
    const pushBtn = document.getElementById('push-image-btn');
    const outputDiv = document.getElementById('push-output');
    const outputText = document.getElementById('push-output-text');

    if (!username) {
        alert('Please enter your DockerHub username');
        return;
    }

    try {
        pushBtn.disabled = true;
        pushBtn.innerText = 'Pushing...';
        outputDiv.classList.remove('d-none');
        outputDiv.classList.remove('alert-success', 'alert-danger');
        outputDiv.classList.add('alert-info');
        outputText.innerText = 'Pushing Docker image to DockerHub...\\n\\nThis may take several minutes depending on image size.\\nPlease wait...';

        const resp = await fetch(`${API}/api/deployment/push_docker`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                workspace_id: WORKSPACE,
                image_name: imageName,
                username: username,
                repo_name: repoName
            })
        });

        const result = await resp.json();

        if (resp.ok && result.status === 'success') {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-success');
            outputText.innerText = `✓ Success!\\n\\nImage pushed to: ${result.registry_tag}\\n\\n${result.output || ''}`;
            
            setTimeout(() => {
                alert(`Image pushed successfully to DockerHub!\\n\\nRegistry: ${result.registry_tag}`);
            }, 500);
        } else {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-danger');
            outputText.innerText = `✗ Push Failed\\n\\n${result.message || result.error || 'Unknown error'}\\n\\n${result.output || ''}`;
        }
    } catch (err) {
        console.error('[deployment] Error pushing Docker image:', err);
        outputDiv.classList.remove('alert-info');
        outputDiv.classList.add('alert-danger');
        outputText.innerText = `✗ Error: ${err.message}`;
    } finally {
        pushBtn.disabled = false;
        pushBtn.innerText = 'Push to DockerHub';
    }
}

// Global function to deploy container
async function deployContainer() {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');
    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    const imageName = document.getElementById('deploy-image-name').value || 'nlu-tool:latest';
    const containerName = document.getElementById('deploy-container-name').value || 'nlu-tool-container';
    const portMapping = document.getElementById('deploy-port').value || '8080:5000';
    const deployBtn = document.getElementById('deploy-btn');
    const outputDiv = document.getElementById('deploy-output');
    const outputText = document.getElementById('deploy-output-text');

    try {
        deployBtn.disabled = true;
        deployBtn.innerText = 'Deploying...';
        outputDiv.classList.remove('d-none');
        outputDiv.classList.remove('alert-success', 'alert-danger');
        outputDiv.classList.add('alert-info');
        outputText.innerText = 'Deploying Docker container locally...\\nPlease wait...';

        const resp = await fetch(`${API}/api/deployment/deploy_container`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                workspace_id: WORKSPACE,
                image_name: imageName,
                container_name: containerName,
                port_mapping: portMapping
            })
        });

        const result = await resp.json();

        if (resp.ok && result.status === 'success') {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-success');
            outputText.innerText = `✓ Success!\n\nContainer: ${result.container_name}\nContainer ID: ${result.container_id}\n\n${result.output || ''}`;
            
            // Reload deployment status
            setTimeout(async () => {
                await loadDeploymentStatusGlobal();
                alert(`Container deployed successfully!\n\nName: ${result.container_name}\nPort: ${result.port_mapping}`);
            }, 500);
        } else {
            outputDiv.classList.remove('alert-info');
            outputDiv.classList.add('alert-danger');
            outputText.innerText = `✗ Deployment Failed\\n\\n${result.message || result.error || 'Unknown error'}\\n\\n${result.output || ''}`;
        }
    } catch (err) {
        console.error('[deployment] Error deploying container:', err);
        outputDiv.classList.remove('alert-info');
        outputDiv.classList.add('alert-danger');
        outputText.innerText = `✗ Error: ${err.message}`;
    } finally {
        deployBtn.disabled = false;
        deployBtn.innerText = 'Deploy Container';
    }
}

// Global function for placeholder alerts
function showPlaceholderAlert(action) {
    alert(`[Placeholder] ${action} action would be executed here.\n\nThis is a placeholder implementation.\nIn production, this would:\n1. Authenticate with your deployment infrastructure\n2. Execute the deployment pipeline\n3. Monitor progress and report status`);
}

// Global function for refresh
async function refreshHealthStatus() {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');
    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    try {
        const resp = await fetch(
            `${API}/api/deployment/status?workspace_id=${WORKSPACE}`,
            { headers: AUTH_HEADERS }
        );

        if (resp.ok) {
            const status = await resp.json();
            const container = document.getElementById('health-details');
            if (container) {
                const lastDeployed = status.last_deployed ? new Date(status.last_deployed).toLocaleString() : 'Never';
                const stateClass = status.state === 'deployed' ? 'success' : 'warning';
                const refreshTime = new Date().toLocaleString();
                
                let historyHtml = '';
                if (status.history && status.history.length > 0) {
                    const latest = status.history[0];
                    historyHtml = `
                        <hr />
                        <h6>Latest Deployment Details:</h6>
                        <p><strong>Image:</strong> <code>${latest.image_name || 'N/A'}</code></p>
                        <p><strong>Container Name:</strong> ${latest.container_name || 'N/A'}</p>
                        <p><strong>Container ID:</strong> <code>${latest.container_id || 'N/A'}</code></p>
                        <p><strong>Port Mapping:</strong> ${latest.port_mapping || 'N/A'}</p>
                        <p><strong>Access URL:</strong> <a href="http://localhost:${latest.port_mapping ? latest.port_mapping.split(':')[0] : '8080'}" target="_blank">http://localhost:${latest.port_mapping ? latest.port_mapping.split(':')[0] : '8080'}</a></p>
                    `;
                }
                
                container.innerHTML = `
                    <div class="alert alert-${stateClass}">
                        <h6>Deployment Health Status (Refreshed)</h6>
                        <p><strong>Version:</strong> ${status.version}</p>
                        <p><strong>State:</strong> ${status.state ? status.state.toUpperCase() : 'NOT DEPLOYED'}</p>
                        <p><strong>Last Deployed:</strong> ${lastDeployed}</p>
                        <p><strong>Status:</strong> ${status.message || 'No deployments yet'}</p>
                        <p><strong>Refreshed At:</strong> ${refreshTime}</p>
                        ${historyHtml}
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error('[deployment] Error refreshing health:', err);
    }
}
