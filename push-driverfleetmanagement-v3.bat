@echo off
setlocal

echo ========================================
echo Driver Fleet Management V3 Push
echo ========================================

cd /d C:\DriverFleetManagement
if errorlevel 1 (
    echo ERROR: Folder not found: C:\DriverFleetManagement
    pause
    exit /b 1
)

echo Ensuring .gitignore exists...
if not exist .gitignore (
    (
        echo node_modules
        echo .env
        echo uploads
        echo *.log
        echo .DS_Store
    ) > .gitignore
)

echo Removing tracked node_modules if needed...
git rm -r --cached node_modules 2>nul

echo Initializing git if needed...
git init

echo Setting branch to main...
git branch -M main

echo Setting GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/wms365com-dev/DriverFleetManagement.git

echo Adding files...
git add .

echo Committing changes...
git commit -m "Deploy secure Railway version %date% %time%" 2>nul

echo Pushing to GitHub...
git push -u origin main

echo ========================================
echo PUSH COMPLETE
echo Now redeploy in Railway
echo ========================================

pause
