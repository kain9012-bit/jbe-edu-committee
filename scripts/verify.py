"""발행 전 검증. 하나라도 걸리면 고치기 전에 올리지 않는다.

    python scripts/verify.py

무엇을 보는가
 1. **인용문이 회의록에 글자 그대로 있는가.** 이 서비스의 신뢰가 여기에 걸려 있다.
    요약을 다듬다가 인용문을 손보면 원문 대조가 무너진다.
 2. 부서명이 실제로 그 회의에서 발언한 기관인가.
 3. 가리킨 발언 번호가 실제로 있고, 인용문이 그 발언 안에 있는가.
 4. 안건 제목이 회의록의 심사 안건과 이어지는가.
 5. **자료요구·지적사항이 위원의 발언인가.** 집행부의 "검토해 보겠습니다" 를
    위원의 요구로 적어 두면, 받아 갈 숙제가 아닌 것이 숙제 목록에 오른다.
    실제로 부교육감 답변 하나가 `요청` 으로 들어가 있었다.
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
        member_turns = {t["i"] for t in turns if t["role"] == "의원"}
        agenda_keys = {agenda_key(a) for a in (r.get("matters") or []) + (r.get("purpose") or [])}

        if not norm(m.get("summary", "")):
            problems.append(f"{mid}: summary 가 비어 있습니다")

        items = [("highlights", h) for h in m.get("highlights", [])] + \
                [("asks", a) for a in m.get("asks", [])]

        for where, it in items:
            checked += 1
            label = f"{mid} {where} “{norm(it.get('title', ''))[:40]}”"

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

            if where == "asks":
                # 개조식으로 쓴다. `~있었다` 같은 서술형 종결은 목록에서 훑기 나쁘다.
                title = norm(it.get("title"))
                if not title:
                    problems.append(f"{label}: title 이 비어 있습니다")
                elif re.search(r"(있었다|하였다|했다|한다|당부했다|요구했다|지적했다)\s*\.?$", title):
                    problems.append(f"{label}: title 을 개조식(명사형)으로 끝내세요 → '{title[-14:]}'")
                body = it.get("body") or []
                if not isinstance(body, list) or not body:
                    problems.append(f"{label}: body 가 비어 있습니다 (개조식 항목 배열)")
                else:
                    for line in body:
                        if re.search(r"(있었다|하였다|했다)\s*\.?$", norm(line)):
                            problems.append(
                                f"{label}: body 를 개조식으로 끝내세요 → '{norm(line)[-16:]}'")
                if it.get("type") not in ASK_TYPES:
                    problems.append(f"{label}: type 이 {sorted(ASK_TYPES)} 중 하나여야 합니다")
                # 위원이 요구한 것만 담는다. 집행부 답변은 요구가 아니다.
                n = it.get("turn")
                if n is not None and n not in member_turns:
                    who = turns[n]["speaker"] if 0 <= n < len(turns) else "?"
                    problems.append(
                        f"{label}: 위원이 아니라 '{who}' 의 발언입니다. "
                        f"asks 는 위원이 요구·지적한 것만 담습니다"
                    )

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
