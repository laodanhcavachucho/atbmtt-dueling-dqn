@echo off
chcp 65001 >nul
set "GIT_EXE=C:\Users\thinh\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

echo ====================================================================
echo   1. CẬP NHẬT KHO FULL SOURCE (atbmtt-dueling-dqn)
echo ====================================================================
cd /d "%~dp0"
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Cap nhat giao dien va mo phong Dueling DQN"
"%GIT_EXE%" push -u origin main

echo.
echo ====================================================================
echo   2. ĐỒNG BỘ TRỰC TIẾP LÊN REPO NETLIFY-BOT (laodanhcavachucho-atbmtt-dueling-dqn)
echo ====================================================================
cd /d "%~dp0public"
if not exist ".git" (
    "%GIT_EXE%" init -b main
    "%GIT_EXE%" config user.name "thinh"
    "%GIT_EXE%" config user.email "thinh@users.noreply.github.com"
    "%GIT_EXE%" remote add origin https://github.com/laodanhcavachucho/laodanhcavachucho-atbmtt-dueling-dqn.git
)
"%GIT_EXE%" pull origin main --allow-unrelated-histories --no-edit 2>nul
"%GIT_EXE%" add index.html app.js engine.js styles.css supabase-service.js supabase_schema.sql attack-sandbox.html attack-sandbox.js _redirects
"%GIT_EXE%" commit -m "Cap nhat giao dien Web Mo phong Dueling DQN"
"%GIT_EXE%" push -u origin main --force

echo.
echo [HOÀN TẤT 100%%] Đã đồng bộ lên GitHub và Netlify sẽ tự động cập nhật sau 5 giây!
pause
