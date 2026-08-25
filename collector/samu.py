"""사무분장표를 읽어 **과별 소관 사무**를 뽑는다.

    python collector/samu.py "<[별표 4] 사무분장표 …pdf>"

## 왜 필요한가

본청은 **국 단위로 의회에 보고한다.** 그래서 위원회 회의록에서 답한 사람은
거의 다 국장이고, 과 이름은 어쩌다 과장이 답할 때만 붙는다. 실제로 본청 답변
417건 중 과장이 직접 답한 건 87건(21%)뿐이다. 나머지 330건은 전부 국에만
쌓이고, 정작 그 일을 하는 과 담당자가 자기 과를 눌러도 화면이 비어 있다.

그래서 국장 답변도 **무슨 사무에 관한 말인지** 보고 과를 찾아 준다. 넘겨짚는
것이 아니라 근거가 있다 — 전북특별자치도교육청 행정기구 설치 조례 시행규칙
[별표 4] 사무분장표다.

## 어떻게 붙이나 — 한 과에만 나오는 말로만 붙인다

`운영`, `관리`, `지원`, `계획` 같은 말은 모든 과의 사무에 나온다. 이런 말로
붙이면 아무 과에나 붙는다. 그래서 **사무분장표 전체에서 한 과에만 나오는 말**
(예: `학교급식비`, `늘봄학교`, `공무원노동조합`)만 골라 쓴다.

그리고 붙인 근거를 화면에 같이 내보낸다. "왜 우리 과로 왔지" 를 담당자가
직접 확인할 수 있어야, 틀린 배분을 신고할 수 있다.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "refs" / "samubunjang.json"

# 사무분장표에서 뽑되 이 서비스가 다루는 본청 부서만 쓴다.
BODY_END = "2. 직속기관"

# 표의 과 머리표. `▣ 문예체건강과` 꼴과 `(대변인 소관)` 꼴 두 가지가 있다.
_MARK = re.compile(r"▣\s*([가-힣]{2,12})\s*\n")
_SOGWAN = re.compile(r"\(([가-힣]{2,12})\s*소관\)\s*\n담당관")

# 사무 한 줄. `12. …에 관한 사항`
_ITEM = re.compile(r"(?m)^\s*\d{1,3}\.\s*(.+)$")

# 이름과 다른 실 이름
ALIAS = {"대변인": "대변인실", "감사관": "감사관실"}

# 어느 과에나 나오는 말. 이런 걸로 붙이면 아무 데나 붙는다.
STOP = {
    "관한", "사항", "그밖에", "밖에", "관련", "운영", "관리", "지원", "계획", "업무",
    "추진", "수립", "기획", "총괄", "구성", "평가", "지도", "교육", "학교", "학생",
    "교원", "사업", "제도", "행정", "위원회", "구축", "개선", "협력", "대한", "따른",
    "전북특별자치도교육청", "전북특별자치도", "도교육청", "각급학교", "교육지원청",
    "직속기관", "본청", "지정", "심의", "관리에", "운영에", "지원에",
}


def blocks(text: str) -> dict[str, str]:
    """과 머리표로 잘라 {과: 그 과의 사무분장 본문}."""
    marks: list[tuple[int, str]] = []
    for m in _MARK.finditer(text):
        marks.append((m.start(), m.group(1)))
    for m in _SOGWAN.finditer(text):
        marks.append((m.start(), m.group(1)))
    marks.sort()

    out: dict[str, str] = {}
    for i, (s, name) in enumerate(marks):
        e = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        name = ALIAS.get(name, name)
        out[name] = text[s:e]
    return out


def terms(sentence: str) -> set[str]:
    """사무 문장에서 붙일 만한 말만. 조사를 떼지 않고 **명사 덩어리**로 본다."""
    out = set()
    for w in re.findall(r"[가-힣]{2,}", sentence):
        # 흔한 조사·어미를 꼬리에서 떼어 낸다. 형태소 분석기 없이 하는 근사치다.
        w = re.sub(r"(에|의|을|를|이|가|은|는|와|과|및|등|에서|으로|로)$", "", w)
        if len(w) < 2 or w in STOP:
            continue
        out.add(w)
    return out


def main(pdf: str) -> int:
    try:
        import pdfplumber
    except ImportError:
        print("pdfplumber 가 필요합니다:  pip install pdfplumber")
        return 1

    with pdfplumber.open(pdf) as f:
        text = "\n".join(p.extract_text() or "" for p in f.pages)

    cut = text.find(BODY_END)
    body = text[:cut] if cut > 0 else text

    raw = blocks(body)
    if not raw:
        print("과 머리표를 못 찾았습니다. 사무분장표 서식이 바뀌었는지 확인하세요.")
        return 1

    duties: dict[str, list[str]] = {}
    words: dict[str, set[str]] = {}
    for name, chunk in raw.items():
        items = [re.sub(r"\s+", " ", m.group(1)).strip() for m in _ITEM.finditer(chunk)]
        items = [x for x in items if len(x) > 4]
        if not items:
            continue
        duties[name] = items
        w = set()
        for it in items:
            w |= terms(it)
        words[name] = w

    # **한 과에만 나오는 말**만 남긴다. 두 과 이상에 나오면 가려낼 힘이 없다.
    seen = Counter(w for s in words.values() for w in s)
    uniq = {n: sorted(w for w in s if seen[w] == 1) for n, s in words.items()}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {n: {"duties": duties[n], "terms": uniq[n]} for n in duties},
            ensure_ascii=False, indent=1,
        ) + "\n",
        encoding="utf-8",
    )

    print(f"{len(duties)}개 과 → {OUT.relative_to(ROOT.parent)}")
    for n in duties:
        print(f"  {n:14s} 사무 {len(duties[n]):3d}개 · 고유어 {len(uniq[n]):4d}개"
              f"   {', '.join(uniq[n][:6])}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    raise SystemExit(main(sys.argv[1]))
