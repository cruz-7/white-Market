# Create a test admin user

Write-Host "=== Creating Test Admin User ===" -ForegroundColor Cyan

$signupBody = @{
    email = "admin@test.com"
    password = "Admin123!"
    full_name = "Test Admin"
} | ConvertTo-Json

try {
    Write-Host "Creating admin user..."
    $response = Invoke-WebRequest -Uri "http://localhost:5000/auth/signup" -Method POST -Body $signupBody -ContentType "application/json" -UseBasicParsing
    Write-Host $response.Content
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

# Now login
Write-Host "`n=== Login as admin ===" -ForegroundColor Cyan
$loginBody = @{
    email = "admin@test.com"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "Login successful"
    
    $token = $loginResponse.access_token
    
    # Test admin stats
    Write-Host "`n=== Test Admin Stats ===" -ForegroundColor Cyan
    $stats = Invoke-RestMethod -Uri "http://localhost:5000/admin/stats" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Stats: $($stats | ConvertTo-Json -Depth 3)"
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
