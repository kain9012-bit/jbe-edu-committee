@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo  [1/3] 요약 검증
python scripts\verify.py
if errorlevel 1 (
  echo.
  echo  검증에 걸린 항목이 있습니다. 고치기 전에 올리지 않습니다.
  pause
  exit /b 1
)
echo.
echo  [2/3] 화면 빌드
call npm run build
if errorlevel 1 goto :err
echo.
echo  [3/3] 깃허브에 올립니다
git add -A
git commit -m "회의록 정리 갱신"
git push
if errorlevel 1 goto :err
echo.
echo  올렸습니다. 몇 분 뒤 페이지에 반영됩니다.
goto :end
:err
echo.
echo  실패했습니다. 위 메시지를 확인하세요.
:end
pause
