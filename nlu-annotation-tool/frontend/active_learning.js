/**
 * frontend/active_learning.js
 * Active Learning module: manage uncertain samples, re-annotation, and retrain workflow
 * 
 * Storage keys used:
 * - localStorage.nlu_token: JWT token for API auth
 * - localStorage.nlu_workspace: current workspace ID
 * 
 * API endpoints:
 * - GET /api/active_learning/uncertain_samples?workspace_id=<id>
 * - POST /api/active_learning/mark_reviewed
 * - POST /api/active_learning/retrain
 * - GET /api/admin/model_health?workspace_id=<id>
 */

(function () {
    const API = 'http://127.0.0.1:5000';
    const TOKEN = localStorage.getItem('nlu_token');
    const WORKSPACE = localStorage.getItem('nlu_workspace');

    // Redirect to login if not authenticated
    if (!TOKEN) {
        console.warn('[active_learning] No token found, redirecting to auth');
        window.location.replace('auth.html');
        throw new Error('No token');
    }

    // Redirect to workspace selection only if no workspace
    if (!WORKSPACE) {
        console.warn('[active_learning] No workspace found, redirecting to workspace selection');
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search || 'active_learning.html');
        window.location.replace(`workspace.html?return_to=${returnTo}`);
        throw new Error('No workspace');
    }

    const AUTH_HEADERS = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    let currentSamples = [];
    let reannotateModal = null;
    let currentReannotationSampleId = null;

    document.addEventListener('DOMContentLoaded', async function () {
        console.log('[active_learning] DOM loaded, initializing...');

        // Initialize Bootstrap modal
        const modalElement = document.getElementById('reannotateModal');
        if (modalElement) {
            reannotateModal = new bootstrap.Modal(modalElement);
        }

        // Load initial data
        await loadUncertainSamples();
        await loadModelAccuracy();

        // Attach event listeners
        attachEventListeners();
    });
    
    // Load model accuracy for current workspace
    async function loadModelAccuracy() {
        try {
            const resp = await fetch(`${API}/api/admin/model_health?workspace_id=${WORKSPACE}`, { headers: AUTH_HEADERS });
            if (!resp.ok) {
                console.error('[active_learning] Failed to load model health:', resp.status);
                return;
            }
            const data = await resp.json();
            console.log('[active_learning] Model health data:', data);
            const accEl = document.getElementById('accuracy-display');
            if (accEl) {
                if (data.accuracy !== null && data.accuracy !== undefined && !isNaN(Number(data.accuracy))) {
                    accEl.innerText = Number(data.accuracy).toFixed(2) + '%';
                } else {
                    accEl.innerText = 'N/A';
                }
            }
        } catch (err) {
            console.error('[active_learning] Error loading model accuracy:', err);
            const accEl = document.getElementById('accuracy-display');
            if (accEl) {
                accEl.innerText = 'Error';
            }
        }
    }

    function attachEventListeners() {
        const retrainBtn = document.getElementById('retrain-both');
        const backBtn = document.getElementById('back-to-annotation');
        const confirmReannotateBtn = document.getElementById('confirm-reannotate');

        if (retrainBtn) {
            retrainBtn.addEventListener('click', handleRetrain);
        } else {
            console.warn('[active_learning] retrain-both button not found');
        }

        if (backBtn) {
            backBtn.addEventListener('click', function () {
                window.location.href = 'index.html';
            });
        } else {
            console.warn('[active_learning] back-to-annotation button not found');
        }

        if (confirmReannotateBtn) {
            confirmReannotateBtn.addEventListener('click', handleConfirmReannotate);
        } else {
            console.warn('[active_learning] confirm-reannotate button not found');
        }
    }

    async function loadUncertainSamples() {
        try {
            console.log('[active_learning] Loading uncertain samples...');
            const resp = await fetch(
                `${API}/api/active_learning/uncertain_samples?workspace_id=${WORKSPACE}`,
                { headers: AUTH_HEADERS }
            );

            if (!resp.ok) {
                console.error('[active_learning] Failed to load samples:', resp.status);
                renderSamplesError('Failed to load samples');
                return;
            }

            const data = await resp.json();
            currentSamples = data.samples || [];
            console.log(`[active_learning] Loaded ${currentSamples.length} samples`);

            renderSamples();
        } catch (err) {
            console.error('[active_learning] Network error loading samples:', err);
            renderSamplesError('Network error: ' + err.message);
        }
    }

    function renderSamples() {
        const container = document.getElementById('samples-container');
        const countEl = document.getElementById('uncertain-count');

        if (!container) {
            console.warn('[active_learning] samples-container not found');
            return;
        }

        if (countEl) {
            countEl.innerText = currentSamples.length;
        }

        if (currentSamples.length === 0) {
            container.innerHTML = '<p class="text-success">No uncertain samples! All predictions are confident.</p>';
            return;
        }

        let html = '';
        currentSamples.forEach((sample, idx) => {
            const sampleId = sample.sample_id || `sample_${idx}`;
            const text = sample.text || '';
            const intent = sample.predicted_intent || 'unknown';
            const confidence = (sample.confidence || 0).toFixed(3);

            html += `
                <div class="sample-card mb-3 p-3 border rounded">
                    <div class="row">
                        <div class="col-md-8">
                            <h6>Sample: <code>${text.substring(0, 80)}${text.length > 80 ? '...' : ''}</code></h6>
                            <p class="mb-1"><strong>Predicted Intent:</strong> ${intent}</p>
                            <p class="mb-2"><strong>Confidence:</strong> ${confidence}</p>
                        </div>
                        <div class="col-md-4 text-end">
                            <button class="btn btn-sm btn-info review-btn" data-sample-id="${sampleId}">Review</button>
                            <button class="btn btn-sm btn-warning reannotate-btn" data-sample-id="${sampleId}">Re-annotate</button>
                            <button class="btn btn-sm btn-success add-btn" data-sample-id="${sampleId}">Add to Training</button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Attach button listeners
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sampleId = e.target.dataset.sampleId;
                await markSampleReviewed(sampleId, 'reviewed');
            });
        });

        document.querySelectorAll('.reannotate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleId = e.target.dataset.sampleId;
                openReannotateModal(sampleId);
            });
        });

        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sampleId = e.target.dataset.sampleId;
                await markSampleReviewed(sampleId, 'add_to_training');
            });
        });
    }

    function renderSamplesError(message) {
        const container = document.getElementById('samples-container');
        if (container) {
            container.innerHTML = `<p class="text-danger">${message}</p>`;
        }
    }

    async function markSampleReviewed(sampleId, action) {
        try {
            console.log(`[active_learning] Marking sample ${sampleId} as ${action}`);
            const resp = await fetch(`${API}/api/active_learning/mark_reviewed`, {
                method: 'POST',
                headers: AUTH_HEADERS,
                body: JSON.stringify({
                    workspace_id: WORKSPACE,
                    sample_id: sampleId,
                    action: action
                })
            });

            const data = await resp.json();
            if (resp.ok && data.status === 'ok') {
                console.log(`[active_learning] Sample marked as ${action}`);
                await loadUncertainSamples();
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[active_learning] Error marking sample:', err);
            alert('Network error: ' + err.message);
        }
    }

    function openReannotateModal(sampleId) {
        const sample = currentSamples.find(s => (s.sample_id || `sample_${currentSamples.indexOf(s)}`) === sampleId);
        if (!sample) {
            alert('Sample not found');
            return;
        }

        currentReannotationSampleId = sampleId;

        const textEl = document.getElementById('reannotate-text');
        const intentEl = document.getElementById('reannotate-intent');
        const entitiesEl = document.getElementById('reannotate-entities');

        if (textEl) textEl.value = sample.text || '';
        if (intentEl) intentEl.value = sample.predicted_intent || '';
        if (entitiesEl) {
            const entities = sample.entities || [];
            if (entities.length > 0) {
                entitiesEl.innerHTML = entities.map(e => 
                    `<div class="badge bg-secondary">${e.label}</div>`
                ).join(' ');
            } else {
                entitiesEl.innerHTML = '<small class="text-muted">No entities</small>';
            }
        }

        if (reannotateModal) {
            reannotateModal.show();
        }
    }

    async function handleConfirmReannotate() {
        if (!currentReannotationSampleId) {
            alert('No sample selected');
            return;
        }

        const intentEl = document.getElementById('reannotate-intent');
        const newIntent = intentEl ? intentEl.value.trim() : '';

        if (!newIntent) {
            alert('Please enter an intent');
            return;
        }

        try {
            console.log('[active_learning] Saving re-annotated sample and retraining');

            // Mark as added to training with new intent
            const sample = currentSamples.find(s => 
                (s.sample_id || `sample_${currentSamples.indexOf(s)}`) === currentReannotationSampleId
            );

            if (sample) {
                sample.intent = newIntent; // Update intent
                await markSampleReviewed(currentReannotationSampleId, 'add_to_training');

                // Close modal
                if (reannotateModal) {
                    reannotateModal.hide();
                }

                // Retrain
                await handleRetrain();
            }
        } catch (err) {
            console.error('[active_learning] Error in reannotation:', err);
            alert('Error: ' + err.message);
        }
    }

    async function handleRetrain() {
        const confirmed = confirm('Start retraining both Spacy and Rasa models? This may take a few minutes.');
        if (!confirmed) return;

        try {
            console.log('[active_learning] Starting retrain for both backends');
            const retrainBtn = document.getElementById('retrain-both');
            if (retrainBtn) {
                retrainBtn.disabled = true;
                retrainBtn.innerText = 'Training...';
            }

            const resp = await fetch(`${API}/api/active_learning/retrain`, {
                method: 'POST',
                headers: AUTH_HEADERS,
                body: JSON.stringify({
                    workspace_id: WORKSPACE,
                    backend: 'both'
                })
            });

            const data = await resp.json();
            console.log('[active_learning] Retrain response:', data);

            if (resp.ok && data.status === 'training_complete') {
                alert('Retraining completed successfully!');
                await loadModelAccuracy();
                await loadUncertainSamples();
            } else {
                alert('Retraining failed: ' + (data.error || JSON.stringify(data)));
            }
        } catch (err) {
            console.error('[active_learning] Network error during retrain:', err);
            alert('Network error: ' + err.message);
        } finally {
            const retrainBtn = document.getElementById('retrain-both');
            if (retrainBtn) {
                retrainBtn.disabled = false;
                retrainBtn.innerText = 'Re-train All Models';
            }
        }
    }

})();
