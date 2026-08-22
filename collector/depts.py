"""발언자 직함에서 소속을 알아낸다.

회의록의 발언자는 두 가지 꼴이다.

    ○ 위원장 전용태            ← 직함이 앞
    ○ 김우민위원               ← 이름이 앞, 붙여 씀
    ○ 전북특별자치도교육청과학교육원장 강진순

의원은 이름을, 집행부는 소속을 알아야 한다. "우리 과에 무슨 질의가 나왔나" 를
보려면 소속이 **본청 과 단위까지** 내려가야 하고, 직속기관 업무보고 회의에서는
기관 이름까지 잡혀야 한다.

원칙은 하나다 — **직함에 근거가 있을 때만 소속을 붙인다.** 넘겨짚지 않는다.
"""
from __future__ import annotations

import re

# 전북특별자치도교육청 본청 부서 (기구도 기준).
# 주간정책회의 프로젝트의 references/departments.json 과 같은 목록을 쓴다.
DEPARTMENTS = [
    "대변인실", "감사관실", "전북교육인권센터",
    "정책기획과", "미래교육과", "학교안전과", "예산과", "교육협력과",
    "중등교육과", "유초등특수교육과", "교원인사과", "문예체건강과",
    "창의인재교육과", "민주시민교육과",
    "총무과", "행정과", "재무과", "노사협력과", "시설과",
]
BUREAUS = ["정책국", "교육국", "행정국"]

# 과 → 상위 국 (전북특별자치도교육청 기구도).
# 회의록의 안건 제목에서 국을 짐작하던 것을 조직도로 바꿨다. 짐작은 그 회차에
# 국 이름이 안 나오면 비어 버리고, 한 번 답한 과는 엉뚱한 국에 붙기도 한다.
# 대변인은 교육감 직속, 감사관·전북교육인권센터는 부교육감 직속이다 — 국 소속이 아니다.
BUREAU_OF = {
    "정책기획과": "정책국", "미래교육과": "정책국", "학교안전과": "정책국",
    "예산과": "정책국", "교육협력과": "정책국",
    "중등교육과": "교육국", "유초등특수교육과": "교육국", "교원인사과": "교육국",
    "문예체건강과": "교육국", "창의인재교육과": "교육국", "민주시민교육과": "교육국",
    "총무과": "행정국", "행정과": "행정국", "재무과": "행정국",
    "노사협력과": "행정국", "시설과": "행정국",
}

# 국 밖에 있는 자리들. 필터에서는 이것들을 한 덩어리로 묶는다.
DIRECT = {"교육감", "부교육감", "대변인실", "감사관실", "전북교육인권센터"}
DIRECT_LABEL = "교육감·부교육감 직속"


def group_of(dept: str | None, kind: str | None = None) -> str | None:
    """필터에서 묶어 보여줄 단위 — 개별 과가 아니라 **상위 국**.

    한 회차에 한 번 답한 과가 필터에 그대로 뜨면, 목록이 국과 과가 섞인
    잡탕이 된다. 실제로 `문예체건강과 (1)`, `미래교육과 (1)` 같은 항목이
    국들 사이에 끼어 있었다. 국 단위로 묶으면 고를 것이 예닐곱 개로 준다.
    """
    if not dept:
        return None
    if kind in ("직속기관", "교육지원청"):
        return kind
    if dept in DIRECT:
        return DIRECT_LABEL
    if dept in BUREAUS:
        return dept
    return BUREAU_OF.get(dept, dept)

# 긴 이름부터 봐야 `교육과` 가 `중등교육과` 를 가로채지 않는다.
_KNOWN = sorted(DEPARTMENTS + BUREAUS, key=len, reverse=True)

_PREFIX = re.compile(
    r"^(전북특별자치도교육청|전북특별자치도의회|전라북도교육청|도교육청|전북특별자치도|전라북도)"
)

# 직위 → 기관을 가리키는 접미사. `과학교육원장` → `과학교육원`.
_HEAD = [
    ("교육지원청교육장", "교육지원청"),
    ("교육장", "교육지원청"),
    ("센터장", "센터"),
    ("원장", "원"),
    ("관장", "관"),
    ("소장", "소"),
]

# 부서가 아니라 사람 자리인 것들. 부서 트래커에 `교육감` 이라는 과가 생기면 안 되므로
# 종류를 따로 표시한다. 순서가 중요하다 — 부교육감을 교육감보다 먼저 본다.
_OFFICERS = [("부교육감", "부교육감"), ("교육감", "교육감")]


def affiliation(title: str | None) -> tuple[str | None, str]:
    """직함 → (소속, 소속 종류).

    소속 종류는 `본청` / `직속기관` / `교육지원청` / `기관장` / `의회` / `기타`.
    알 수 없으면 (None, '기타').
    """
    if not title:
        return (None, "기타")
    t = re.sub(r"\s+", "", title.replace("○", "").replace("↘", "").strip())

    if "전문위원" in t:
        return ("전문위원", "의회")
    if "속기" in t:
        return (None, "기타")

    for key, label in _OFFICERS:
        if t.startswith(key) or t == key:
            return (label, "기관장")

    t = _PREFIX.sub("", t)

    # 1) 본청 부서 이름이 통째로 들어 있으면 확정.
    for d in _KNOWN:
        if d in t:
            return (d, "본청")

    # 2) `감사관`, `대변인` 처럼 실 이름과 직위가 다른 자리
    if t.startswith("감사관"):
        return ("감사관실", "본청")
    if t.startswith("대변인"):
        return ("대변인실", "본청")

    # 3) `과학교육원장` → `과학교육원` 처럼 직위를 떼어 기관 이름을 만든다.
    for suffix, tail in _HEAD:
        if t.endswith(suffix):
            stem = t[: -len(suffix)] + tail
            if len(stem) >= 3:
                kind = "교육지원청" if tail == "교육지원청" else "직속기관"
                return (stem, kind)

    # 4) `○○과장` 인데 우리 목록에 없는 과 — 이름은 살리되 본청으로 본다.
    m = re.match(r"^([가-힣]{2,12})(과장|팀장|실장)$", t)
    if m:
        return (m.group(1) + ("과" if m.group(2) == "과장" else "실"), "본청")

    return (None, "기타")


def role_of(title: str | None, is_member: bool) -> str:
    """의원 / 전문위원 / 집행부 / 기타."""
    if is_member:
        return "의원"
    if not title:
        return "기타"
    t = title.replace("○", "").replace("↘", "").strip()
    if "전문위원" in t:
        return "전문위원"
    if "속기" in t:
        return "기타"
    return "집행부"


# ── 발언자 문자열 쪼개기 ───────────────────────────────────────────────────

# `김우민위원` 처럼 이름과 직함이 붙어 있는 꼴. 의원 발언의 대부분이 이 꼴이다.
_MEMBER_ATTACHED = re.compile(r"^(?P<name>[가-힣]{2,4})(?P<title>위원장?(?:대리)?|의원)$")
# `위원장 전용태` 처럼 직함이 앞
_TITLE_FIRST = re.compile(r"^(?P<title>.+?)\s+(?P<name>[가-힣]{2,4})$")


def split_speaker(raw: str, is_member: bool = False) -> tuple[str, str]:
    """`○ 위원장 전용태` → ('위원장', '전용태'), `김우민위원` → ('위원', '김우민')"""
    s = re.sub(r"\s+", " ", raw.replace("○", " ").replace("↘", " ")).strip()

    m = _MEMBER_ATTACHED.match(s.replace(" ", "")) if is_member else None
    if m:
        return (m.group("title"), m.group("name"))

    m = _TITLE_FIRST.match(s)
    if m:
        return (m.group("title").strip(), m.group("name").strip())

    # 띄어쓰기가 없는데 의원 표시도 없는 경우 — 통째로 직함으로 둔다.
    m = re.match(r"^(?P<name>[가-힣]{2,4})(?P<title>위원장?(?:대리)?|의원)$", s.replace(" ", ""))
    if m:
        return (m.group("title"), m.group("name"))
    return ("", s)
