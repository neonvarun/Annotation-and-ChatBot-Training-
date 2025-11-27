# Module 4 - Testing & Implementation Guide

## Overview
Module 4 adds Active Learning, Admin Dashboard, and Deployment management to the NLU annotation tool. This guide helps you test and verify the implementation.

## Setup & Startup

### 1. Start the Backend Server
```bash
cd rasa_chatbot/nlu-annotation-tool
python backend/app.py
```
Expected output: Flask app running on `http://127.0.0.1:5000`

### 2. Start the Frontend Server
```bash
cd rasa_chatbot/nlu-annotation-tool/frontend
python -m http.server 5500
```
Expected output: Serving on `http://127.0.0.1:5500`

### 3. Open in Browser
Navigate to: `http://127.0.0.1:5500`

## End-to-End Testing Flow

### Phase 1: Authentication & Setup
1. Open `http://127.0.0.1:5500` → Redirects to `auth.html`
2. Register a new user:
   - Email: `test@example.com`
   - Password: `test123`
   - Click **Register**
3. Should see token in localStorage and redirect to workspace selection

### Phase 2: Workspace & Annotation
1. Create a new workspace: `test_workspace`
2. Click workspace to enter annotation module
3. Create a sample annotation:
   - Text: "John works at Microsoft"
   - Intent: `employment`
   - Add entity: "John" → PERSON (0-4)
   - Add entity: "Microsoft" → ORG (14-23)
4. Click **Save Annotation**
5. Create at least 5-10 more annotations with various intents (employment, greeting, inquiry, etc.)

### Phase 3: Model Training
1. Click **Train spaCy** button
2. Wait for training to complete
3. Should see success alert
4. **Should automatically redirect to Active Learning page** ✅

### Phase 4: Active Learning Module
**You are now at `active_learning.html`**

1. **Verify page loads correctly:**
   - Navigation bar visible with links to Annotation, Admin Dashboard, Deployment
   - "Uncertain Samples Queue" section visible
   - "Re-train All Models" button visible

2. **Load Uncertain Samples:**
   - Check if any uncertain samples are displayed (may show "No uncertain samples" if confidence is high)
   - Each sample shows: text, predicted intent, confidence score

3. **Sample Actions (if samples exist):**
   - Click **Review** → Sample removed from uncertain list
   - Click **Add to Training** → Sample moved to annotations, removed from uncertain list
   - Click **Re-annotate** → Modal opens with sample text
     - Update intent if needed
     - Click **Save & Retrain** → Saves and triggers retrain

4. **Retrain Models:**
   - Click **Re-train All Models**
   - Confirm dialog appears
   - Should show "Training..." status
   - After completion: "Retraining completed successfully!"
   - Model health section updates

### Phase 5: Admin Dashboard
1. From Active Learning, click **Admin Dashboard** link in navbar
2. **Verify statistics cards display:**
   - Total Annotations: Should show your annotation count
   - Entity Types: Should show PERSON, ORG, etc.
   - Intent Types: Should show employment, greeting, etc.
   - Uncertain Samples: Should show recent count

3. **Verify Model Health:**
   - Shows last trained timestamp
   - Lists spaCy and Rasa model versions

4. **Verify Users Table:**
   - Shows your registered user email
   - Shows total user count

5. **Quick Actions:**
   - **Go to Active Learning** → Navigates to active_learning.html
   - **Retrain Spacy Model** → Trains only Spacy model
   - **Retrain Rasa Model** → Trains only Rasa model
   - **Retrain All Models** → Trains both models

6. **Retrain Test:**
   - Click any retrain button
   - Confirm dialog appears
   - Should show success notification
   - Statistics update after completion

### Phase 6: Deployment Dashboard
1. From Admin Dashboard, click **Deployment** link in navbar
2. **Verify UI sections:**
   - Current Deployment Status displayed
   - Pipeline steps visible: Build Image, Push to Registry, Deploy, Health Check
   - Each step has its own modal button

3. **Pipeline Interaction:**
   - Click **Build Image** → Modal explains placeholder behavior
   - Click **Proceed** → Shows placeholder alert
   - Repeat for Push Image, Deploy, Check Status
   - All should show placeholder alerts (this is expected)

4. **Health Check Modal:**
   - Click **Check Status**
   - Should display deployment status JSON
   - Click **Refresh** → Status updates with new timestamp

### Phase 7: Navigation Verification
1. **From Annotation Page:**
   - After training should redirect to Active Learning ✅

2. **Cross-page Navigation:**
   - Annotation → Admin Dashboard (via link)
   - Admin Dashboard → Active Learning (via Quick Actions)
   - Active Learning → Deployment (via navbar)
   - Deployment → Admin Dashboard (via back link)
   - Any page → Annotation (via navbar)
   - Any page → Logout (via navbar → auth.html)

## Backend API Testing (curl)

### Get Uncertain Samples
```bash
TOKEN="<your_jwt_token>"
curl "http://127.0.0.1:5000/api/active_learning/uncertain_samples?workspace_id=test_workspace" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"samples": []}`

### Mark Sample Reviewed
```bash
curl -X POST http://127.0.0.1:5000/api/active_learning/mark_reviewed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workspace_id":"test_workspace","sample_id":"sample_1","action":"reviewed"}'
```
Expected: `{"status": "ok", "action": "reviewed"}`

### Retrain Models
```bash
curl -X POST http://127.0.0.1:5000/api/active_learning/retrain \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workspace_id":"test_workspace","backend":"spacy"}'
```
Expected: `{"status": "training_complete", "workspace_id": "test_workspace", "results": {...}}`

### Get Admin Stats
```bash
curl "http://127.0.0.1:5000/api/admin/stats?workspace_id=test_workspace" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: JSON with annotation counts, entity types, intents, etc.

### Get Users
```bash
curl "http://127.0.0.1:5000/api/admin/users" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"users": [{"email": "test@example.com"}], "total": 1}`

### Get Model Health
```bash
curl "http://127.0.0.1:5000/api/admin/model_health?workspace_id=test_workspace" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: JSON with model health metrics

### Get Deployment Status
```bash
curl "http://127.0.0.1:5000/api/deployment/status?workspace_id=test_workspace" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"version": "1.0.0", "last_deployed": null, "state": "not_deployed", "message": "..."}`

## File Location Verification

### Backend Files
```
backend/
├── app.py                          (✅ Updated with Module 4 routes)
├── utils/
│   ├── model_utils.py              (✅ Unchanged - reused)
│   └── active_learning.py          (✅ NEW)
└── api_blueprints/
    ├── auth_api.py                 (✅ Unchanged - reused)
    └── train_api.py                (✅ Unchanged)
```

### Frontend Files
```
frontend/
├── script.js                       (✅ Updated with redirect)
├── index.html                      (✅ Unchanged)
├── auth.html                       (✅ Unchanged)
├── workspace.html                  (✅ Unchanged)
├── active_learning.html            (✅ NEW)
├── active_learning.js              (✅ NEW)
├── active_learning.css             (✅ NEW)
├── admin_dashboard.html            (✅ NEW)
├── admin_dashboard.js              (✅ NEW)
├── admin_dashboard.css             (✅ NEW)
├── deployment.html                 (✅ NEW)
├── deployment.js                   (✅ NEW)
└── deployment.css                  (✅ NEW)
```

### Workspace Data Structure
```
backend/workspaces/test_workspace/
├── data/
│   ├── annotations.json            (Existing annotations)
│   ├── uncertain_samples.json      (NEW - Active learning)
│   ├── intents.json
│   └── entities.json
├── models/
│   ├── spacy_model/
│   │   ├── model_v<timestamp>/
│   │   ├── meta_v<timestamp>.json
│   │   └── metadata.json           (If Spacy was trained)
│   └── rasa_model/
│       ├── models/
│       └── metadata.json
```

## Common Issues & Troubleshooting

### Issue: "No token found, redirecting to auth"
- **Solution:** Clear localStorage or use incognito mode
- **Expected:** Should redirect to auth.html on first visit

### Issue: Active Learning page shows "samples-container not found"
- **Solution:** Check browser console for errors
- **Action:** Verify HTML file loaded completely

### Issue: Training doesn't redirect to Active Learning
- **Solution:** Check browser console for JavaScript errors
- **Check:** Ensure `active_learning.html` exists in frontend directory
- **Verify:** Script.js was updated with redirect logic

### Issue: Admin Dashboard doesn't show statistics
- **Solution:** Ensure workspace has annotations saved
- **Action:** Save at least one annotation first, then navigate to Admin Dashboard
- **Check:** Browser console for API errors

### Issue: "Cannot find uncertain_samples.json"
- **Solution:** This is normal - file is created on first active learning usage
- **Expected:** Backend returns empty array `[]` if file doesn't exist yet

### Issue: Retrain button stuck on "Training..."
- **Solution:** Check backend logs for training errors
- **Action:** May indicate model training is taking longer than expected
- **Wait:** Training can take 1-5 minutes depending on data size

## Success Indicators

✅ **Module 4 Successfully Implemented:**
- [ ] All 9 new files created (3 HTML, 3 JS, 3 CSS)
- [ ] Backend routes respond to requests
- [ ] Frontend pages load without redirecting unexpectedly
- [ ] Navigation between pages works correctly
- [ ] Training completion redirects to Active Learning
- [ ] Active Learning page loads uncertain samples (even if empty)
- [ ] Admin Dashboard displays statistics
- [ ] Deployment page shows placeholder features
- [ ] No console errors in browser DevTools
- [ ] No existing functionality broken
- [ ] No code duplication (functions reused from model_utils.py)

## Performance Notes

- **First load:** May take 2-3 seconds to load all page resources
- **Training:** Spacy takes 10-30 seconds, Rasa takes 30-60 seconds
- **Admin stats:** Should load within 1-2 seconds
- **Deployment status:** Should load instantly (placeholder)

## Additional Features to Test (Optional)

1. **Multiple Workspaces:**
   - Create second workspace
   - Verify data is isolated per workspace

2. **Multiple Users:**
   - Register second user
   - Verify each user only sees their own workspaces

3. **Long Training:**
   - Add 50+ annotations
   - Train and observe progress

4. **Rapid Navigation:**
   - Click between pages quickly
   - Verify no race conditions or data corruption

---

**Last Updated:** November 12, 2025
**Module Status:** ✅ Complete and Ready for Testing
