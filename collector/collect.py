"""회의 목록을 만들고 확보된 회의록 전문을 저장한다.

    python collector/collect.py            # 새 회의만
    python collector/collect.py --all      # 전부 다시
    python collector/collect.py --id 430-1

하는 일은 셋이다.
 1. 영상 목록과 회의록 목록을 각각 받아 **(회기, 차수) 로 합친다.**
    영상은 다음 날 올라오고 회의록은 한 달 뒤에 나오므로, 회의 하나에 둘 중
    하나만 있는 시기가 반드시 생긴다. 그걸 상태로 표시해야 한다.
 2. 회의록이 있으면 XML 을 받아 발언 단위로 쪼개 data/records/ 에 넣는다.
 3. data/index.json 을 다시 쓴다.

**요약은 여기서 만들지 않는다.** 요약은 스킬을 따라 세션에서 사람이 쓴다.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import minutes
import vod
from config import ATTACH, INDEX, MEETINGS, RECORDS, TARGET_DAESU


def meeting_id(group: str, session, chasoo) -> str:
    """상임위는 `430-1`, 행정사무감사는 `2025K-1`."""
    return f"{session}{'K' if group == 'K' else ''}-{chasoo}"


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


# ── 1단계: 목록 합치기 ─────────────────────────────────────────────────────

def gather() -> dict[str, dict]:
    slots: dict[str, dict] = {}

    # 영상 먼저. 회의가 열렸다는 사실 자체는 영상이 가장 빨리 알려준다.
    for daesu in TARGET_DAESU:
        for row in vod.list_vods(daesu):
            session, chasoo = vod.parse_label(row)
            if not session or not chasoo:
                continue
            # 행정사무감사 영상은 안건명에 표시가 붙는다.
            group = "K" if "행정사무감사" in row["label"] else "S"
            mid = meeting_id(group, session, chasoo)
            slot = slots.setdefault(mid, {
                "id": mid, "kind": group, "daesu": daesu,
                "session": session, "chasoo": chasoo,
                "sessionName": row["sessionName"], "date": row["date"],
                "vod": [], "record": None,
            })
            slot["vod"].append({
                "vodNo": row["vodNo"], "label": row["label"], "date": row["date"],
                "playerUrl": vod.player_url(row["vodNo"]),
            })
            # 오전/오후로 나뉜 영상은 날짜가 같다. 이른 쪽을 회의일로 둔다.
            if row["date"] < slot["date"]:
                slot["date"] = row["date"]

    # 회의록.
    for daesu in TARGET_DAESU:
        for group in ("S", "K"):
            for sess in minutes.list_sessions(daesu, group):
                for e in minutes.list_records(sess["csNum"], group):
                    try:
                        chasoo = int(str(e.get("cdChasoo") or "0"))
                    except ValueError:
                        continue
                    mid = meeting_id(group, e["csSession"], chasoo)
                    slot = slots.setdefault(mid, {
                        "id": mid, "kind": group, "daesu": e.get("csDaesoo", daesu),
                        "session": e["csSession"], "chasoo": chasoo,
                        "sessionName": f"제{e['csSession']}회 {e.get('csTypeNm', '')}".strip(),
                        "date": minutes.iso_date(e.get("cdDate", "")),
                        "vod": [], "record": None,
                    })
                    slot["record"] = e
                    slot["date"] = minutes.iso_date(e.get("cdDate", "")) or slot["date"]
    return slots


# ── 2단계: 전문 저장 ───────────────────────────────────────────────────────

def save_record(slot: dict) -> dict | None:
    """회의록 XML 을 받아 발언 단위 파일로 저장하고 요약 통계를 돌려준다."""
    e = slot["record"]
    if not e:
        return None

    parsed = minutes.parse(minutes.fetch_xml(e))
    status = "임시" if (e.get("cdImsi") or "").upper() == "Y" else "확정"

    atts = minutes.list_attachments(e["cdCode"])
    attachments = [{
        "name": a.get("csuOfnm"),
        "kbyte": a.get("csuKbyte"),
        "url": minutes.attachment_url(a.get("csuUid")),
    } for a in atts if (a.get("outActive") or "Y") == "Y"]

    doc = {
        "id": slot["id"],
        "title": f"{slot['sessionName']} 제{slot['chasoo']}차 교육위원회",
        "date": slot["date"],
        "source": "record",
        "recordStatus": status,
        "publishedAt": minutes.iso_date(e.get("cdRegdate", "")),
        "cdUid": e.get("cdUid"),
        "cdCode": e.get("cdCode"),
        "viewerUrl": minutes.viewer_url(e.get("cdUid")),
        "hwpUrl": None if status == "임시" else minutes.hwp_url(e["cdCode"]),
        **parsed,
        "attachments": attachments,
    }
    write_json(RECORDS / f"{slot['id']}.json", doc)
    if attachments:
        write_json(ATTACH / f"{slot['id']}.json", attachments)
    return doc


def stats(doc: dict) -> dict:
    turns = doc["turns"]
    members, depts = [], []
    for t in turns:
        if t["role"] == "의원" and t["name"] not in members:
            members.append(t["name"])
        if t.get("dept") and t["dept"] not in depts:
            depts.append(t["dept"])
    return {
        "turnCount": len(turns),
        "sentenceCount": sum(len(t["lines"]) for t in turns),
        "members": members,
        "depts": depts,
        "agendaCount": len(doc.get("matters") or doc.get("purpose") or []),
        "attachmentCount": len(doc.get("attachments") or []),
    }


# ── 실행 ───────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="이미 받은 회의도 다시 받는다")
    ap.add_argument("--id", help="이 회의 하나만")
    ap.add_argument("--with-stream", action="store_true",
                    help="영상 스트림 주소까지 받는다 (회의당 1회 요청 추가)")
    args = ap.parse_args()

    print("목록을 받는 중…")
    slots = gather()
    print(f"  회의 {len(slots)}건")

    entries = []
    for mid, slot in sorted(slots.items(), key=lambda kv: kv[1]["date"], reverse=True):
        if args.id and mid != args.id:
            # 목록에는 남기되 전문은 건드리지 않는다.
            old = read_json(RECORDS / f"{mid}.json")
            if old:
                entries.append(entry_of(slot, old, args))
                continue

        path = RECORDS / f"{mid}.json"
        doc = read_json(path)
        need = args.all or doc is None
        # 임시회의록이 확정본으로 바뀌면 본문이 통째로 교체된다. 반드시 다시 받는다.
        if doc and slot["record"]:
            was = doc.get("recordStatus")
            now = "임시" if (slot["record"].get("cdImsi") or "").upper() == "Y" else "확정"
            if was != now:
                print(f"  {mid}: 회의록 {was} → {now}, 다시 받습니다")
                need = True
        if doc is None and slot["record"] is None:
            need = False   # 회의록이 아직 안 나온 회의

        if need and slot["record"]:
            print(f"  {mid} 전문 받는 중…")
            doc = save_record(slot)

        entries.append(entry_of(slot, doc, args))

    index = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "committee": "전북특별자치도의회 교육위원회",
        "meetings": entries,
    }
    write_json(INDEX, index)
    done = sum(1 for e in entries if e["hasRecord"])
    print(f"완료. 전문 확보 {done}/{len(entries)}건 → {INDEX}")
    return 0


def entry_of(slot: dict, doc: dict | None, args) -> dict:
    mid = slot["id"]
    vods = list(slot["vod"])
    if args.with_stream:
        for v in vods:
            if "m3u8" not in v:
                try:
                    v.update(vod.fetch_stream(v["vodNo"]))
                except Exception as err:      # 영상 하나 못 받았다고 전체를 멈추지 않는다
                    print(f"    ! {mid} vod {v['vodNo']}: {err}")

    asr_doc = read_json(RECORDS / f"{mid}.asr.json")
    summary = (MEETINGS / f"{mid}.json").exists()

    entry = {
        "id": mid,
        "kind": slot["kind"],
        "daesu": slot["daesu"],
        "session": slot["session"],
        "sessionName": slot["sessionName"],
        "chasoo": slot["chasoo"],
        "date": slot["date"],
        "title": f"{slot['sessionName']} 제{slot['chasoo']}차 교육위원회"
                 + (" (행정사무감사)" if slot["kind"] == "K" else ""),
        "vod": vods,
        "hasRecord": doc is not None,
        "hasSummary": summary,
        "source": "record" if doc else ("asr" if asr_doc else None),
        "recordStatus": doc.get("recordStatus") if doc else None,
        "publishedAt": doc.get("publishedAt") if doc else None,
        "viewerUrl": doc.get("viewerUrl") if doc else None,
    }
    entry.update(stats(doc) if doc else (stats(asr_doc) if asr_doc else {
        "turnCount": 0, "sentenceCount": 0, "members": [], "depts": [],
        "agendaCount": 0, "attachmentCount": 0,
    }))
    return entry


if __name__ == "__main__":
    raise SystemExit(main())
