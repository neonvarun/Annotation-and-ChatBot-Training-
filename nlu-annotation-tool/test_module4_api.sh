#!/bin/bash
# Module 4 API Testing Script
# Run this script to test all Module 4 endpoints
# Prerequisites:
#   - Backend running on http://127.0.0.1:5000
#   - Have a valid JWT token in localStorage (get from browser console)
#   - Have a workspace created

# Configuration
API_URL="http://127.0.0.1:5000"
WORKSPACE_ID="test_workspace"
TOKEN="your_jwt_token_here"  # Replace with actual token from browser console

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Module 4 API Testing ===${NC}\n"

# Function to print section headers
print_header() {
    echo -e "${YELLOW}>>> $1${NC}"
}

# Function to test endpoints
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    print_header "$description"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint" | jq '.'
    else
        echo "Payload: $data"
        curl -s -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint" | jq '.'
    fi
    echo -e "\n"
}

# ============================================================================
# ACTIVE LEARNING ENDPOINTS
# ============================================================================

echo -e "${BLUE}========== ACTIVE LEARNING ENDPOINTS ==========${NC}\n"

# 1. Get Uncertain Samples
test_endpoint "GET" \
    "/api/active_learning/uncertain_samples?workspace_id=$WORKSPACE_ID" \
    "" \
    "1. Get Uncertain Samples"

# 2. Add a sample for testing (if needed)
# This would require generating uncertain samples first
# For now, mark a sample as reviewed (assuming sample_1 exists)
test_endpoint "POST" \
    "/api/active_learning/mark_reviewed" \
    "{\"workspace_id\": \"$WORKSPACE_ID\", \"sample_id\": \"sample_test_1\", \"action\": \"reviewed\"}" \
    "2. Mark Sample as Reviewed"

# 3. Add sample to training set
test_endpoint "POST" \
    "/api/active_learning/mark_reviewed" \
    "{\"workspace_id\": \"$WORKSPACE_ID\", \"sample_id\": \"sample_test_2\", \"action\": \"add_to_training\"}" \
    "3. Add Sample to Training Set"

# 4. Mark sample for re-annotation
test_endpoint "POST" \
    "/api/active_learning/mark_reviewed" \
    "{\"workspace_id\": \"$WORKSPACE_ID\", \"sample_id\": \"sample_test_3\", \"action\": \"reannotate\"}" \
    "4. Mark Sample for Re-annotation"

# 5. Retrain Spacy Model
print_header "5. Retrain Spacy Model Only"
echo "Endpoint: POST /api/active_learning/retrain"
echo "Payload: {\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"spacy\"}"
echo -e "${YELLOW}Note: This will take 10-30 seconds...${NC}"
curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"spacy\"}" \
    "$API_URL/api/active_learning/retrain" | jq '.'
echo -e "\n"

# 6. Retrain Rasa Model
print_header "6. Retrain Rasa Model Only"
echo "Endpoint: POST /api/active_learning/retrain"
echo "Payload: {\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"rasa\"}"
echo -e "${YELLOW}Note: This will take 30-60 seconds...${NC}"
curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"rasa\"}" \
    "$API_URL/api/active_learning/retrain" | jq '.'
echo -e "\n"

# 7. Retrain Both Models
print_header "7. Retrain Both Models"
echo "Endpoint: POST /api/active_learning/retrain"
echo "Payload: {\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"both\"}"
echo -e "${YELLOW}Note: This will take 40-90 seconds...${NC}"
curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": \"$WORKSPACE_ID\", \"backend\": \"both\"}" \
    "$API_URL/api/active_learning/retrain" | jq '.'
echo -e "\n"

# ============================================================================
# ADMIN DASHBOARD ENDPOINTS
# ============================================================================

echo -e "${BLUE}========== ADMIN DASHBOARD ENDPOINTS ==========${NC}\n"

# 8. Get Workspace Statistics
test_endpoint "GET" \
    "/api/admin/stats?workspace_id=$WORKSPACE_ID" \
    "" \
    "8. Get Workspace Statistics"

# 9. Get Registered Users
test_endpoint "GET" \
    "/api/admin/users" \
    "" \
    "9. Get Registered Users List"

# 10. Get Model Health
test_endpoint "GET" \
    "/api/admin/model_health?workspace_id=$WORKSPACE_ID" \
    "" \
    "10. Get Model Health Metrics"

# ============================================================================
# DEPLOYMENT ENDPOINTS
# ============================================================================

echo -e "${BLUE}========== DEPLOYMENT ENDPOINTS ==========${NC}\n"

# 11. Get Deployment Status
test_endpoint "GET" \
    "/api/deployment/status?workspace_id=$WORKSPACE_ID" \
    "" \
    "11. Get Deployment Status"

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${GREEN}=== Testing Complete ===${NC}"
echo ""
echo "Summary of Module 4 Endpoints:"
echo "  ✅ Active Learning (3 endpoints):"
echo "     - GET  /api/active_learning/uncertain_samples"
echo "     - POST /api/active_learning/mark_reviewed"
echo "     - POST /api/active_learning/retrain"
echo ""
echo "  ✅ Admin Dashboard (3 endpoints):"
echo "     - GET  /api/admin/stats"
echo "     - GET  /api/admin/users"
echo "     - GET  /api/admin/model_health"
echo ""
echo "  ✅ Deployment (1 endpoint):"
echo "     - GET  /api/deployment/status"
echo ""
echo "Total: 7 new endpoints"
echo ""
echo "Notes:"
echo "  - Replace TOKEN variable with your actual JWT token from browser console"
echo "  - Replace WORKSPACE_ID with your actual workspace name"
echo "  - Some sample_id values are examples; use real sample IDs from your workspace"
echo "  - Training endpoints may take several minutes to complete"
echo ""

# ============================================================================
# ADDITIONAL HELPER COMMANDS
# ============================================================================

cat << 'EOF'
=== Helpful Commands for Manual Testing ===

1. Get your JWT token from browser console:
   localStorage.getItem('nlu_token')

2. Get your workspace ID from browser console:
   localStorage.getItem('nlu_workspace')

3. Test single endpoint with custom workspace:
   curl -X GET \
     -H "Authorization: Bearer YOUR_TOKEN" \
     "http://127.0.0.1:5000/api/admin/stats?workspace_id=YOUR_WORKSPACE"

4. Pretty print JSON response:
   curl ... | jq '.'

5. Check if backend is running:
   curl http://127.0.0.1:5000/

6. View detailed error messages:
   Add -v flag to curl command for verbose output

7. Test without jq (if not installed):
   Remove "| jq '.'" from curl commands

=== Expected Response Examples ===

GET /api/active_learning/uncertain_samples:
  {"samples": []}
  or
  {"samples": [{"sample_id": "...", "text": "...", "predicted_intent": "...", "confidence": 0.65}]}

GET /api/admin/stats:
  {"total_annotations": 42, "entity_types": [...], "intents": [...], ...}

GET /api/admin/users:
  {"users": [{"email": "test@example.com"}], "total": 1}

POST /api/active_learning/retrain:
  {"status": "training_complete", "workspace_id": "test_workspace", "results": {...}}

GET /api/deployment/status:
  {"version": "1.0.0", "last_deployed": null, "state": "not_deployed", "message": "..."}

EOF

echo ""
echo "Script completed!"
