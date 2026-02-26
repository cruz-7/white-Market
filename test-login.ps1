$body = @{
    email = "reavugla@st.ug.edu.gh"
    password = "Reakadmin@123"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:5000/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
Write-Host $response.Content
