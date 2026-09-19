# =========================================================
# ORCA End-to-End Smoke Test & Health Verification
# Powershell Test Automation
# =========================================================

param(
    [string]$ApiBase = "http://localhost:8080",
    [string]$WebBase = "http://localhost:3000",
    [string]$WorkspaceId = "018f0000-0000-7000-8000-000000000001"
)

$headers = @{
    "X-Workspace-ID" = $WorkspaceId
    "Content-Type"   = "application/json"
}

$passed = 0
$failed = 0

function Assert-Test {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    Write-Host -NoNewline "Testing: $Name ... "
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-Host "PASS" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "FAIL" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host "ERROR ($($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " ORCA End-to-End Smoke Test & Verification Suite" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Target API: $ApiBase"
Write-Host "Target Web: $WebBase"
Write-Host "Workspace:  $WorkspaceId"
Write-Host "---------------------------------------------------------"

# 1. Healthcheck
Assert-Test "Backend Healthcheck (/healthz)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/healthz" -TimeoutSec 5
    return ($res.status -eq "ok")
}

# 2. Spaces API
Assert-Test "Spaces Ingestion (/api/v1/spaces)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/spaces" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 4)
}

# 3. Projects API
Assert-Test "Projects Hub (/api/v1/projects)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/projects" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 4. Tasks Inbox API
Assert-Test "Inbox Tasks (/api/v1/tasks?inbox=true)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/tasks?inbox=true" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 5. Project Tasks API
Assert-Test "Project Execution Tasks (/api/v1/tasks)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/tasks" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 6. Documents API
Assert-Test "Editorial Documents (/api/v1/documents)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/documents" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 7. Note Boards API
Assert-Test "Milanote Spatial Boards (/api/v1/boards)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/boards" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 8. Note Blocks on Board API
Assert-Test "Milanote Canvas Blocks (/api/v1/boards/:id/blocks)" {
    $boards = Invoke-RestMethod -Uri "$ApiBase/api/v1/boards" -Headers $headers -TimeoutSec 5
    if ($boards.data.Count -gt 0) {
        $boardId = $boards.data[0].id
        $blocks = Invoke-RestMethod -Uri "$ApiBase/api/v1/boards/$boardId/blocks" -Headers $headers -TimeoutSec 5
        return ($blocks.data -ne $null -and $blocks.data.Count -ge 1)
    }
    return $false
}

# 9. Calendar Events API
Assert-Test "Calendar Temporal Matrix Events (/api/v1/events)" {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/v1/events" -Headers $headers -TimeoutSec 5
    return ($res.data -ne $null -and $res.data.Count -ge 1)
}

# 10. Frontend Web Application Serving
Assert-Test "SolidJS SPA Serving ($WebBase/)" {
    $webRes = Invoke-WebRequest -Uri "$WebBase" -UseBasicParsing -TimeoutSec 5
    return ($webRes.StatusCode -eq 200 -and $webRes.Content.Contains('id="root"'))
}

Write-Host "---------------------------------------------------------"
$summaryColor = if ($failed -eq 0) { "Green" } else { "Red" }
Write-Host "Smoke Test Results: $passed Passed, $failed Failed." -ForegroundColor $summaryColor
Write-Host "=========================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
