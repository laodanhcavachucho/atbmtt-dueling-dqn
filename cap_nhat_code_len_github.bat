@echo off
chcp 65001 >nul
set "GIT_EXE=C:\Users\thinh\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

cd /d "%~dp0"
echo ====================================================================
echo   TỰ ĐỘNG CẬP NHẬT SOURCE CODE LÊN GITHUB ^& NETLIFY (ATBMTT)
echo ====================================================================
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Cap nhat giao dien va mo phong Dueling DQN (%DATE% %TIME%)"
"%GIT_EXE%" push -u origin main
echo.
echo [HOÀN TẤT] Đã đẩy code mới lên GitHub! Netlify sẽ tự động cập nhật sau 5-10 giây.
pause
