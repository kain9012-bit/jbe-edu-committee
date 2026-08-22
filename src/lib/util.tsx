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

export const STAGE_LABEL: Record<Stage, string> = {
  summary: '정리 완료',
  record: '속기록 확보',
  asr: '받아쓴 임시본',
  waiting: '속기록 대기',
};

export const STAGE_TONE: Record<Stage, 'blue' | 'green' | 'amber' | 'slate'> = {
  summary: 'blue',
  record: 'green',
  asr: 'amber',
  waiting: 'slate',
};

/**
 * '속기 미확정' 이 무슨 뜻인지 풀어 준다.
 *
 * 노란 배지만 달아 놓으면 읽는 사람은 "그럼 이걸 믿어도 되나" 로 받아들인다.
 * 실제로는 도의회가 발간한 공식 회의록이고, 확정본에서 바뀌는 것은 표현을
 * 다듬는 수준이지 내용이 뒤집히지 않는다. 그 사실을 말해 주지 않으면
 * 배지가 불신만 남긴다.
 */
export const IMSI_NOTE =
  '도의회가 발간한 공식 회의록입니다. 속기사 검토가 끝나면 확정본으로 바뀌는데, '
  + '대개 표현을 다듬는 수준이고 발언 내용이 뒤집히지는 않습니다. '
  + '확정본이 나오면 이 화면의 전문도 자동으로 교체됩니다.';

/** 자료의 출처를 한 줄로. 읽는 사람이 무엇을 믿어도 되는지 판단하는 근거다. */
export function sourceNote(m: IndexEntry): string {
  if (m.source === 'record') {
    const kind = m.recordStatus === '임시' ? '임시회의록(속기 미확정)' : '확정 회의록';
    return `전북특별자치도의회 공식 ${kind}`;
  }
  if (m.source === 'asr') return '영상 음성을 받아쓴 임시본 — 오인식이 있을 수 있습니다';
  return '속기록이 아직 발간되지 않았습니다';
}

/** 부서 종류별 정렬 순서 — 본청을 먼저, 그 다음 직속기관·교육지원청 */
const KIND_RANK: Record<string, number> = {
  본청: 0, 기관장: 1, 직속기관: 2, 교육지원청: 3, 의회: 4, 기타: 5,
};
export function kindRank(kind: string): number {
  return KIND_RANK[kind] ?? 9;
}
