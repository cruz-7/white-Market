$body = @{
    email = "reavugla@st.ug.edu.gh"
    password = "Reakadmin@123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/auth/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Login successful"
    Write-Host "User: $($response.user.email)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response: $_"
}
