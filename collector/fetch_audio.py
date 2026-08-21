"""의사중계 영상에서 오디오만 뽑아 온다.

    python collector/fetch_audio.py                 # 속기록이 없는 회의만
    python collector/fetch_audio.py --id 430-5
    python collector/fetch_audio.py --all

## 왜 필요한가
도의회 속기록은 회의 후 보통 3~4주, 정례회·행정사무감사철에는 두 달까지 걸린다.
그 사이를 비워 두지 않으려고 영상 음성을 받아쓴 **임시본**을 만든다.
속기록이 나오면 전문은 자동으로 교체된다(collect.py).

## 왜 이걸 사용자 PC에서 돌려야 하나
스트림이 **7443 포트**로 나간다. 클라우드 컨테이너의 송출 프록시는 비표준 포트를
중계하지 않아서 TLS 핸드셰이크 단계에서 끊긴다. 국내 사무실 회선에서는 그냥 된다.
목록·플레이어 페이지는 443 이라 어디서든 되지만, **오디오만은 여기서 받아야 한다.**

## ffmpeg 가 필요하다
HLS(m3u8) 라 조각을 이어 붙여야 한다. `ffmpeg -i <m3u8> -vn -c:a aac out.m4a`.
윈도우면 `winget install Gyan.FFmpeg` 또는 https://ffmpeg.org 에서 받는다.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import vod  # noqa: E402
from config import AUDIO, INDEX  # noqa: E402


def have_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def grab(m3u8: str, out: Path) -> bool:
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".part.m4a")
    cmd = [
        "ffmpeg", "-nostdin", "-y",
        "-loglevel", "warning", "-stats",
        "-i", m3u8,
        "-vn",                      # 영상은 버린다. 받아쓰기에 쓸 일이 없다.
        "-ac", "1",                 # 모노. 화자 임베딩도 모노로 쓴다.
        "-ar", "16000",             # whisper 가 쓰는 샘플레이트
        "-c:a", "aac", "-b:a", "48k",
        str(tmp),
    ]
    print("   내려받는 중… 3~5시간짜리 회의는 몇 분 걸립니다")
    r = subprocess.run(cmd)
    if r.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(out)
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="회의 오디오 내려받기")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--id", help="회의 (예: 430-5)")
    args = ap.parse_args()

    if not have_ffmpeg():
        print("ffmpeg 가 없습니다. https://ffmpeg.org 에서 설치한 뒤 다시 실행하세요.")
        return 1
    if not INDEX.exists():
        print("data/index.json 이 없습니다. 먼저 collector/collect.py 를 돌리세요.")
        return 1

    meetings = json.loads(INDEX.read_text(encoding="utf-8"))["meetings"]
    if args.id:
        targets = [m for m in meetings if m["id"] == args.id]
        if not targets:
            print(f"{args.id} 를 목록에서 찾지 못했습니다.")
            return 1
    elif args.all:
        targets = meetings
    else:
        # 기본은 **속기록이 아직 없는 회의만**. 속기록이 있으면 받아쓸 이유가 없다.
        targets = [m for m in meetings if not m["hasRecord"]]
        if not targets:
            print("속기록이 없는 회의가 없습니다. 받아쓸 대상이 없습니다.")
            print("(특정 회의를 굳이 받아보려면 --id 를 쓰세요)")
            return 0

    ok = 0
    for m in targets:
        print(f"\n{m['id']} · {m['title']}")
        if not m.get("vod"):
            print("   영상이 없습니다.")
            continue
        # 오전·오후로 나뉜 회의는 파일이 둘이다. 이어 붙이지 않고 따로 둔다 —
        # 시각이 각자 0부터 시작하므로 합치면 타임스탬프가 어긋난다.
        for n, v in enumerate(m["vod"], 1):
            suffix = "" if len(m["vod"]) == 1 else f"-{n}"
            out = AUDIO / f"{m['id']}{suffix}.m4a"
            if out.exists() and not args.all:
                print(f"   이미 있음: {out.name}")
                continue
            url = v.get("m3u8")
            if not url:
                print(f"   {v['vodNo']} 스트림 주소를 찾는 중…")
                try:
                    url = vod.fetch_stream(v["vodNo"]).get("m3u8")
                except Exception as err:
                    print(f"   실패: {err}")
                    continue
            if not url:
                print(f"   {v['vodNo']}: 스트림 주소가 없습니다.")
                continue
            if grab(url, out):
                mb = out.stat().st_size / 1024 / 1024
                print(f"   완료: {out.name}  ({mb:.1f} MB)")
                ok += 1
            else:
                print("   실패. 7443 포트가 막힌 회선이면 받을 수 없습니다.")

    print(f"\n{ok}개 받았습니다 → {AUDIO}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
