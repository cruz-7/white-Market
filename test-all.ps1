# Login first
$loginBody = @{
    email = "testbuyer@st.ug.edu.gh"
    password = "TestPass123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$loginJson = $loginResponse.Content | ConvertFrom-Json
$token = $loginJson.access_token

Write-Host "=== Testing protected/me ===" 
$meResponse = Invoke-WebRequest -Uri "http://localhost:5000/protected/me" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
Write-Host $meResponse.Content
