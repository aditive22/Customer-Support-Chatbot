@echo off
echo 🔧 Fixing AI Chatbot Docker issues on Windows...

echo.
echo 📋 Step 1: Stopping existing containers...
docker-compose down

echo.
echo 🧹 Step 2: Removing old images and containers...
docker-compose down --rmi all --volumes --remove-orphans

echo.
echo 🗑️ Step 3: Cleaning Docker cache thoroughly...
docker system prune -a -f

echo.
echo 🔨 Step 4: Rebuilding containers from scratch...
docker-compose build --no-cache --pull

echo.
echo 🚀 Step 5: Starting services...
docker-compose up -d

echo.
echo 📊 Step 6: Checking container status...
docker-compose ps

echo.
echo ⏳ Step 7: Waiting for services to initialize...
timeout /t 20 /nobreak >nul

echo.
echo 🔍 Step 8: Checking what's inside the container...
docker-compose exec chatbot ls -la

echo.
echo 📋 Step 9: Checking if TypeScript files exist...
docker-compose exec chatbot ls -la index.ts

echo.
echo 🏥 Step 10: Testing health endpoint...
curl -f http://localhost:3001/health 2>nul
if %errorlevel%==0 (
    echo ✅ SUCCESS: Chatbot is running!
    echo 🌐 Open your browser to: http://localhost:3001
) else (
    echo ⚠️ Services are still starting or there's an issue...
    echo 📜 Showing recent logs:
    docker-compose logs --tail=20 chatbot
)

echo.
echo 📋 Useful commands:
echo    📜 View logs: docker-compose logs -f chatbot
echo    🔍 Debug: docker-compose exec chatbot sh
echo    🔄 Restart: docker-compose restart chatbot
pause
