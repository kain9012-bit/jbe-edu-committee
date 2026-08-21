"""전자회의록에서 공식 속기록을 받아 발언 단위로 쪼갠다.

뷰어 HTML(494KB)을 긁는 대신 **원본 XML** 을 쓴다. 발언자·안건·줄번호가 전부
태그로 붙어 있어서 정규식으로 헤맬 일이 없다. 임시회의록(속기 미확정)도
HWP 다운로드는 막혀 있지만 XML 은 열린다.

    /data/6450000{cdFpath}{cdCode}.xml
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

import requests

from config import COMMITTEE, MIN_BASE, MIN_XML_PREFIX, TIMEOUT, UA
from depts import affiliation, role_of, split_speaker

_S = requests.Session()
_S.headers.update({"User-Agent": UA, "Referer": MIN_BASE + "/main.do"})


def _get(path: str, **params):
    r = _S.get(MIN_BASE + path, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r


# ── 목록 ───────────────────────────────────────────────────────────────────

def list_sessions(daesu: int, group: str) -> list[dict]:
    """해당 대수·회의종류의 회기 목록."""
    return _get(
        "/assem/search/simple/LoadingSession_Year.json",
        searchCsDaesoo=daesu,
        searchCtGroup=group,
        searchCtUid=COMMITTEE[group]["ctUid"],
    ).json()


def list_records(session: int | str, group: str) -> list[dict]:
    """한 회기 안의 회의록 목록. cdUid·cdCode·cdFpath·cdImsi 가 들어 있다."""
    return _get(
        "/assem/search/simple/LoadingList.json",
        searchCsSession=session,
        searchCtGroup=group,
        searchCtUid=COMMITTEE[group]["ctUid"],
    ).json()


def list_attachments(cd_code: str) -> list[dict]:
    """검토보고서 등 부록 파일 목록."""
    try:
        return _get("/assem/LoadingSupplement.json", cdCode=cd_code).json()
    except Exception:
        return []


def attachment_url(csu_uid) -> str:
    return f"{MIN_BASE}/common/FileDown.do?csuUid={csu_uid}"


def hwp_url(cd_code: str) -> str:
    """회의록 원문 HWP. cdUid 로는 받아지지 않는다 (사이트 JS 에 등호 누락 버그)."""
    return f"{MIN_BASE}/common/FileDown.do?cdCode={cd_code}"


def viewer_url(cd_uid) -> str:
    return f"{MIN_BASE}/assem/viewer.do?cdUid={cd_uid}"


# ── 전문 ───────────────────────────────────────────────────────────────────

def fetch_xml(entry: dict) -> ET.Element:
    url = f"{MIN_BASE}{MIN_XML_PREFIX}{entry['cdFpath']}{entry['cdCode']}.xml"
    r = _S.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    # 선언에 인코딩이 안 붙어 있는 경우가 있어 바이트로 넘긴다.
    return ET.fromstring(r.content)


def _text(el: ET.Element | None) -> str:
    if el is None:
        return ""
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def parse(root: ET.Element) -> dict:
    """XML → 회의 메타 + 발언 목록."""
    head = root.find("head")
    body = root.find("body")
    tail = root.find("tail")

    meta = {
        "count": _text(head.find("count")) if head is not None else "",
        "title": _text(head.find("title")) if head is not None else "",
        "sort": _text(head.find("sort")) if head is not None else "",
        "place": _text(head.find("subplace")) if head is not None else "",
        "dateText": _text(head.find("date")) if head is not None else "",
    }
    st = body.find("sttime") if body is not None else None
    meta["startTime"] = _text(st)

    purpose = [
        _text(it)
        for p in (head.findall("purpose") if head is not None else [])
        for it in p.findall("item")
    ]
    matters = [
        _text(it)
        for p in (head.findall("matter") if head is not None else [])
        for it in p.findall("item")
    ]

    # 발언 쪼개기.
    # <data> 는 안건 단위, 그 안에서 <name> 이 나올 때마다 새 발언이 시작되고
    # 이어지는 <text> 가 그 발언의 문장이다. <title> 은 안건 제목.
    turns: list[dict] = []
    agendas: list[dict] = []
    for data in (body.findall("data") if body is not None else []):
        a_idx = data.get("idx")
        a_title = ""
        cur: dict | None = None
        for el in data:
            if el.tag == "title":
                a_title = _text(el)
                if a_title:
                    agendas.append({"idx": a_idx, "title": a_title})
            elif el.tag == "name":
                raw = _text(el)
                sprofile = el.get("sprofile") or "0"
                is_member = sprofile not in ("0", "", None)
                title, name = split_speaker(raw, is_member)
                dept, kind = (None, "의회") if is_member else affiliation(title)
                cur = {
                    "i": len(turns),
                    "agenda": a_idx,
                    "agendaTitle": a_title,
                    "speaker": re.sub(r"^[○↘\s]+", "", raw).strip(),
                    "title": title,
                    "name": name,
                    "cmUid": int(sprofile) if is_member else None,
                    "role": role_of(title, is_member),
                    "dept": dept,
                    "deptKind": kind,
                    "line": int(el.get("line") or 0),
                    "lines": [],
                }
                turns.append(cur)
            elif el.tag == "text" and cur is not None:
                t = _text(el)
                if t:
                    cur["lines"].append(t)

    turns = [t for t in turns if t["lines"]]
    for n, t in enumerate(turns):
        t["i"] = n

    attend: dict[str, list[str]] = {}
    if tail is not None:
        for grp in list(tail):
            label = (grp.get("title") or "").replace("○", "").strip()
            names = [_text(n) for n in grp.findall("name")]
            if label and names:
                attend[label] = names

    return {
        "meta": meta,
        "purpose": purpose,
        "matters": matters,
        "agendas": agendas,
        "turns": turns,
        "attend": attend,
    }


_DATE = re.compile(r"(\d{4})[.\-년\s]*(\d{1,2})[.\-월\s]*(\d{1,2})")


def iso_date(value: str) -> str:
    m = _DATE.search(value or "")
    return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ""


def group_of(entry: dict) -> str:
    return entry.get("ctGroup") or "S"
