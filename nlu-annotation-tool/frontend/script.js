(function () {
  const API = 'http://127.0.0.1:5000';
  const TOKEN = localStorage.getItem('nlu_token');
  const WORKSPACE = localStorage.getItem('nlu_workspace');
  if (!TOKEN) window.location.href = 'auth.html';
  if (!WORKSPACE) window.location.href = 'workspace.html';
  const AUTH_HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  const textInput = document.getElementById('text-input');
  const intentInput = document.getElementById('intent-input');
  const entStart = document.getElementById('ent-start');
  const entEnd = document.getElementById('ent-end');
  const entLabel = document.getElementById('ent-label');
  const entitiesList = document.getElementById('entities-list');
  const annotationsPreview = document.getElementById('annotations-preview');
  const modelsMeta = document.getElementById('models-meta');

  let entities = [];

  function renderEntities() {
    entitiesList.textContent = JSON.stringify(entities, null, 2);
  }

  function renderAnnotationsPreview() {
    const preview = {
      text: textInput.value || '',
      intent: intentInput.value || '',
      entities: entities
    };
    annotationsPreview.textContent = JSON.stringify(preview, null, 2);
  }

  document.getElementById('add-entity').addEventListener('click', () => {
    const s = parseInt(entStart.value);
    const e = parseInt(entEnd.value);
    const lab = entLabel.value && entLabel.value.trim();
    if (Number.isNaN(s) || Number.isNaN(e) || !lab) {
      alert('Please provide valid start, end and label for entity.');
      return;
    }
    entities.push({ start: s, end: e, label: lab });
    renderEntities();
    renderAnnotationsPreview();
  });

  document.getElementById('save-annotation').addEventListener('click', async () => {
    const payload = {
      text: textInput.value || '',
      intent: intentInput.value || '',
      entities: entities
    };
    try {
      // workspace-aware annotation save
      payload.workspace_id = WORKSPACE;
      const resp = await fetch(API + '/api/annotations', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (resp.ok) {
        alert('Annotation saved');
        // clear
        entities = [];
        renderEntities();
        renderAnnotationsPreview();
      } else {
        alert('Error saving annotation: ' + (data.error || data.details || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  });

  document.getElementById('train-spacy').addEventListener('click', async () => {
    try {
      const resp = await fetch(API + '/api/train', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ backend: 'spacy', workspace_id: WORKSPACE })
      });
      const data = await resp.json();
      if (resp.ok) {
        alert('spaCy training finished!');
        // Redirect to Module 4 Active Learning after successful training
        setTimeout(() => {
          window.location.href = 'active_learning.html';
        }, 500);
      } else {
        alert('spaCy training failed: ' + (data.error || data.details || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  });

  document.getElementById('train-rasa').addEventListener('click', async () => {
    try {
      const resp = await fetch(API + '/api/train', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ backend: 'rasa', workspace_id: WORKSPACE })
      });
      const data = await resp.json();
      if (resp.ok) {
        alert('Rasa training finished!');
        // Redirect to Module 4 Active Learning after successful training
        setTimeout(() => {
          window.location.href = 'active_learning.html';
        }, 500);
      } else {
        alert('Rasa training failed: ' + (data.error || data.details || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  });

  document.getElementById('fetch-models').addEventListener('click', fetchModelMetadata);

  // Navigation buttons
  document.getElementById('go-to-active-learning').addEventListener('click', () => {
    window.location.href = 'active_learning.html';
  });

  document.getElementById('go-to-admin-dashboard').addEventListener('click', () => {
    window.location.href = 'admin_dashboard.html';
  });

  document.getElementById('go-to-deployment').addEventListener('click', () => {
    window.location.href = 'deployment.html';
  });

  async function fetchModelMetadata() {
    try {
      const resp = await fetch(API + '/api/models?workspace_id=' + encodeURIComponent(WORKSPACE), {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      const data = await resp.json();
      modelsMeta.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      modelsMeta.textContent = 'Error: ' + err.message;
    }
  }

  document.getElementById('do-tokenize').addEventListener('click', async () => {
    const text = document.getElementById('tokenize-text').value || '';
    try {
      const resp = await fetch(API + '/tokenize', {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ text })
      });
      const data = await resp.json();
      document.getElementById('tokenize-result').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      document.getElementById('tokenize-result').textContent = 'Error: ' + err.message;
    }
  });

  // initial rendering
  renderEntities();
  renderAnnotationsPreview();
  fetchModelMetadata();
})();
