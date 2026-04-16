@echo off
setlocal

echo ========================================
echo Driver Fleet Management - Versioned Push
echo ========================================

cd /d C:\DriverFleetManagement
if errorlevel 1 (
 echo ERROR: Folder not found
 pause
 exit /b 1
)

echo Creating version number...
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%d-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set mytime=%%a%%b

set VERSION=v%mydate%_%mytime%

echo %VERSION% > VERSION.txt

echo Cleaning node_modules...
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul

echo Installing dependencies...
npm install --omit=dev

echo Ensuring .gitignore...
if not exist .gitignore (
(
echo node_modules
echo .env
echo uploads
echo *.log
echo .DS_Store
)> .gitignore
)

git rm -r --cached node_modules 2>nul

echo Git commit with version...
git add .
git commit -m "Deploy %VERSION%" 2>nul

echo Push to GitHub...
git push

echo ========================================
echo VERSION DEPLOYED: %VERSION%
echo ========================================

pause
