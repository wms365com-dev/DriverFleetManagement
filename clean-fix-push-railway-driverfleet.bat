@echo off

echo ========================================
echo CLEAN + FIX + PUSH FOR RAILWAY
echo DriverFleetManagement
echo ========================================

cd /d C:\DriverFleetManagement

echo.
echo STEP 1 - Ensure .gitignore exists
if not exist .gitignore (
echo node_modules>>.gitignore
echo .env>>.gitignore
echo uploads>>.gitignore
echo *.log>>.gitignore
echo .DS_Store>>.gitignore
)

echo.
echo STEP 2 - Remove node_modules from git tracking
git rm -r --cached node_modules 2>nul
git rm -r --cached uploads 2>nul
git rm -r --cached data 2>nul

echo.
echo STEP 3 - Delete local node_modules
rmdir /s /q node_modules 2>nul

echo.
echo STEP 4 - Delete package-lock.json
del package-lock.json 2>nul

echo.
echo STEP 5 - Reinstall dependencies
npm install

echo.
echo STEP 6 - Commit clean version
git add .
git commit -m "Clean repo for Railway deploy %date% %time%" 2>nul

echo.
echo STEP 7 - Push to GitHub
git push

echo.
echo ========================================
echo COMPLETE
echo Now redeploy in Railway
echo ========================================

pause
