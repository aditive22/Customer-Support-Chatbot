Write-Host "🔧 Fixing AI Chatbot Docker issues on Windows..." -ForegroundColor Yellow

Write-Host "`n📋 Step 1: Stopping existing containers..." -ForegroundColor Green
docker-compose down

Write-Host "`n🧹 Step 2: Cleaning Docker cache..." -ForegroundColor Green
docker system prune -f

Write-Host "`n🔨 Step 3: Rebuilding containers from scratch..." -ForegroundColor Green
docker-compose build --no-cache

Write-Host "`n🚀 Step 4: Starting services..." -ForegroundColor Green
docker-compose up -d

Write-Host "`n📊 Step 5: Checking container status..." -ForegroundColor Green
docker-compose ps

Write-Host "`n⏳ Step 6: Waiting for services to initialize..." -ForegroundColor Green
Start-Sleep -Seconds 15

Write-Host "`n🏥 Step 7: Testing health endpoint..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 10
    Write-Host "✅ SUCCESS: Chatbot is running!" -ForegroundColor Green
    Write-Host "🌐 Open your browser to: http://localhost:3001" -ForegroundColor Cyan
    Write-Host "📊 Health Status: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Services are still starting..." -ForegroundColor Yellow
    Write-Host "📜 Check logs with: docker-compose logs -f chatbot" -ForegroundColor Cyan
}

Write-Host "`n📜 To view real-time logs:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f chatbot" -ForegroundColor White

Write-Host "`n🔍 To debug issues:" -ForegroundColor Yellow
Write-Host "   docker-compose exec chatbot sh" -ForegroundColor White

Write-Host "`n✨ Chatbot should be available at:" -ForegroundColor Green
Write-Host "   🌐 Main Interface: http://localhost:3001" -ForegroundColor Cyan
Write-Host "   🏥 Health Check:  http://localhost:3001/health" -ForegroundColor Cyan

Read-Host "`nPress Enter to continue..."
