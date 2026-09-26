@echo off
where gradle >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  gradle %*
  exit /b %ERRORLEVEL%
)
echo Gradle is not installed. Generate/commit the canonical Gradle wrapper or use the GitHub setup-gradle action.
exit /b 1
