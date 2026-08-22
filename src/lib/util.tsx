import type { ReactNode } from 'react';
import type { IndexEntry } from '../types';

/** 2026-07-20 → 2026. 7. 20.(월) */
export function korDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // 보는 사람의 시간대에 따라 날짜가 하루 밀리면 안 된다. UTC 기준으로만 요일을 구한다.
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${y}. ${mo}. ${d}.(${wd})`;
}

/** 두 날짜 사이 일수 */
export function daysBetween(a: string, b: string): number | null {
  const pa = Date.parse(a), pb = Date.parse(b);
  if (Number.isNaN(pa) || Number.isNaN(pb)) return null;
  return Math.round((pb - pa) / 86400000);
}

/**
 * 띄어쓰기를 무시하는 검색.
 *
 * 회의록은 `학교폭력` 인데 사람은 `학교 폭력` 이라고 친다. 반대도 마찬가지다.
 * 글자 그대로만 맞추면 0건이 나오고, 쓰는 사람은 "검색이 안 되네" 로 받아들인다.
 * 글자 사이에 공백이 얼마든 들어갈 수 있게 정규식을 만든다.
 */
export function looseRegex(query: string, flags = 'gi'): RegExp | null {
  const chars = query.replace(/\s+/g, '').split('');
  if (chars.length === 0) return null;
  const body = chars.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  return new RegExp(body, flags);
}

/** 이 글에 검색어가 들어 있는가 (띄어쓰기 무시) */
export function looseTest(text: string, query: string): boolean {
  const re = looseRegex(query, 'i');
  return re ? re.test(text) : false;
}

/** 검색어를 <mark>로 감싸 React 노드로 돌려준다 (dangerouslySetInnerHTML 없이) */
export function highlight(text: string, query: string): ReactNode[] {
  const q = query.trim();
  if (!q) return [text];
  const re = looseRegex(q);
  if (!re) return [text];
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={`h${k++}`}>{m[0]}</mark>);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── 회의 상태 ─────────────────────────────────────────────────────────────

/**
 * 한 회의가 지금 어느 단계에 있는가.
 *
 * 영상은 다음 날 올라오지만 속기록은 평균 한 달 뒤에 나온다. 그 사이가 반드시
 * 생기므로 **비어 있다는 사실 자체를 화면에 드러내야 한다.** 아무것도 없는 회의를
 * 목록에서 빼버리면 "그 날 회의가 없었나 보다" 로 읽힌다.
 */
export type Stage = 'summary' | 'record' | 'asr' | 'waiting';

export function stageOf(m: IndexEntry): Stage {
  if (m.hasSummary) return 'summary';
  if (m.source === 'record') return 'record';
  if (m.source === 'asr') return 'asr';
  return 'waiting';
}

/**
 * 배지에 적는 말.
 *
 * `속기록 확보` 처럼 수집기 사정을 적어 두면 읽는 사람이 그걸로 할 수 있는 일이 없다.
 * **여기서 무엇을 볼 수 있는가**를 적는다.
 */
export const STAGE_LABEL: Record<Stage, string> = {
  summary: '요약 정리됨',
  record: '전문 열람 가능',
  asr: '받아쓴 임시본',
  waiting: '회의록 준비 중',
};

export const STAGE_TONE: Record<Stage, 'blue' | 'green' | 'amber' | 'slate'> = {
  summary: 'blue',
  record: 'green',
  asr: 'amber',
  waiting: 'slate',
};

/**
 * 확정 전 회의록이라는 사실을 **어디에 적을 것인가**.
 *
 * 처음에는 목록·요약·전문 세 곳에 노란 배지로 달았다. 그런데 읽는 사람이 그걸로
 * 할 수 있는 일이 없다. 임시본이든 확정본이든 도의회가 발간한 공식 회의록이고,
 * 확정본이 나오면 이 화면도 알아서 갈린다. 경고색만 남으니 불신만 샀다.
 *
 * 딱 한 사람에게는 필요하다 — **이 문장을 보고서나 공문에 옮겨 적는 사람.**
 * 나중에 표현이 다듬어질 수 있다는 게 그 사람에게는 실제 위험이다.
 * 그 사람은 회의록 전문을 열어 놓고 복사하고 있을 테니, **거기에만** 적는다.
 */
export const QUOTE_CAUTION =
  '확정 전 회의록입니다. 그대로 인용하실 때는 확정본에서 표현이 다듬어질 수 있다는 점만 '
  + '감안해 주세요. 확정본이 나오면 이 화면도 자동으로 바뀝니다.';

/** 자료의 출처를 한 줄로. 읽는 사람이 무엇을 믿어도 되는지 판단하는 근거다. */
export function sourceNote(m: IndexEntry): string {
  // 임시본과 확정본을 갈라 적지 않는다. 둘 다 도의회가 발간한 공식 회의록이고,
  // 읽는 사람이 그 차이로 할 수 있는 일이 없다. 인용할 사람만 전문 탭에서 본다.
  if (m.source === 'record') return '전북특별자치도의회 공식 회의록';
  // 받아쓴 임시본은 다르다. 오인식이 있을 수 있다는 건 읽는 방식을 바꾸는 정보다.
  if (m.source === 'asr') return '영상 음성을 받아쓴 임시본 — 오인식이 있을 수 있습니다';
  return '회의록이 아직 발간되지 않았습니다';
}

/** 부서 종류별 정렬 순서 — 본청을 먼저, 그 다음 직속기관·교육지원청 */
const KIND_RANK: Record<string, number> = {
  본청: 0, 기관장: 1, 직속기관: 2, 교육지원청: 3, 의회: 4, 기타: 5,
};
export function kindRank(kind: string): number {
  return KIND_RANK[kind] ?? 9;
}

/**
 * 필터에 세울 묶음 순서 — 기구도 차례대로.
 *
 * 필터를 과 단위로 두면 `문예체건강과 (1)` 처럼 한 건짜리 항목이 국들 사이에
 * 끼어 스무 개가 넘는 목록이 된다. 국 단위로 묶으면 고를 것이 예닐곱 개다.
 */
export const GROUP_ORDER = [
  '교육감·부교육감 직속', '정책국', '교육국', '행정국', '직속기관', '교육지원청',
];
export function groupRank(g: string | null | undefined): number {
  const i = GROUP_ORDER.indexOf(g ?? '');
  return i < 0 ? GROUP_ORDER.length : i;
}
