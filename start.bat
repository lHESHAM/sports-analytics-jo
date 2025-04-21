@echo off
echo Starting Sports Analytics Application...

echo Starting backend server...
start cmd /k "cd backend && node server.js"

echo Opening frontend in browser...
start "" "frontend\index.html"

echo Application started successfully!
