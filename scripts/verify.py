"""발행 전 검증. 하나라도 걸리면 고치기 전에 올리지 않는다.

    python scripts/verify.py

무엇을 보는가
 1. **인용문이 회의록에 글자 그대로 있는가.** 이 서비스의 신뢰가 여기에 걸려 있다.
    요약을 다듬다가 인용문을 손보면 원문 대조가 무너진다.
 2. 부서명이 실제로 그 회의에서 발언한 기관인가.
 3. 가리킨 발언 번호가 실제로 있고, 인용문이 그 발언 안에 있는가.
 4. 안건 제목이 회의록의 심사 안건과 이어지는가.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORDS = ROOT / "data" / "records"
MEETINGS = ROOT / "data" / "meetings"

ASK_TYPES = {"자료요구", "지적사항", "요청"}


def norm(s: str) -> str:
    """비교용 정규화 — 공백만 고른다. 글자는 건드리지 않는다."""
    return re.sub(r"\s+", " ", (s or "")).strip()


def agenda_key(s: str) -> str:
    return re.sub(r"\s+", "", re.sub(r"^\s*\d+\.\s*", "", s or ""))


def main() -> int:
    problems: list[str] = []
    checked = 0

    for path in sorted(MEETINGS.glob("*.json")):
        mid = path.stem
        rec_path = RECORDS / f"{mid}.json"
        if not rec_path.exists():
            problems.append(f"{mid}: 요약은 있는데 회의록 전문이 없습니다")
            continue

        m = json.loads(path.read_text(encoding="utf-8"))
        r = json.loads(rec_path.read_text(encoding="utf-8"))
        turns = r["turns"]
        haystack = norm(" ".join(l for t in turns for l in t["lines"]))
        depts = {t["dept"] for t in turns if t.get("dept")}
        members = {t["name"] for t in turns if t["role"] == "의원"}
        agenda_keys = {agenda_key(a) for a in (r.get("matters") or []) + (r.get("purpose") or [])}

        if not norm(m.get("summary", "")):
            problems.append(f"{mid}: summary 가 비어 있습니다")

        items = [("highlights", h) for h in m.get("highlights", [])] + \
                [("asks", a) for a in m.get("asks", [])]

        for where, it in items:
            checked += 1
            label = f"{mid} {where} “{norm(it.get('title') or it.get('text', ''))[:40]}”"

            q = norm(it.get("quote"))
            if q:
                if q not in haystack:
                    problems.append(f"{label}: 인용문이 회의록에 그대로 없습니다 → “{q[:70]}”")
                elif it.get("turn") is not None:
                    n = it["turn"]
                    if not (0 <= n < len(turns)):
                        problems.append(f"{label}: 발언 번호 {n} 가 범위를 벗어났습니다 (0~{len(turns)-1})")
                    elif q not in norm(" ".join(turns[n]["lines"])):
                        problems.append(f"{label}: 인용문이 {n}번 발언 안에 없습니다")

            d = it.get("dept")
            if d and d not in depts:
                problems.append(f"{label}: '{d}' 는 이 회의에서 발언한 기관이 아닙니다")

            mem = it.get("member")
            if mem and mem not in members:
                problems.append(f"{label}: '{mem}' 는 이 회의에서 발언한 위원이 아닙니다")

            if where == "asks" and it.get("type") not in ASK_TYPES:
                problems.append(f"{label}: type 이 {sorted(ASK_TYPES)} 중 하나여야 합니다")

        for a in m.get("agenda", []):
            checked += 1
            if agenda_keys and agenda_key(a.get("title", "")) not in agenda_keys:
                problems.append(
                    f"{mid} agenda: '{norm(a.get('title'))[:40]}' 가 회의록의 안건 목록에 없습니다"
                )

    if problems:
        print(f"검증 실패 — {len(problems)}건\n")
        for p in problems:
            print("  ✗", p)
        return 1

    print(f"검증 통과 — 요약 {len(list(MEETINGS.glob('*.json')))}회차 · 항목 {checked}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
