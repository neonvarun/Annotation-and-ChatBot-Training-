# Module 4 Quick Reference Guide

## What Was Added?

### Backend
- **1 new utility module:** `backend/utils/active_learning.py`
- **9 new API routes** appended to `backend/app.py`
- **No existing code modified** (all functions reused)

### Frontend
- **3 new HTML pages:** active_learning, admin_dashboard, deployment
- **3 new JS files:** one for each page
- **3 new CSS files:** isolated styling per page
- **1 updated JS file:** script.js (only training redirect changed)

## How Does It Work?

### Flow: Annotation → Training → Active Learning
```
1. User saves annotations via index.html
2. User clicks "Train Model" button
3. Training completes (existing train_api.py logic)
4. Frontend redirects to active_learning.html ✅ NEW
5. User reviews uncertain samples (Module 4) ✅ NEW
6. User can retrain or go to Admin Dashboard (Module 4) ✅ NEW
```

### Active Learning Process
```
Uncertain Samples (low confidence)
         ↓
Review → [Delete] or [Re-annotate] or [Add to Training]
         ↓
Retrain Models (calls existing train functions)
         ↓
Back to Active Learning with updated samples
```

## Key APIs

### Active Learning
```
GET  /api/active_learning/uncertain_samples?workspace_id=X
POST /api/active_learning/mark_reviewed
POST /api/active_learning/retrain
```

### Admin
```
GET  /api/admin/stats?workspace_id=X
GET  /api/admin/users
GET  /api/admin/model_health?workspace_id=X
```

### Deployment
```
GET  /api/deployment/status?workspace_id=X
```

## Storage

### File Locations
```
backend/workspaces/<workspace_id>/
├── data/
│   ├── annotations.json              [existing]
│   └── uncertain_samples.json        [NEW]
└── models/
    ├── spacy_model/
    │   ├── model_v<timestamp>/
    │   └── meta_v<timestamp>.json
    └── rasa_model/
        ├── models/
        └── metadata.json
```

### Auth & Storage
- **Token:** `localStorage.nlu_token`
- **Workspace:** `localStorage.nlu_workspace`
- **Users:** `backend/users.json` (existing)

## Code Reuse Pattern

All Module 4 functions reuse existing code:

```python
# ❌ NOT DONE - Copying trainer functions
def my_train_function():
    # ... duplicate training logic ...

# ✅ DONE - Reusing existing trainers
from utils.model_utils import train_spacy_model, train_rasa_model

def retrain_workspace(workspace_id, backend):
    if backend == 'spacy':
        return train_spacy_model(workspace_base_dir)  # ← Reuse
    else:
        return train_rasa_model(workspace_base_dir)   # ← Reuse
```

## Error Handling

All functions are defensive:

```javascript
// Active Learning JS
if (!TOKEN) window.location.href = 'auth.html';
if (!WORKSPACE) window.location.href = 'workspace.html';

// Element checks
if (element) {
    element.addEventListener(...);
}
```

```python
# Python backend
try:
    # Train logic
except Exception as e:
    print(f"[active_learning] Error: {e}")
    return {'error': str(e)}  # Return error, don't crash
```

## Testing Checklist

- [ ] Backend server starts: `python backend/app.py`
- [ ] Frontend server starts: `python -m http.server 5500`
- [ ] Login works → Redirects to workspace.html
- [ ] Create workspace → Workspace appears
- [ ] Save annotations → Data saved in workspace
- [ ] Train model → Redirects to active_learning.html
- [ ] Active Learning loads → No JS errors in console
- [ ] Admin Dashboard loads → Shows statistics
- [ ] Deployment page loads → Shows pipeline
- [ ] Retrain button works → Training completes
- [ ] Navigation works → All links functional
- [ ] No existing features broken → Original annotation workflow still works

## Browser Console Debugging

Enable verbose logging in console:

```javascript
// Check token
localStorage.getItem('nlu_token')

// Check workspace
localStorage.getItem('nlu_workspace')

// Check API response
fetch('http://127.0.0.1:5000/api/admin/stats?workspace_id=test', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('nlu_token')}`
  }
}).then(r => r.json()).then(d => console.log(d))
```

## Common Module 4 Paths

### To Access Active Learning Data
```python
from utils.active_learning import load_uncertain_samples
samples = load_uncertain_samples('my_workspace')
```

### To Access Admin Stats
```
GET /api/admin/stats?workspace_id=my_workspace
```

### To Retrain From Admin
```python
from utils.active_learning import retrain_workspace
result = retrain_workspace('my_workspace', 'both')
```

## Frontend Page Structure

Each page follows this pattern:

```html
<!-- 1. Bootstrap + custom CSS -->
<link rel="stylesheet" href="bootstrap.min.css">
<link rel="stylesheet" href="page.css">

<!-- 2. Auth check in JS -->
const TOKEN = localStorage.getItem('nlu_token');
const WORKSPACE = localStorage.getItem('nlu_workspace');
if (!TOKEN) window.location.href = 'auth.html';
if (!WORKSPACE) window.location.href = 'workspace.html';

<!-- 3. DOM load before listeners -->
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
});

<!-- 4. Defensive element checks -->
if (element) {
    element.addEventListener(...);
}
```

## Extending Module 4

### Adding a New Feature

1. **Backend:** Add function to `active_learning.py`
2. **Backend:** Add route to `app.py` with `/api/<feature>/...` prefix
3. **Frontend:** Create `<feature>.html`, `<feature>.js`, `<feature>.css`
4. **Frontend:** Add navigation link to navbar
5. **Test:** Verify data flows correctly

### Example: Add Sample Confidence

```python
# 1. In active_learning.py
def add_sample_with_confidence(workspace_id, sample, confidence):
    sample['confidence'] = confidence
    uncertain = load_uncertain_samples(workspace_id)
    uncertain.append(sample)
    save_uncertain_samples(workspace_id, uncertain)

# 2. In app.py
@app.route('/api/active_learning/add_sample', methods=['POST'])
def add_sample():
    payload = request.get_json(force=True)
    add_sample_with_confidence(
        payload['workspace_id'],
        payload['sample'],
        payload['confidence']
    )
    return jsonify({'ok': True})

# 3. In active_learning.js
async function addSampleWithConfidence(sample, confidence) {
    const resp = await fetch(`${API}/api/active_learning/add_sample`, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
            workspace_id: WORKSPACE,
            sample: sample,
            confidence: confidence
        })
    });
    return resp.json();
}
```

## Troubleshooting Quick Links

| Issue | Check |
|-------|-------|
| Page doesn't load | Browser console errors |
| API returns 400 | Missing workspace_id parameter |
| API returns 401 | Invalid/missing token in header |
| Data not saving | Check workspace dir exists |
| Training stuck | Check backend logs |
| No uncertain samples | Marked all as reviewed or created with high confidence |

## Performance Tips

1. **Cache API responses** in JS to avoid repeated calls
2. **Lazy load** admin stats if workspace has >1000 annotations
3. **Paginate** uncertain samples if >100
4. **Use service workers** for offline support (future)

## Security Notes

- ✅ Token-based auth on all endpoints
- ✅ Workspace-scoped data access
- ✅ No sensitive data in localStorage (only token & workspace ID)
- ⚠️ Deployment features are placeholders - add auth before production use

## Performance Metrics

| Operation | Time |
|-----------|------|
| Load Active Learning | 1-2s |
| Load Admin Dashboard | 1-2s |
| Load Deployment | <1s |
| Train Spacy model | 10-30s |
| Train Rasa model | 30-60s |
| Get uncertain samples | <500ms |
| Get admin stats | 1-2s |

---

**For detailed testing:** See `TESTING_GUIDE.md`
**For diagnostics:** See `MODULE4_DIAGNOSTIC.md`
**Implementation date:** November 12, 2025
