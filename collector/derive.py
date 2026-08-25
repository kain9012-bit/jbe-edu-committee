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

## 국 소속은 조직도로 붙인다

처음에는 안건 제목(`행정국과 감사관 소관 …보고 청취의 건`)에서 국을 짐작했다.
회의록만으로 조직도를 대신할 수 있다고 봤는데, 그러면 그 회차에 국 이름이
안 나온 과는 국이 비고, 한 번 답한 과가 엉뚱한 국에 붙었다. 43곳 중 절반 넘게
국이 비어 있었다. 지금은 `depts.BUREAU_OF` 에 기구도를 적어 두고 그걸 쓴다.
목록에 없는 이름만 예전 방식으로 짐작한다.

그리고 화면의 **필터는 과가 아니라 국 단위**다(`depts.group_of`). 위원회 질의는
대개 국장이 받으므로 과까지 내려가는 일이 드물어서, 과 단위로 늘어놓으면
`문예체건강과 (1)` 같은 한 건짜리가 국들 사이에 끼어 목록이 스무 개를 넘는다.

## 오간 말은 **주고받은 덩어리**로 묶는다

처음에는 집행부 답변 하나마다 그 앞의 의원 발언을 붙여 한 건으로 만들었다.
그랬더니 같은 주제로 열 번을 주고받은 대목이 열 개의 카드로 쪼개져 나왔다.

    질의: 교육장 지역 공모제를 지금 하고 있죠?
    답변: 예, 맞습니다.
    ─────
    질의: 지난 6월 추천 접수 결과가 어땠는지 설명해 보세요.
    답변: 그 추천받은 인원 수인가요?
    ─────
    답변: 정확하게 기억하지는 못하고요…

이러면 **회의록 전문에 필터만 씌운 것과 다를 게 없다.** 게다가 답변이 앞의
질의와 바로 안 이어질 때 "앞선 발언과 이어지지 않습니다" 같은 군더더기를
붙여야 했는데, 그것도 쪼갰기 때문에 생긴 문제였다.

그래서 **한 위원이 한 안건에서 주고받은 것을 통째로 한 덩어리**로 묶는다.
위원회 회의는 위원장이 "○○ 위원님 질의해 주시기 바랍니다" 하고 넘기면
그 위원이 여러 부서를 상대로 한 주제를 끝까지 파고드는 구조다. 그 단위가
사람이 읽는 단위다.

덩어리가 끊기는 자리는 셋이다.
  - 다른 위원이 질의를 시작할 때
  - 안건이 바뀔 때
  - **같은 위원이 다른 부서로 화제를 돌릴 때**
    ("143쪽 한번 보시죠, 교원인사과" → … → "161쪽이요, 문예체건강과 한번 보세요")
    위원이 상대 부서 이름을 부르는 것이 가장 확실한 화제 전환 신호다. 이걸 안 잡으면
    한 위원의 질의 시간 전체가 52건짜리 한 덩어리가 되어 서로 다른 주제가 섞인다.
  - 위원장의 진행 발언(호명·상정·정회)은 덩어리에 넣지 않고 흘려보낸다

짧은 되물음("예.", "1000여 명 이상으로 됐어요?")도 덩어리 안에 남긴다. 길이로 자르면
답변만 있고 질문이 없는 자리가 생겨 읽는 사람이 앞뒤를 못 맞춘다.

이렇게 하면 부서를 눌렀을 때, 그 부서가 답한 **대화 전체**가 앞뒤 맥락과 함께
보인다. 국장이 답하다 과장이 이어받은 것도 한 덩어리 안에 그대로 남는다.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DATA, INDEX, MEETINGS, RECORDS, ROOT
from depts import BUREAU_OF, BUREAUS, DEPARTMENTS, DIRECT, group_of

# 화면에 미리보기로 띄울 길이. 전문은 회차 탭에서 본다.
SNIP = 260

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


SAMU = ROOT / "collector" / "refs" / "samubunjang.json"


def load_samu() -> dict[str, list[str]]:
    """과별 **고유 사무 용어**. `collector/samu.py` 가 사무분장표에서 뽑아 둔다."""
    if not SAMU.exists():
        return {}
    raw = json.loads(SAMU.read_text(encoding="utf-8"))
    # 두 글자 말은 버린다. `결과`·`관계`·`검사` 처럼 사무분장표 안에서만 고유할 뿐
    # 회의록에서는 아무 데나 나오는 말이라, 그걸로 붙이면 엉뚱한 과에 걸린다.
    return {k: [t for t in v["terms"] if len(t) >= 3] for k, v in raw.items()}


def attach_owners(dias: list[dict], samu: dict[str, list[str]]) -> None:
    """각 덩어리가 **어느 과 소관인가** 를 사무분장표로 찾아 붙인다.

    본청은 국 단위로 의회에 보고한다. 그래서 답한 사람은 거의 다 국장이고,
    과 이름은 어쩌다 과장이 답할 때만 붙는다(본청 답변의 21%). 나머지는 국에만
    쌓여서, 정작 그 일을 하는 과 담당자가 자기 과를 눌러도 화면이 비어 있었다.

    ## 흔한 말로 붙이면 아무 데나 붙는다

    사무분장표 안에서 한 과에만 나오는 말이라고 회의록에서도 드문 건 아니다.
    첫 판에서 `주요업무보고` 하나 때문에 정책기획과가 133개 중 100개를 가져갔고,
    `교육감` 때문에 총무과가 22개를 가져갔다. 사무분장표에서 고유하다는 것과
    **이 회의록에서 변별력이 있다**는 것은 다른 문제다.

    그래서 회의록에서 자주 나오는 말은 뺀다. 열 덩어리 넘게 나오는 말은 그
    회의의 배경어이지 특정 과를 가리키는 말이 아니다. 부서 이름도 뺀다 —
    그건 `언급` 이 이미 하는 일이다.

    붙인 근거는 남긴다. 담당자가 "왜 우리 과로 왔지" 를 직접 확인할 수 있어야
    틀린 배분을 걸러낼 수 있다.
    """
    if not dias or not samu:
        for d in dias:
            d["owners"] = []
        return

    # 안건 제목은 넣지 않는다. `공유재산관리계획` 안건 아래에서 정원 조례를
    # 따지는 대목까지 재무과로 끌려갔다.
    blobs = [" ".join(t["text"] for t in d["turns"]) for d in dias]

    names = set(DEPARTMENTS) | set(BUREAUS) | DIRECT
    cap = max(3, len(dias) // 12)      # 133덩어리면 11덩어리까지

    keep: dict[str, list[str]] = {}
    for dept, ts in samu.items():
        good = []
        for t in ts:
            if t in names:
                continue
            df = sum(1 for b in blobs if t in b)
            if 0 < df <= cap:
                good.append(t)
        keep[dept] = good

    for d, blob in zip(dias, blobs):
        found = []
        for dept, ts in keep.items():
            hit = sorted({t for t in ts if t in blob})
            # 네 글자 넘는 말이 하나는 걸려야 한다. `서비스`·`교육부` 두 개로
            # 붙이면 아무 대목에나 붙는다. 그 위에 둘 이상이거나, 다섯 글자
            # 넘는 말(고교학점제·교육공무직원)이 걸리면 확실하다고 본다.
            if not any(len(t) >= 4 for t in hit):
                continue
            if len(hit) >= 2 or any(len(t) >= 5 for t in hit):
                found.append({"dept": dept, "terms": hit[:6], "score": len(hit)})
        found.sort(key=lambda x: -x["score"])
        d["owners"] = [o for o in found[:3] if o["dept"] not in d["depts"]]


def bureau_map(docs: list[dict]) -> dict[str, str]:
    """과의 상위 국. **조직도가 먼저**, 회의록 추측은 조직도에 없는 이름만.

    예전에는 안건 제목(`행정국과 감사관 소관 …`)만 보고 국을 짐작했다. 그러면
    그 회차에 국 이름이 안 나온 과는 국이 비고, 한 번 답한 과가 엉뚱한 국에
    붙기도 했다. 실제로 43곳 중 절반 넘게 국이 비어 있었다.
    """
    out: dict[str, str] = dict(BUREAU_OF)

    votes: dict[str, Counter] = defaultdict(Counter)
    for doc in docs:
        for t in doc["turns"]:
            d = t.get("dept")
            if not d or d in BUREAUS or d in BUREAU_OF or d in DIRECT:
                continue
            if (t.get("deptKind") or "") in ("직속기관", "교육지원청"):
                continue      # 국 소속이 아니다. 안건 제목에 국 이름이 나왔다고 붙이면 틀린다.
            title = t.get("agendaTitle") or ""
            for b in BUREAUS:
                if b in title:
                    votes[d][b] += 1
    for d, c in votes.items():
        if c:
            out[d] = c.most_common(1)[0][0]
    return out


# 위원장의 진행 발언. 질의가 아니라 회의를 굴리는 말이다.
# 이걸 질의로 세면 "전용태 위원이 모든 부서에 질의했다" 는 엉뚱한 통계가 나온다.
_PROGRESS = re.compile(
    r"질의해\s*주시기|답변해\s*주시기|보고해\s*주시기|설명해\s*주시기"
    r"|수고하셨습니다|상정합니다|개의하겠습니다|산회를\s*선포|정회|의사일정"
    r"|성원이\s*되었으므로|의석을\s*정리|검토보고|제안설명|선포합니다"
)


def is_progress(body: str) -> bool:
    """회의 진행을 위한 말인가 (호명·상정·정회)."""
    return bool(_PROGRESS.search(body)) and len(body) < 320


def dialogs(doc: dict) -> list[dict]:
    """한 위원이 한 안건에서 주고받은 것을 통째로 한 덩어리로 묶는다.

    덩어리 하나가 화면의 카드 하나다. 답변마다 쪼개면 회의록 전문과 다를 게
    없다 — 같은 주제로 열 번 주고받은 대목이 열 개 카드가 된다.
    """
    out: list[dict] = []
    cur: dict | None = None

    # 이 회의에 실제로 나온 기관 이름. 위원이 부르는 상대를 알아내는 데 쓴다.
    here = sorted(
        {t["dept"] for t in doc["turns"] if t.get("dept")} | set(DEPARTMENTS),
        key=len, reverse=True,
    )

    def addressed(body: str) -> list[str]:
        return [d for d in here if d in body]

    def close():
        nonlocal cur
        if cur and cur["turns"]:
            # 집행부가 한 마디도 안 한 덩어리(의원 소회·토론)는 질의응답이 아니다.
            if any(t["role"] != "의원" for t in cur["turns"]):
                out.append(cur)
        cur = None

    def start(member: str | None, agenda: str):
        nonlocal cur
        close()
        cur = {
            "meeting": doc["id"],
            "date": doc["date"],
            "agenda": agenda,
            "member": member,
            "depts": [],
            "turns": [],
        }

    for t in doc["turns"]:
        body = " ".join(t["lines"]).strip()
        if not body:
            continue
        agenda = t.get("agendaTitle") or ""

        if t["role"] == "의원":
            if is_progress(body):
                continue          # 호명·상정·정회는 흘려보낸다
            same = cur is not None and cur["member"] == t["name"] and cur["agenda"] == agenda
            if same:
                # 같은 위원이 이어 말하더라도 **다른 부서를 부르면** 화제가 바뀐 것이다.
                called = [d for d in addressed(body) if d not in cur["depts"]]
                if called and cur["depts"]:
                    start(t["name"], agenda)
            else:
                if len(body) <= 25:
                    continue      # 짧은 맞장구로 새 덩어리를 열지는 않는다
                start(t["name"], agenda)
        elif t["role"] in ("집행부", "전문위원"):
            if cur is None or cur["agenda"] != agenda:
                # 의원 질의 없이 시작하는 대목 = 업무보고·제안설명
                start(None, agenda)
        else:
            continue

        cur["turns"].append({
            "i": t["i"],
            "role": t["role"],
            "speaker": t["speaker"],
            "dept": t.get("dept"),
            "text": snip(body),
        })
        if t.get("dept") and t["dept"] not in cur["depts"]:
            cur["depts"].append(t["dept"])

    close()

    for d in out:
        d["turnCount"] = len(d["turns"])
        d["startTurn"] = d["turns"][0]["i"]
        d["endTurn"] = d["turns"][-1]["i"]
        # 언급 부서 — 오간 말 전체에서 이름이 나온 다른 과.
        # 국장이 대신 답해도 담당 과가 잡히게 하는 장치다.
        blob = " ".join(t["text"] for t in d["turns"])
        d["mentions"] = [m for m in mentioned_depts(blob) if m not in d["depts"]]
    return out


def build_asks(docs: list[dict]) -> list[dict]:
    """사람이 쓴 지적·요구에 **집행부 답변을 붙인다.**

    요구만 한 줄 실어 놓으면 받아 갈 사람이 "그래서 뭐라고 했는데?" 를 알 수 없다.
    회의록에서 그 발언 **바로 뒤에 이어지는 집행부 발언**을 찾아 함께 싣는다.
    다음 의원 발언이 나오면 거기서 끊는다 — 그 뒤는 다른 이야기다.

    답변이 없는 경우도 있다(마무리 당부, 처리의견 개진). 그때는 비워 두고
    화면에서 "이 자리에서 답변 없음" 이라고 밝힌다. 없는 답을 지어내지 않는다.
    """
    out: list[dict] = []
    for doc in docs:
        path = MEETINGS / f"{doc['id']}.json"
        if not path.exists():
            continue
        summary = json.loads(path.read_text(encoding="utf-8"))
        turns = doc["turns"]
        # 부서 이름만으로는 직속기관인지 과인지 모른다. 회의록의 발언자 태그에서 읽는다.
        kind_of = {t["dept"]: t.get("deptKind") for t in turns if t.get("dept")}
        for a in summary.get("asks", []):
            n = a.get("turn")
            replies = []
            if isinstance(n, int) and 0 <= n < len(turns):
                for t in turns[n + 1:]:
                    if t["role"] == "의원":
                        break              # 다음 질의가 시작되면 끊는다
                    if t["role"] not in ("집행부", "전문위원"):
                        continue
                    body = " ".join(t["lines"]).strip()
                    if not body:
                        continue
                    replies.append({
                        "i": t["i"],
                        "speaker": t["speaker"],
                        "dept": t.get("dept"),
                        "text": snip(body, 400),
                    })
                    if len(replies) >= 3:
                        break
            kind = kind_of.get(a.get("dept"))
            out.append({
                **a,
                "meeting": doc["id"],
                "date": doc["date"],
                # 필터는 국 단위로 묶는다. 한 회차에 한 번 답한 과가 국들 사이에
                # 그대로 끼어 있으면 고를 것이 스무 개가 넘는다.
                "group": group_of(a.get("dept"), kind),
                "replies": replies,
            })
    return out


def main() -> int:
    docs = load_records()
    if not docs:
        print("회의록이 없습니다. 먼저 collector/collect.py 를 돌리세요.")
        return 1

    samu = load_samu()
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
            # 필터에서 묶어 볼 단위. 과 하나짜리 항목이 국들 사이에 끼지 않게 한다.
            "group": group_of(name, kind),
            "answerCount": 0,
            "mentionCount": 0,
            "ownedCount": 0,
            "meetings": {},
            "members": {},
        })

    for doc in docs:
        ex = dialogs(doc)
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


            # 누가 누구에게 물었나 — 덩어리 단위로 센다.
            # 답변 하나하나를 세면 말을 많이 받아낸 위원이 더 집요해 보인다.
            if e["member"]:
                for name in e["depts"]:
                    depts[name]["members"][e["member"]] = \
                        depts[name]["members"].get(e["member"], 0) + 1
                    members[e["member"]]["depts"][name] = \
                        members[e["member"]]["depts"].get(name, 0) + 1

        for a in doc.get("matters") or []:
            agendas.append({"meeting": doc["id"], "date": doc["date"], "title": a})

    # 사무분장상 소관 과를 붙인다. 전 회차를 다 모은 뒤에 해야 한다 —
    # 회의록에서 흔한 말인지 아닌지는 전체를 봐야 알 수 있다.
    attach_owners(all_ex, samu)

    # 소관 추정은 전체를 본 뒤에 나오므로 여기서 센다.
    for e in all_ex:
        for o in e["owners"]:
            d = slot(o["dept"], "본청")
            d["ownedCount"] += 1
            d["meetings"].setdefault(e["meeting"], 0)

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

    # 파일을 둘로 나눈다.
    #   derived.json    — 목록과 숫자. 30KB 안쪽. 홈·안건 탭은 이것만 있으면 된다.
    #   exchanges.json  — 오간 말 전문. 900KB. 부서별·의원별에서만 필요하다.
    # 한 파일로 두었더니 안건 탭에 들어가기만 해도 쓰지 않는 900KB를 받았다.
    derived = {
        "topics": topics,
        "depts": flat(depts, "members",
                      lambda v: (-v["answerCount"], -v["mentionCount"],
                                 -v["ownedCount"], v["name"])),
        "members": flat(members, "depts", lambda v: -v["turnCount"]),
        "agendas": agendas,
        "dialogCount": len(all_ex),
    }
    path = DATA / "derived.json"
    path.write_text(json.dumps(derived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ex_path = DATA / "dialogs.json"
    ex_path.write_text(json.dumps(all_ex, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    asks = build_asks(docs)
    ask_path = DATA / "asks.json"
    ask_path.write_text(json.dumps(asks, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    turns_in = sum(e["turnCount"] for e in all_ex)
    only_mention = sum(1 for d in derived["depts"] if d["answerCount"] == 0)
    kb = path.stat().st_size / 1024
    ex_kb = ex_path.stat().st_size / 1024
    print(f"부서 {len(derived['depts'])}곳 (답변 없이 언급만 {only_mention}곳) · "
          f"의원 {len(derived['members'])}명 · 안건 {len(agendas)}건 → {path.name} ({kb:.0f}KB)")
    print(f"주고받은 덩어리 {len(all_ex)}개 · 발언 {turns_in}건 "
          f"(덩어리당 평균 {turns_in / max(1, len(all_ex)):.1f}건) "
          f"→ {ex_path.name} ({ex_kb:.0f}KB)")
    answered = sum(1 for a in asks if a["replies"])
    print(f"지적·요구 {len(asks)}건 (집행부 답변이 붙은 것 {answered}건) "
          f"→ {ask_path.name} ({ask_path.stat().st_size / 1024:.0f}KB)")
    print("추천 검색어: " + ", ".join(f"{t['word']}({t['count']})" for t in topics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
