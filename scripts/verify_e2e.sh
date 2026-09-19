#!/usr/bin/env bash
# =========================================================
# ORCA End-to-End Smoke Test & Health Verification (Bash)
# =========================================================

API_BASE=${API_BASE:-"http://localhost:8080"}
WEB_BASE=${WEB_BASE:-"http://localhost:3000"}
WORKSPACE_ID=${WORKSPACE_ID:-"018f0000-0000-7000-8000-000000000001"}

PASSED=0
FAILED=0

echo "========================================================="
echo " ORCA End-to-End Smoke Test & Verification Suite"
echo "========================================================="
echo "Target API: $API_BASE"
echo "Target Web: $WEB_BASE"
echo "Workspace:  $WORKSPACE_ID"
echo "---------------------------------------------------------"

assert_test() {
    local name="$1"
    local url="$2"
    local expected_pattern="$3"

    printf "Testing: %s ... " "$name"
    local response
    response=$(curl -s -m 5 -H "X-Workspace-ID: $WORKSPACE_ID" -H "Content-Type: application/json" "$url")
    
    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "\033[0;32mPASS\033[0m"
        PASSED=$((PASSED + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m"
        FAILED=$((FAILED + 1))
    fi
}

assert_test "Backend Healthcheck" "$API_BASE/healthz" '"status":"ok"'
assert_test "Spaces Ingestion" "$API_BASE/api/v1/spaces" '"slug":"kantor"'
assert_test "Projects Hub" "$API_BASE/api/v1/projects" '"name":'
assert_test "Inbox Tasks" "$API_BASE/api/v1/tasks?inbox=true" '"title":'
assert_test "Project Tasks" "$API_BASE/api/v1/tasks" '"status":'
assert_test "Editorial Documents" "$API_BASE/api/v1/documents" '"title":'
assert_test "Milanote Spatial Boards" "$API_BASE/api/v1/boards" '"title":'
assert_test "Calendar Events" "$API_BASE/api/v1/events" '"start_at":'
assert_test "SolidJS SPA Serving" "$WEB_BASE" 'id="root"'

echo "---------------------------------------------------------"
echo "Smoke Test Results: $PASSED Passed, $FAILED Failed."
echo "========================================================="

if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
