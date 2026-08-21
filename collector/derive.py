"""회의록에서 부서·의원·안건 트래커를 뽑는다.

요약과 달리 여기는 **전부 규칙으로만** 만든다. 회의록에 발언자와 안건이 태그로
붙어 있으므로 판단이 끼어들 자리가 없다. 사람이 쓴 요약(data/meetings/)이
없어도 이 세 탭은 첫날부터 채워진다.

핵심은 **질의–답변 짝짓기**다. 위원회 회의록은 `의원 질의 → 집행부 답변` 이
번갈아 나오므로, 집행부 발언 바로 앞의 의원 발언을 그 질의로 본다.
그래야 "우리 과에 누가 뭘 물었나" 를 볼 수 있다.

    python collector/derive.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DATA, INDEX, RECORDS

# 화면에 미리보기로 띄울 길이. 전문은 회차 탭에서 본다.
SNIP = 160


def snip(lines: list[str], n: int = SNIP) -> str:
    t = " ".join(lines).strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def load_records() -> list[dict]:
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    out = []
    for e in idx["meetings"]:
        p = RECORDS / f"{e['id']}.json"
        if p.exists():
            out.append(json.loads(p.read_text(encoding="utf-8")))
    return out


def exchanges(doc: dict) -> list[dict]:
    """집행부 답변마다 바로 앞의 의원 질의를 붙여 하나의 '오간 말' 로 만든다."""
    turns = doc["turns"]
    out = []
    last_member: dict | None = None
    for t in turns:
        if t["role"] == "의원":
            # 진행 발언(개의·상정·산회)은 질의가 아니다. 길이로 거른다.
            body = " ".join(t["lines"])
            if len(body) > 30:
                last_member = t
            continue
        if t["role"] != "집행부" or not t.get("dept"):
            continue
        out.append({
            "meeting": doc["id"],
            "date": doc["date"],
            "agenda": t.get("agendaTitle") or "",
            "dept": t["dept"],
            "deptKind": t.get("deptKind") or "기타",
            "answerer": t["speaker"],
            "answer": snip(t["lines"]),
            "answerTurn": t["i"],
            "member": last_member["name"] if last_member else None,
            "question": snip(last_member["lines"]) if last_member else None,
            "questionTurn": last_member["i"] if last_member else None,
        })
    return out


def main() -> int:
    docs = load_records()
    if not docs:
        print("회의록이 없습니다. 먼저 collector/collect.py 를 돌리세요.")
        return 1

    all_ex: list[dict] = []
    depts: dict[str, dict] = {}
    members: dict[str, dict] = {}
    agendas: list[dict] = []

    for doc in docs:
        ex = exchanges(doc)
        all_ex.extend(ex)

        for t in doc["turns"]:
            if t["role"] == "의원":
                m = members.setdefault(t["name"], {
                    "name": t["name"], "cmUid": t.get("cmUid"),
                    "turnCount": 0, "meetings": {}, "depts": {},
                })
                m["turnCount"] += 1
                m["meetings"][doc["id"]] = m["meetings"].get(doc["id"], 0) + 1
            elif t.get("dept"):
                d = depts.setdefault(t["dept"], {
                    "name": t["dept"], "kind": t.get("deptKind") or "기타",
                    "turnCount": 0, "meetings": {}, "members": {},
                })
                d["turnCount"] += 1
                d["meetings"][doc["id"]] = d["meetings"].get(doc["id"], 0) + 1

        for e in ex:
            if e["member"]:
                depts[e["dept"]]["members"][e["member"]] = \
                    depts[e["dept"]]["members"].get(e["member"], 0) + 1
                members[e["member"]]["depts"][e["dept"]] = \
                    members[e["member"]]["depts"].get(e["dept"], 0) + 1

        for a in doc.get("matters") or []:
            agendas.append({"meeting": doc["id"], "date": doc["date"], "title": a})

    def flat(d: dict[str, dict], key: str) -> list[dict]:
        out = []
        for v in d.values():
            v = dict(v)
            v["meetings"] = [{"id": k, "count": c} for k, c in
                             sorted(v["meetings"].items(), key=lambda kv: -kv[1])]
            v[key] = [{"name": k, "count": c} for k, c in
                      sorted(v[key].items(), key=lambda kv: -kv[1])]
            out.append(v)
        return sorted(out, key=lambda v: -v["turnCount"])

    derived = {
        "depts": flat(depts, "members"),
        "members": flat(members, "depts"),
        "agendas": agendas,
        "exchanges": all_ex,
    }
    path = DATA / "derived.json"
    path.write_text(json.dumps(derived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    kb = path.stat().st_size / 1024
    print(f"부서 {len(derived['depts'])} · 의원 {len(derived['members'])} · "
          f"안건 {len(agendas)} · 질의응답 {len(all_ex)}건 → {path.name} ({kb:.0f}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
