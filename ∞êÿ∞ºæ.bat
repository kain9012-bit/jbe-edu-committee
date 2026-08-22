@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo  [1/2] 도의회 회의록·영상 목록을 받습니다
python collector\collect.py --with-stream
if errorlevel 1 goto :err
echo.
echo  [2/2] 부서·의원·안건 집계를 다시 만듭니다
python collector\derive.py
if errorlevel 1 goto :err
echo.
echo  끝났습니다. data\index.json 을 확인하세요.
goto :end
:err
echo.
echo  실패했습니다. 위 메시지를 확인하세요.
:end
pause
