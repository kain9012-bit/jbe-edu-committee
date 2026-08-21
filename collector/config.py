"""수집기 전역 설정.

경로와 상수만 둔다. 실제 수집 로직은 minutes.py / vod.py 에 있다.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RECORDS = DATA / "records"        # 회의록 전문 (발언 단위)
MEETINGS = DATA / "meetings"      # 요약 (사람이 쓴다)
ASR = DATA / "asr"                # 받아쓰기 원본
AUDIO = DATA / "audio"            # 오디오 (저장소에 넣지 않는다)
ATTACH = DATA / "attachments"     # 첨부 목록
INDEX = DATA / "index.json"

for d in (RECORDS, MEETINGS, ASR, AUDIO, ATTACH):
    d.mkdir(parents=True, exist_ok=True)

# ── 전자회의록 (r.jbstatecouncil.jeonbuk.kr) ────────────────────────────────
MIN_BASE = "https://r.jbstatecouncil.jeonbuk.kr"
# XML 원문은 /data/6450000 접두어가 붙은 경로에만 있다. 접두어를 빼면 404다.
MIN_XML_PREFIX = "/data/6450000"

# 교육위원회는 회의 종류에 따라 ctUid 가 다르다.
#   상임위원회(S) = 31, 행정사무감사(K) = 33
# K 를 빼먹으면 11월 행정사무감사 회의록이 통째로 누락된다. 실제로 VOD 와 조인할 때
# 매칭이 안 되는 건이 전부 행감이었다.
COMMITTEE = {
    "S": {"ctUid": 31, "label": "상임위원회"},
    "K": {"ctUid": 33, "label": "행정사무감사"},
}

# ── 인터넷 의사중계 (live.jbstatecouncil.jeonbuk.kr) ────────────────────────
VOD_BASE = "https://live.jbstatecouncil.jeonbuk.kr"
VOD_SCATE_EDU = "24"          # 교육위원회
# sch_daesu_no 는 대수 숫자가 아니라 내부 ID 다. 13대 = 12.
VOD_DAESU = {13: "12", 12: "9", 11: "8", 10: "7", 9: "6", 8: "5", 7: "4"}

# 수집 대상 대수. 사용자 결정(2026-08-21): 13대만.
# 12대 백필이 필요해지면 여기에 12 를 넣고 다시 돌리면 된다.
TARGET_DAESU = [int(x) for x in os.environ.get("JBE_DAESU", "13").split(",")]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
TIMEOUT = 30
