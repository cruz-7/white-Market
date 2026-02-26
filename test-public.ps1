# Test public products endpoint (no auth required)
Write-Host "=== Testing public products ===" 
$productsResponse = Invoke-WebRequest -Uri "http://localhost:5000/products" -UseBasicParsing
Write-Host $productsResponse.Content

# Login as buyer
$loginBody = @{
    email = "testbuyer@st.ug.edu.gh"
    password = "TestPass123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$loginJson = $loginResponse.Content | ConvertFrom-Json
$token = $loginJson.access_token
$buyerId = $loginJson.user.id

Write-Host "`n=== Buyer ID: $buyerId ==="

# Test my orders
Write-Host "`n=== Testing my orders (buyer) ===" 
$ordersResponse = Invoke-WebRequest -Uri "http://localhost:5000/orders/my-orders" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
Write-Host $ordersResponse.Content
