@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo  속기록이 아직 없는 회의의 영상 오디오를 받습니다.
echo  스트림이 7443 포트로 나가서 이 PC 에서만 받을 수 있습니다.
echo  ffmpeg 가 없으면 https://ffmpeg.org 에서 먼저 설치하세요.
echo.
python collector\fetch_audio.py %*
if errorlevel 1 (
  echo.
  echo  실패했습니다. 위 메시지를 확인하세요.
)
pause
