@echo off
echo 🧪 Testing TypeScript compilation locally...

echo.
echo 📋 Step 1: Installing dependencies...
call npm install

echo.
echo 🔨 Step 2: Testing TypeScript compilation...
call npm run build
if %errorlevel%==0 (
    echo ✅ TypeScript compilation successful!
    echo 📁 Checking dist folder:
    dir dist
) else (
    echo ❌ TypeScript compilation failed!
    echo 💡 Trying with ts-node instead...
    call npx ts-node index.ts --version
)

echo.
echo 🧪 Step 3: Testing ts-node directly...
call npx ts-node --version
if %errorlevel%==0 (
    echo ✅ ts-node is working!
) else (
    echo ❌ ts-node is not working!
)

pause
