@echo off
echo ========================================================
echo   LuCI App Dev Simulator (Instant Preview)
echo ========================================================

:: 1. Define Paths
set APP_NAME=phantun
set LOCAL_ROOT=%~dp0
set APP_ROOT=%LOCAL_ROOT%\luci-app-phantun

:: 2. Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b
)

:: 3. Run OpenWrt Container with Mounts
echo Starting OpenWrt container...
echo Mapping: %APP_ROOT%\htdocs -> /www
echo Mapping: %APP_ROOT%\root   -> /

:: Uses immortalwrt/rootfs because it often has opkg feeds set up better
docker run --rm -it --name luci-dev-sim ^
  -p 8080:80 ^
  -v "%APP_ROOT%\htdocs\luci-static\resources\view\%APP_NAME%":/www/luci-static/resources/view/%APP_NAME% ^
  -v "%APP_ROOT%\root\usr\share\rpcd\acl.d":/usr/share/rpcd/acl.d ^
  -v "%APP_ROOT%\root\etc\uci-defaults":/etc/uci-defaults ^
  openwrt/rootfs:x86-64 /bin/sh -c "opkg update && opkg install luci luci-base luci-compat && /etc/init.d/uhttpd start && /etc/init.d/rpcd start && echo 'Simulator Ready at http://localhost:8080' && tr -d '\r' < /etc/uci-defaults/40_luci-app-phantun > /tmp/init.sh && sh /tmp/init.sh && logread -f"

echo.
echo Simulator stopped.
pause
