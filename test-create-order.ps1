# Login as buyer
$loginBody = @{
    email = "testbuyer@st.ug.edu.gh"
    password = "TestPass123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$loginJson = $loginResponse.Content | ConvertFrom-Json
$token = $loginJson.access_token
$buyerId = $loginJson.user.id

Write-Host "Buyer ID: $buyerId"

# Get a product to order
$productsResponse = Invoke-WebRequest -Uri "http://localhost:5000/products" -UseBasicParsing
$products = $productsResponse.Content | ConvertFrom-Json
$product = $products[0]

Write-Host "Ordering product: $($product.title) for GHS $($product.price)"
Write-Host "Seller ID: $($product.seller_id)"

# Create order
$orderBody = @{
    product_id = $product.id
    seller_id = $product.seller_id
    amount = $product.price
} | ConvertTo-Json

$orderResponse = Invoke-WebRequest -Uri "http://localhost:5000/orders" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$order = $orderResponse.Content | ConvertFrom-Json
Write-Host "Order created: $($order.id)"
Write-Host "Order status: $($order.status)"
