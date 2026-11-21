@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

set "LLT_FTP_HOST=37.140.192.56"
set "LLT_FTP_USER=u3726911"
set "LLT_FTP_REMOTE=/www/liblabtab.ru"
set "WINSCP=%ProgramFiles(x86)%\WinSCP\WinSCP.com"
if not exist "%WINSCP%" set "WINSCP=%ProgramFiles%\WinSCP\WinSCP.com"

echo === LibLabTab: сборка и выкладка ===

if not exist "%WINSCP%" (
  echo [!] Не найден WinSCP.com. Установите WinSCP или укажите путь в переменной WINSCP.
  exit /b 1
)

rem Пароль берётся из окружения, а если его там нет — из локального файла вне Git.
if not defined LLT_FTP_PASS (
  if exist "deploy.secret.txt" (
    set /p LLT_FTP_PASS=<"deploy.secret.txt"
  )
)
if not defined LLT_FTP_PASS (
  echo [!] Не задан пароль FTP.
  echo     Создайте файл deploy.secret.txt в корне проекта и впишите пароль одной строкой,
  echo     либо задайте переменную окружения LLT_FTP_PASS.
  echo     Файл deploy.secret.txt уже исключён из Git.
  exit /b 1
)

echo === Сборка ===
call npm run build
if errorlevel 1 (
  echo [!] Сборка не удалась. Выкладка отменена.
  exit /b 1
)
if not exist "dist\index.html" (
  echo [!] В dist нет index.html. Выкладка отменена.
  exit /b 1
)

echo === Синхронизация с хостингом ===
"%WINSCP%" /ini=nul /loglevel=1 /log="deploy.log" /command ^
  "option batch abort" ^
  "option confirm off" ^
  "open ftp://%LLT_FTP_USER%:%LLT_FTP_PASS%@%LLT_FTP_HOST%/" ^
  "synchronize remote -delete -mirror -criteria=either ""%CD%\dist"" %LLT_FTP_REMOTE%" ^
  "exit"

if errorlevel 1 (
  echo [!] Ошибка синхронизации. Подробности в deploy.log
  exit /b 1
)

echo === Готово: https://liblabtab.ru ===
endlocal
exit /b 0