# Test payment flow

Write-Host "=== Testing Payment Flow ===" -ForegroundColor Cyan

# 1. Login as buyer
Write-Host "`n1. Login as buyer..." -ForegroundColor Yellow
$loginBody = @{
    email = "testbuyer@st.ug.edu.gh"
    password = "TestPass123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
Write-Host "Login response:" $loginResponse

$token = $loginResponse.access_token
Write-Host "Token: $($token.Substring(0, 20))..."

# 2. Get products
Write-Host "`n2. Get products..." -ForegroundColor Yellow
$products = Invoke-RestMethod -Uri "http://localhost:5000/products" -Method GET
Write-Host "Products found: $($products.Count)"

if ($products.Count -gt 0) {
    $productId = $products[0].id
    Write-Host "Using product: $productId"

    # 3. Create order
    Write-Host "`n3. Create order..." -ForegroundColor Yellow
    $orderBody = @{
        product_id = $productId
    } | ConvertTo-Json

    $order = Invoke-RestMethod -Uri "http://localhost:5000/orders" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{Authorization = "Bearer $token"}
    Write-Host "Order response: $($order | ConvertTo-Json -Depth 3)"

    $orderId = $order.order_id
    Write-Host "Order ID: $orderId"

    # 4. Initialize payment
    Write-Host "`n4. Initialize payment for order: $orderId" -ForegroundColor Yellow
    $paymentBody = @{
        order_id = $orderId
    } | ConvertTo-Json

    try {
        $payment = Invoke-RestMethod -Uri "http://localhost:5000/payments/initialize" -Method POST -Body $paymentBody -ContentType "application/json" -Headers @{Authorization = "Bearer $token"}
        Write-Host "Payment initialized successfully!" -ForegroundColor Green
        Write-Host "Response: $($payment | ConvertTo-Json -Depth 3)"
        
        if ($payment.authorization_url) {
            Write-Host "`n=== PAYMENT URL ===" -ForegroundColor Cyan
            Write-Host $payment.authorization_url
            Write-Host "====================`n" -ForegroundColor Cyan
        }
    } catch {
        $_.Exception.Response
        Write-Host "Payment init error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
