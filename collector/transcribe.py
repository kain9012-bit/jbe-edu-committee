"""속기록이 나오기 전까지 쓸 **임시본**을 만든다.

    python collector/transcribe.py --id 430-5
    python collector/transcribe.py --id 430-5 --resume       # 받아쓰기는 건너뛰고 정리만
    python collector/transcribe.py --id 430-5 --no-diarize

산출물
    data/asr/<회의>.json          받아쓴 원본 (조각 단위, 시각 포함)
    data/records/<회의>.asr.json  화면이 읽는 회의록 꼴 (발언 단위)

## 이건 임시본이다
공식 속기록이 나오면 collect.py 가 `data/records/<회의>.json` 을 만들고,
화면은 그쪽을 먼저 읽는다. 받아쓴 임시본은 지우지 않고 남겨 둔다 —
나중에 "속기록이 이 대목을 어떻게 고쳤나" 를 볼 수 있어야 한다.

## 화자는 목소리로만 가른다
군집이 알려 주는 건 '이 구간과 저 구간은 같은 사람'까지다. 누구인지는 모른다.
`data/human/<회의>.json` 에 사람이 적으면 그 이름이 붙는다.

    {"speakers": {"0": "위원장 전용태", "3": "행정국장 이현규"}}

키는 **군집 번호**다. 추측해서 채우지 않는다. 모르면 비워 둔다 —
틀린 이름이 붙은 부서별 집계는 비어 있는 집계보다 나쁘다.

## 표준 도구를 안 쓰는 이유
pyannote 의 사전학습 모델은 HuggingFace gated 저장소라 계정·약관 동의·토큰이
필요하다. 토큰을 주고받지 않으려고 speechbrain ECAPA 임베딩 + 군집화로 대신한다.
위원회 회의처럼 화자가 또렷이 번갈아 말하는 구조에서는 충분하다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import ASR, AUDIO, INDEX, RECORDS  # noqa: E402

SR = 16000


def audio_files(mid: str) -> list[Path]:
    """오전·오후로 나뉜 회의는 파일이 둘이다. 이름순으로 이어서 다룬다."""
    return sorted(p for p in AUDIO.glob(f"{mid}*.m4a") if p.is_file())


def load_wave(path: Path):
    import subprocess

    import numpy as np
    cmd = ["ffmpeg", "-nostdin", "-threads", "0", "-i", str(path),
           "-f", "s16le", "-ac", "1", "-acodec", "pcm_s16le", "-ar", str(SR), "-"]
    out = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.int16).astype("float32") / 32768.0


# ── 1) 받아쓰기 ────────────────────────────────────────────────────────────

def transcribe(path: Path, model_size: str, offset: float = 0.0) -> list[dict]:
    from faster_whisper import WhisperModel

    print(f"   모델 준비: {model_size} (처음이면 내려받느라 몇 분 걸립니다)")
    model = WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=0)

    print(f"   받아쓰는 중… {path.name}")
    t0 = time.time()
    segments, _ = model.transcribe(
        str(path),
        language="ko",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 600},
        beam_size=5,
        condition_on_previous_text=False,   # 앞 문장을 물고 늘어져 헛말을 만드는 걸 막는다
    )
    out = []
    for s in segments:
        text = (s.text or "").strip()
        if not text:
            continue
        out.append({"start": round(s.start + offset, 2),
                    "end": round(s.end + offset, 2),
                    "text": text})
        if len(out) % 200 == 0:
            print(f"     {len(out)}조각 · {out[-1]['end'] / 60:.0f}분까지 "
                  f"({time.time() - t0:.0f}초 경과)")
    print(f"   받아쓰기 완료: {len(out)}조각 · {time.time() - t0:.0f}초")
    return out


# ── 2) 되풀이 제거 ─────────────────────────────────────────────────────────

_REPEAT = re.compile(r"(.{4,40}?)\1{2,}")


def dedupe(segs: list[dict]) -> int:
    """whisper 가 같은 말을 수십 번 반복해 뱉는 자리를 정리한다.

    긴 침묵이나 잡음 구간에서 자주 나온다. 그대로 두면 검색 결과가 그 한 줄로
    도배된다. 원문이 실제로 반복한 경우와 구분할 수 없으므로 **3회 이상**만 줄인다.
    """
    n = 0
    for s in segs:
        fixed = _REPEAT.sub(r"\1", s["text"])
        if fixed != s["text"]:
            s["text"] = fixed
            n += 1
    return n


# ── 3) 화자 군집 ───────────────────────────────────────────────────────────

def embed_segments(wave, segs: list[dict], min_sec: float = 1.2):
    """조각마다 화자 임베딩을 만든다. 너무 짧은 조각은 건너뛴다."""
    import numpy as np
    import torch
    from speechbrain.inference.speaker import EncoderClassifier

    enc = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=str(Path.home() / ".cache" / "speechbrain-ecapa"),
        run_opts={"device": "cpu"},
    )
    idx, vecs = [], []
    for i, s in enumerate(segs):
        a, b = int(s["start"] * SR), int(s["end"] * SR)
        if b - a < int(min_sec * SR) or b > len(wave):
            continue
        chunk = torch.from_numpy(np.ascontiguousarray(wave[a:b])).unsqueeze(0)
        with torch.no_grad():
            v = enc.encode_batch(chunk).squeeze().cpu().numpy()
        idx.append(i)
        vecs.append(v / (np.linalg.norm(v) + 1e-9))
        if len(vecs) % 100 == 0:
            print(f"     임베딩 {len(vecs)}개")
    return idx, (np.stack(vecs) if vecs else None)


def cluster(vecs, n_speakers: int | None):
    """화자 수를 모르면 실루엣 점수가 가장 높은 개수를 고른다."""
    import numpy as np
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score

    if vecs is None or len(vecs) < 4:
        return None, None
    if n_speakers:
        model = AgglomerativeClustering(n_clusters=n_speakers, metric="cosine",
                                        linkage="average")
        return model.fit_predict(vecs), None

    best, best_score, best_k = None, -1.0, None
    for k in range(2, min(20, len(vecs) // 3) + 1):
        labels = AgglomerativeClustering(n_clusters=k, metric="cosine",
                                         linkage="average").fit_predict(vecs)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(vecs, labels, metric="cosine")
        if score > best_score:
            best, best_score, best_k = labels, score, k
    print(f"     군집 {best_k}개 · 실루엣 {best_score:.3f}"
          if best is not None else "     군집을 만들지 못했습니다")
    return best, np.round(best_score, 3) if best is not None else None


# ── 4) 발언 단위로 묶기 ────────────────────────────────────────────────────

def to_turns(segs: list[dict]) -> list[dict]:
    """화자가 바뀔 때마다 새 발언으로 끊는다.

    화자가 안 붙은 조각은 앞 발언에 이어 붙인다. 임의로 새 발언을 만들면
    발언 수가 실제와 크게 어긋나 부서별 집계가 부풀려진다.
    """
    turns: list[dict] = []
    for s in segs:
        spk = s.get("cluster")
        if not turns or (spk is not None and turns[-1].get("cluster") != spk):
            turns.append({
                "i": len(turns),
                "agenda": None,
                "agendaTitle": "",
                "speaker": "",
                "title": "",
                "name": "",
                "cmUid": None,
                "role": "기타",
                "dept": None,
                "deptKind": "기타",
                "cluster": spk,
                "t": s["start"],
                "lines": [],
            })
        turns[-1]["lines"].append(s["text"])
    return turns


def apply_names(turns: list[dict], names: dict[str, str]) -> int:
    """사람이 적어 준 군집→이름을 붙인다. 적힌 것만 붙는다."""
    from depts import affiliation, role_of, split_speaker

    n = 0
    for t in turns:
        raw = names.get(str(t.get("cluster")))
        if not raw:
            continue
        title, name = split_speaker(raw)
        dept, kind = affiliation(title)
        t.update({
            "speaker": raw, "title": title, "name": name,
            "role": role_of(title, "위원" in raw),
            "dept": dept, "deptKind": kind,
        })
        n += 1
    return n


# ── 실행 ───────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="영상 음성을 받아써 임시 회의록을 만든다")
    ap.add_argument("--id", required=True, help="회의 (예: 430-5)")
    ap.add_argument("--model", default="large-v3-turbo",
                    help="faster-whisper 모델 (large-v3-turbo / medium / small)")
    ap.add_argument("--speakers", type=int, help="화자 수를 알면 지정")
    ap.add_argument("--no-diarize", action="store_true", help="화자 분리를 건너뛴다")
    ap.add_argument("--resume", action="store_true",
                    help="이미 받아쓴 결과를 그대로 쓰고 정리만 다시 한다")
    args = ap.parse_args()

    mid = args.id
    asr_path = ASR / f"{mid}.json"
    files = audio_files(mid)

    # 1) 받아쓰기
    if args.resume and asr_path.exists():
        segs = json.loads(asr_path.read_text(encoding="utf-8"))["segments"]
        print(f"이미 받아쓴 {len(segs)}조각을 씁니다.")
    else:
        if not files:
            print(f"오디오가 없습니다: {AUDIO}/{mid}*.m4a")
            print("먼저 사용자 PC에서 collector/fetch_audio.py 를 돌리세요.")
            return 1
        segs = []
        offset = 0.0
        for p in files:
            part = transcribe(p, args.model, offset)
            segs.extend(part)
            # 오전·오후 파일을 이을 때 시각이 겹치지 않게 뒤 파일을 밀어 준다.
            offset = (part[-1]["end"] + 60) if part else offset
        fixed = dedupe(segs)
        if fixed:
            print(f"   되풀이 {fixed}조각 정리")
        ASR.mkdir(parents=True, exist_ok=True)
        asr_path.write_text(
            json.dumps({"id": mid, "segments": segs}, ensure_ascii=False, indent=1),
            encoding="utf-8")
        print(f"   저장: {asr_path}")

    # 2) 화자
    score = None
    if not args.no_diarize and files:
        print("   화자를 가르는 중…")
        try:
            wave = load_wave(files[0]) if len(files) == 1 else None
            if wave is None:
                import numpy as np
                wave = np.concatenate([load_wave(p) for p in files])
            idx, vecs = embed_segments(wave, segs)
            labels, score = cluster(vecs, args.speakers)
            if labels is not None:
                for i, lab in zip(idx, labels):
                    segs[i]["cluster"] = int(lab)
        except Exception as err:
            print(f"   화자 분리를 건너뜁니다: {err}")

    # 3) 회의록 꼴로
    turns = to_turns(segs)
    human = Path(__file__).parent.parent / "data" / "human" / f"{mid}.json"
    named = 0
    if human.exists():
        names = json.loads(human.read_text(encoding="utf-8")).get("speakers", {})
        named = apply_names(turns, names)

    entry = {}
    if INDEX.exists():
        for m in json.loads(INDEX.read_text(encoding="utf-8"))["meetings"]:
            if m["id"] == mid:
                entry = m
                break

    doc = {
        "id": mid,
        "title": entry.get("title", mid),
        "date": entry.get("date", ""),
        "source": "asr",
        "recordStatus": None,
        "publishedAt": None,
        "viewerUrl": None,
        "hwpUrl": None,
        "meta": {"count": "", "title": "받아쓴 임시본", "sort": "", "place": "",
                 "dateText": "", "startTime": ""},
        "purpose": [],
        "matters": [],
        "agendas": [],
        "turns": turns,
        "attend": {},
        "attachments": [],
        "asrScore": score,
    }
    out = RECORDS / f"{mid}.asr.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    clusters = {t.get("cluster") for t in turns if t.get("cluster") is not None}
    print(f"\n발언 {len(turns)}건 · 군집 {len(clusters)}개 · 이름 붙은 발언 {named}건")
    print(f"→ {out}")
    if named == 0 and clusters:
        print(f"\n군집에 이름을 붙이려면 data/human/{mid}.json 에 이렇게 적으세요:")
        print('  {"speakers": {"0": "위원장 전용태", "3": "행정국장 이현규"}}')
        print("추측해서 채우지 마세요. 모르면 비워 두는 편이 낫습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
