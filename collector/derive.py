"""회의록에서 부서·의원·안건 트래커를 뽑는다.

요약과 달리 여기는 **전부 규칙으로만** 만든다. 회의록에 발언자와 안건이 태그로
붙어 있으므로 판단이 끼어들 자리가 없다. 사람이 쓴 요약(data/meetings/)이
없어도 이 세 탭은 첫날부터 채워진다.

    python collector/derive.py

## 부서를 어떻게 붙이나 — 두 갈래로 붙인다

처음에는 **답변한 사람의 소속**만 봤다. 그랬더니 화면이 "우리 과에 무엇을 물었나"
라고 해 놓고 정작 과를 누르면 거의 비어 있었다. 시설과 1건, 창의인재교육과 3건인데
행정국은 139건. 이유는 하나다 — **위원회에서는 국장이 대신 답한다.**

    한정수 위원: 정원 조례가 통과되지 않았는데 대상 인원이 선발됐다는 얘기가 있어요.
    행정국장:    교원인사 부분은 제가 답변하는 데 한계가 있어서 교원인사과 장학관이…

이 질의응답은 행정국에만 쌓이고 교원인사과에는 안 잡혔다. 교원인사과 담당자가
자기 과를 눌러도 자기 사업 질의를 못 본다.

그래서 두 갈래로 붙인다.

  **답변** — 그 부서 사람이 직접 답한 것.  (확실하다)
  **언급** — 질의나 답변 본문에 그 부서 이름이 나온 것.  (그 부서가 걸린 사안이다)

둘을 **화면에서 섞지 않는다.** 섞으면 언급된 것을 답변한 것으로 오해한다.
이렇게 하니 총무과(28회 언급, 답변 0건)처럼 아예 목록에 없던 과가 드러났다.

## 국 소속은 추측하지 않고 회의록에서 읽는다

`전북특별자치도교육청 행정국과 감사관 소관 …보고 청취의 건` 이라는 안건 아래에서
답한 과는 그 국 소속이다. 조직도를 사람이 적어 넣지 않아도 회의록이 알려 준다.

## 질의–답변 짝짓기는 확실한 것만 나란히 둔다

위원회 회의록은 `의원 질의 → 집행부 답변` 이 번갈아 나오지만 늘 그렇지는 않다.
국장이 답하다 과장이 이어받으면 그 과장 답변 앞의 의원 발언은 그 답변에 대한
질의가 아니다. 실제로 이런 짝이 만들어졌다.

    질의: 봉서중학교가 4100까지 다운이 됐는데 6000만 원을 계상하는 것이 많지 않냐
    답변: 남원에 하나 있는데요. 지금 임시 모듈러는 생산을 안 하고 있습니다.

그래서 **질의 바로 다음 발언이 답변일 때만** `direct` 로 표시한다(전체의 69%).
나머지는 화면에서 나란히 두지 않고 "앞선 발언"으로 낮춰 보여준다.

"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DATA, INDEX, RECORDS
from depts import BUREAUS, DEPARTMENTS

# 화면에 미리보기로 띄울 길이. 전문은 회차 탭에서 본다.
SNIP = 180

# 긴 이름부터 찾아야 `교육과` 가 `중등교육과` 를 가로채지 않는다.
_MENTION = sorted(DEPARTMENTS, key=len, reverse=True)

# 홈 화면의 추천 검색어 후보.
# **손으로 적어 넣지 않는다.** 그럴듯해 보인다고 `급식` 을 넣었더니 검색 결과가
# 0건이었고, 첫 화면에서 누른 사람은 "검색이 안 되네" 하고 나갔다.
# 후보를 세어 보고 실제로 걸리는 것만 내보낸다.
TOPIC_CANDIDATES = [
    "정원 조례", "공유재산", "행정사무감사", "추가경정", "학교 신설", "통폐합",
    "늘봄", "학생맞춤통합지원", "고교학점제", "교권", "학교폭력", "인권센터",
    "특수교육", "유치원", "사서교사", "독서", "역사교육", "미디어 리터러시",
    "교육지원청", "교육장", "인사", "정원", "승진", "전보", "청렴", "감사",
    "급식", "통학", "스쿨버스", "모듈러", "그린스마트", "시설", "안전",
    "AI", "디지털", "직업계고", "유학생", "농어촌유학", "학생 수 감소",
    "예산", "기금", "이월", "불용", "수의계약",
]


def snip(text: str, n: int = SNIP) -> str:
    t = text.strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def mentioned_depts(*texts: str) -> list[str]:
    """본문에 이름이 그대로 나온 부서. 비슷하다고 넣지 않는다."""
    blob = " ".join(t for t in texts if t)
    return [d for d in _MENTION if d in blob]


def load_records() -> list[dict]:
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    out = []
    for e in idx["meetings"]:
        for name in (f"{e['id']}.json", f"{e['id']}.asr.json"):
            p = RECORDS / name
            if p.exists():
                out.append(json.loads(p.read_text(encoding="utf-8")))
                break
    return out


def bureau_map(docs: list[dict]) -> dict[str, str]:
    """어느 국 소관 안건 아래에서 답했는지로 과의 상위 국을 정한다."""
    votes: dict[str, Counter] = defaultdict(Counter)
    for doc in docs:
        for t in doc["turns"]:
            d = t.get("dept")
            if not d or d in BUREAUS:
                continue
            title = t.get("agendaTitle") or ""
            for b in BUREAUS:
                if b in title:
                    votes[d][b] += 1
    return {d: c.most_common(1)[0][0] for d, c in votes.items() if c}


def exchanges(doc: dict) -> list[dict]:
    """집행부 답변마다 그 앞의 의원 발언을 붙인다.

    바로 앞이 아니면 `direct: false` 로 표시한다. 화면은 그때 질의를 나란히
    두지 않는다 — 틀린 짝을 맞는 짝처럼 보여주는 것이 가장 나쁘다.
    """
    turns = doc["turns"]
    out: list[dict] = []
    last_member: dict | None = None

    for t in turns:
        if t["role"] == "의원":
            # 진행 발언(개의·상정·산회)은 질의가 아니다. 길이로 거른다.
            if len(" ".join(t["lines"])) > 30:
                last_member = t
            continue
        if t["role"] != "집행부" or not t.get("dept"):
            continue

        answer_full = " ".join(t["lines"])
        question_full = " ".join(last_member["lines"]) if last_member else ""
        direct = bool(last_member) and t["i"] == last_member["i"] + 1

        # 언급 부서 — 짝이 확실할 때만 질의 쪽까지 본다.
        # 짝이 불확실한데 질의 본문까지 훑으면 엉뚱한 과에 건이 붙는다.
        mentions = mentioned_depts(answer_full, question_full if direct else "")
        mentions = [m for m in mentions if m != t["dept"]]

        out.append({
            "meeting": doc["id"],
            "date": doc["date"],
            "agenda": t.get("agendaTitle") or "",
            "dept": t["dept"],
            "deptKind": t.get("deptKind") or "기타",
            "mentions": mentions,
            "answerer": t["speaker"],
            "answer": snip(answer_full),
            "answerTurn": t["i"],
            "member": last_member["name"] if last_member else None,
            "question": snip(question_full) if last_member else None,
            "questionTurn": last_member["i"] if last_member else None,
            "direct": direct,
        })
    return out


def main() -> int:
    docs = load_records()
    if not docs:
        print("회의록이 없습니다. 먼저 collector/collect.py 를 돌리세요.")
        return 1

    bureaus = bureau_map(docs)

    all_ex: list[dict] = []
    depts: dict[str, dict] = {}
    members: dict[str, dict] = {}
    agendas: list[dict] = []

    def slot(name: str, kind: str) -> dict:
        return depts.setdefault(name, {
            "name": name,
            "kind": kind,
            "bureau": bureaus.get(name),
            "answerCount": 0,
            "mentionCount": 0,
            "meetings": {},
            "members": {},
        })

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
                d = slot(t["dept"], t.get("deptKind") or "기타")
                d["answerCount"] += 1
                d["meetings"][doc["id"]] = d["meetings"].get(doc["id"], 0) + 1

        for e in ex:
            # 언급만 된 부서도 목록에 세운다. 총무과처럼 답변은 한 번도 안 했지만
            # 28번 언급된 과가 화면에 아예 없던 문제를 여기서 고친다.
            for name in e["mentions"]:
                d = slot(name, "본청")
                d["mentionCount"] += 1
                d["meetings"].setdefault(e["meeting"], 0)

            if e["member"] and e["direct"]:
                depts[e["dept"]]["members"][e["member"]] = \
                    depts[e["dept"]]["members"].get(e["member"], 0) + 1
                members[e["member"]]["depts"][e["dept"]] = \
                    members[e["member"]]["depts"].get(e["dept"], 0) + 1

        for a in doc.get("matters") or []:
            agendas.append({"meeting": doc["id"], "date": doc["date"], "title": a})

    def flat(d: dict[str, dict], key: str, sort_key) -> list[dict]:
        out = []
        for v in d.values():
            v = dict(v)
            v["meetings"] = [{"id": k, "count": c} for k, c in
                             sorted(v["meetings"].items(), key=lambda kv: -kv[1])]
            v[key] = [{"name": k, "count": c} for k, c in
                      sorted(v[key].items(), key=lambda kv: -kv[1])]
            out.append(v)
        return sorted(out, key=sort_key)

    # 추천 검색어 — 실제로 걸리는 것만, 많이 나오는 순으로.
    blob = " ".join(" ".join(t["lines"]) for doc in docs for t in doc["turns"])
    topics = [{"word": w, "count": blob.count(w)} for w in TOPIC_CANDIDATES]
    topics = sorted((t for t in topics if t["count"] >= 5),
                    key=lambda t: -t["count"])[:10]

    derived = {
        "topics": topics,
        "depts": flat(depts, "members",
                      lambda v: (-v["answerCount"], -v["mentionCount"], v["name"])),
        "members": flat(members, "depts", lambda v: -v["turnCount"]),
        "agendas": agendas,
        "exchanges": all_ex,
    }
    path = DATA / "derived.json"
    path.write_text(json.dumps(derived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    direct = sum(1 for e in all_ex if e["direct"])
    only_mention = sum(1 for d in derived["depts"] if d["answerCount"] == 0)
    kb = path.stat().st_size / 1024
    print(f"부서 {len(derived['depts'])}곳 (답변 없이 언급만 {only_mention}곳) · "
          f"의원 {len(derived['members'])}명 · 안건 {len(agendas)}건")
    print(f"질의응답 {len(all_ex)}건 (짝이 확실한 것 {direct}건, "
          f"{direct * 100 // max(1, len(all_ex))}%) → {path.name} ({kb:.0f}KB)")
    print("추천 검색어: " + ", ".join(f"{t['word']}({t['count']})" for t in topics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
