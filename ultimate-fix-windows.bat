@echo off
echo 🔧 ULTIMATE AI Chatbot Docker Fix for Windows

echo.
echo 🧪 TESTING LOCAL BUILD FIRST...
echo =====================================

echo 📋 Testing npm install...
call npm install
if not %errorlevel%==0 (
    echo ❌ NPM install failed! Check your Node.js installation.
    pause
    exit /b 1
)

echo 🔨 Testing TypeScript compilation...
call npm run build
if %errorlevel%==0 (
    echo ✅ Local build works! Using production Docker setup...
    set USE_COMPILED=true
) else (
    echo ⚠️ Local build failed. Using ts-node Docker setup...
    set USE_COMPILED=false
)

echo.
echo 🐳 DOCKER SETUP...
echo ==================

echo 📋 Stopping all containers...
docker-compose down
docker-compose -f docker-compose.simple.yml down

echo 🧹 Cleaning Docker completely...
docker-compose down --rmi all --volumes --remove-orphans
docker system prune -a -f

if "%USE_COMPILED%"=="true" (
    echo 🔨 Using production build approach...
    docker-compose build --no-cache --pull
    docker-compose up -d
) else (
    echo 🔨 Using simple ts-node approach...
    docker-compose -f docker-compose.simple.yml build --no-cache --pull
    docker-compose -f docker-compose.simple.yml up -d
)

echo.
echo ⏳ Waiting for services to start...
timeout /t 15 /nobreak >nul

echo 📊 Container status:
if "%USE_COMPILED%"=="true" (
    docker-compose ps
) else (
    docker-compose -f docker-compose.simple.yml ps
)

echo.
echo 🏥 Testing health endpoint...
curl -f http://localhost:3001/health 2>nul
if %errorlevel%==0 (
    echo.
    echo ✅ SUCCESS! Chatbot is running!
    echo 🌐 Open: http://localhost:3001
    echo 🏥 Health: http://localhost:3001/health
    echo.
) else (
    echo ❌ Still having issues. Let me show you the logs...
    echo.
    if "%USE_COMPILED%"=="true" (
        docker-compose logs --tail=20 chatbot
    ) else (
        docker-compose -f docker-compose.simple.yml logs --tail=20 chatbot
    )
)

echo.
echo 📋 USEFUL COMMANDS:
echo ===================
if "%USE_COMPILED%"=="true" (
    echo 📜 View logs: docker-compose logs -f chatbot
    echo 🔍 Debug: docker-compose exec chatbot sh
    echo 🔄 Restart: docker-compose restart
) else (
    echo 📜 View logs: docker-compose -f docker-compose.simple.yml logs -f chatbot
    echo 🔍 Debug: docker-compose -f docker-compose.simple.yml exec chatbot sh
    echo 🔄 Restart: docker-compose -f docker-compose.simple.yml restart
)

pause
