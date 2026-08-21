"""인터넷 의사중계에서 영상 목록과 스트림 주소를 받아온다.

회의록은 한 달쯤 뒤에 나오지만 영상은 다음 날 올라온다. 그 공백 동안
받아쓰기 임시본을 만들려면 여기서 m3u8 주소를 얻어야 한다.

주의 — 스트림이 **7443 포트**라 클라우드에서는 막힌다. 오디오 받기는 반드시
사용자 PC에서 실행해야 한다(오디오받기.bat). 목록·플레이어 페이지는 443 이라
어디서든 된다.
"""
from __future__ import annotations

import re

import requests

from config import TIMEOUT, UA, VOD_BASE, VOD_DAESU, VOD_SCATE_EDU

_S = requests.Session()
_S.headers.update({"User-Agent": UA, "Referer": VOD_BASE + "/vod/list_standing_commitee.ifn"})

_ROW = re.compile(r"<tr>(.*?)</tr>", re.S)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_TAG = re.compile(r"<[^>]+>")


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", _TAG.sub(" ", s)).strip()


def list_vods(daesu: int) -> list[dict]:
    """교육위원회 VOD 목록. pageSize 를 크게 주면 한 번에 다 온다."""
    r = _S.get(
        VOD_BASE + "/vod/list_standing_commitee.ifn",
        params={
            "sch_scate_no": VOD_SCATE_EDU,
            "sch_daesu_no": VOD_DAESU[daesu],
            "sch_period_no": "all",
            "pageNo": 1,
            "pageSize": 1000,
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    body = re.search(r"<tbody>(.*?)</tbody>", r.text, re.S)
    if not body:
        return []

    out = []
    for tr in _ROW.findall(body.group(1)):
        vod = re.search(r'data-vod_no="(\d+)"', tr)
        if not vod:
            continue
        tds = [_clean(t) for t in _TD.findall(tr)]
        if len(tds) < 4:
            continue
        out.append({
            "vodNo": vod.group(1),
            "sessionName": tds[1],
            "label": tds[2],
            "date": tds[3],
        })
    return out


def player_url(vod_no: str) -> str:
    return f"{VOD_BASE}/vod/pop_council_vod_player.ifn?vod_no={vod_no}"


def fetch_stream(vod_no: str) -> dict:
    """플레이어 페이지를 열어 m3u8·포스터·챕터를 뽑는다.

    챕터(발언자 인덱스)는 최근 회의에 아예 없다. 2026-04-15 이후 교육위 영상은
    전부 0건이었다. 있으면 쓰고 없으면 그만이지, 여기에 기대면 안 된다.
    """
    r = _S.get(player_url(vod_no), timeout=TIMEOUT)
    r.raise_for_status()
    h = r.text
    src = re.search(r"source:\s*'([^']+)'", h)
    poster = re.search(r"poster:\s*'([^']+)'", h)

    chapters = []
    pat = re.compile(
        r"<a id=\"chapter_(\d+)\"[^>]*\{position:'(\d+)',\s*dele_no:'(\d+)'\}\">(.*?)</a>",
        re.S,
    )
    for m in pat.finditer(h):
        inner = m.group(4)
        name = re.search(r'class="name"[^>]*>(.*?)<', inner)
        title = re.search(r'class="infor_title"[^>]*>(.*?)<', inner)
        chapters.append({
            "position": int(m.group(2)),
            "name": _clean(name.group(1)) if name else "",
            "title": _clean(title.group(1)) if title else "",
        })

    return {
        "vodNo": vod_no,
        "m3u8": src.group(1) if src else None,
        "poster": poster.group(1) if poster else None,
        "chapters": chapters,
        "playerUrl": player_url(vod_no),
    }


_CHASOO = re.compile(r"제\s*(\d+)\s*차")
_SESSION = re.compile(r"제\s*(\d+)\s*회")


def parse_label(row: dict) -> tuple[int | None, int | None]:
    """('제430회 임시회', '제1차 교육위원회 #2') → (430, 1)"""
    s = _SESSION.search(row.get("sessionName", ""))
    c = _CHASOO.search(row.get("label", ""))
    return (int(s.group(1)) if s else None, int(c.group(1)) if c else None)
