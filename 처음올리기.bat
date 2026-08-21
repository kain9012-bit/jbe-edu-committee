@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo  == 깃허브에 처음 올립니다 ==
echo  https://github.com/kain9012-bit/jbe-edu-committee
echo.

if exist ".git" (
  echo  이미 git 저장소입니다. 이 파일은 처음 한 번만 쓰는 것입니다.
  echo  다음부터는 올리기.bat 을 쓰세요.
  pause
  exit /b 0
)

echo  [1/5] 요약 검증
python scripts\verify.py
if errorlevel 1 goto :err

echo.
echo  [2/5] 화면 빌드 확인
if not exist "node_modules" (
  echo       node_modules 가 없어 먼저 설치합니다. 몇 분 걸립니다.
  call npm install
  if errorlevel 1 goto :err
)
call npm run build
if errorlevel 1 goto :err

echo.
echo  [3/5] git 저장소 만들기
git init -b main
if errorlevel 1 goto :err
git add -A
git commit -m "교육위원회 브리핑 첫 판 - 회의록 수집·부서별 정리·13대 6회차 요약"
if errorlevel 1 goto :err

echo.
echo  [4/5] 원격 연결
git remote add origin https://github.com/kain9012-bit/jbe-edu-committee.git
if errorlevel 1 goto :err

echo.
echo  [5/5] 올리는 중 (로그인 창이 뜨면 깃허브 계정으로 승인하세요)
git push -u origin main
if errorlevel 1 goto :err

echo.
echo  =====================================================
echo   올렸습니다. 이제 저장소 설정 두 곳을 바꿔야 합니다.
echo.
echo   1) Settings - Pages - Source 를  GitHub Actions  로
echo   2) Settings - Actions - General - Workflow permissions 를
echo      Read and write permissions  로
echo.
echo   그러면 몇 분 뒤 아래에서 열립니다.
echo   https://kain9012-bit.github.io/jbe-edu-committee/
echo  =====================================================
goto :end

:err
echo.
echo  실패했습니다. 위 메시지를 확인하세요.

:end
echo.
pause
