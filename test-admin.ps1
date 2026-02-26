# Test admin endpoints

Write-Host "=== Testing Admin Endpoints ===" -ForegroundColor Cyan

# 1. Login as testbuyer (confirmed account)
Write-Host "`n1. Login as testbuyer..." -ForegroundColor Yellow
$loginBody = @{
    email = "testbuyer@st.ug.edu.gh"
    password = "TestPass123"
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
    Write-Host "Users count: $($users.Count)"

    # 4. Get all products
    Write-Host "`n4. Get all products..." -ForegroundColor Yellow
    $products = Invoke-RestMethod -Uri "http://localhost:5000/admin/products" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Products count: $($products.Count)"

    # 5. Get all orders
    Write-Host "`n5. Get all orders..." -ForegroundColor Yellow
    $orders = Invoke-RestMethod -Uri "http://localhost:5000/admin/orders" -Method GET -Headers @{Authorization = "Bearer $token"}
    Write-Host "Orders count: $($orders.Count)"

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
