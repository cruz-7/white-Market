# Test admin endpoints with admin account

Write-Host "=== Testing Admin Endpoints (Admin Account) ===" -ForegroundColor Cyan

# 1. Login as admin
Write-Host "`n1. Login as admin..." -ForegroundColor Yellow
$loginBody = @{
    email = "reavugla@st.ug.edu.gh"
    password = "Reakadmin@123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "Login response received"

    $token = $loginResponse.access_token
    Write-Host "Token: $($token.Substring(0, 20))..."

    # 2. Get admin stats
    Write-Host "`n2. Get admin stats..." -ForegroundColor Yellow
    $stats = Invoke-RestMethod -Uri "http://localhost:5000/admin/stats" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Stats: $($stats | ConvertTo-Json -Depth 3)"

    # 3. Get all users
    Write-Host "`n3. Get all users..." -ForegroundColor Yellow
    $users = Invoke-RestMethod -Uri "http://localhost:5000/admin/users" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Users: $($users | ConvertTo-Json -Depth 2)"

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
