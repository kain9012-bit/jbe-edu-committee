@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo  [1/4] 요약 검증
python scripts\verify.py
if errorlevel 1 (
  echo.
  echo  검증에 걸린 항목이 있습니다. 고치기 전에 올리지 않습니다.
  pause
  exit /b 1
)

echo.
echo  [2/4] 화면 빌드
call npm run build
if errorlevel 1 goto :err

echo.
echo  [3/4] 원격 변경분 받기
rem 매일 새벽 자동수집 워크플로가 data\ 를 커밋한다. 그걸 안 받고 밀면
rem  ! [rejected] (fetch first) 로 막힌다. data\ 는 수집기가 다시 만드는
rem 파일이므로 충돌은 로컬 것을 쓴다(-X ours).
git fetch origin
if errorlevel 1 goto :err
git merge origin/main -X ours --no-edit
if errorlevel 1 goto :err

echo.
echo  [4/4] 깃허브에 올립니다
git add -A
git commit -m "회의록 정리 갱신"
git push
if errorlevel 1 goto :err

echo.
echo  올렸습니다. 몇 분 뒤 페이지에 반영됩니다.
echo  https://kain9012-bit.github.io/jbe-edu-committee/
goto :end

:err
echo.
echo  실패했습니다. 위 메시지를 확인하세요.

:end
echo.
pause
