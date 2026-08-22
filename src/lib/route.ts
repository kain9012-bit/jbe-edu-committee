import type { ActiveTab } from '../types';

/**
 * 화면 상태를 주소에 담는다.
 *
 * 이걸 안 하면 "우리 과 페이지 좀 봐" 하고 링크를 줄 수가 없다. 새로고침하면
 * 홈으로 돌아가고, 뒤로가기를 누르면 사이트를 나간다. 조직 안에서 도구가
 * 퍼지는 길이 메신저로 링크를 던지는 것인데, 그 길이 통째로 막힌다.
 *
 * 해시(`#/...`)를 쓴다. GitHub Pages 는 정적 호스팅이라 `/dept/행정국` 같은
 * 실제 경로로 들어오면 404 가 난다. 서버 설정 없이 되는 방법이 해시다.
 *
 *   #/dept/교원인사과
 *   #/record/430-2?turn=137
 *   #/search?q=늘봄
 */
export interface Route {
  tab: ActiveTab;
  meetingId?: string;
  focus?: string;
  query?: string;
  turn?: number;
}

const TABS: ActiveTab[] = ['home', 'meeting', 'record', 'dept', 'member', 'agenda', 'search'];

/** 탭마다 경로 두 번째 칸에 무엇이 오는가 */
function segmentOf(r: Route): string {
  if (r.tab === 'dept' || r.tab === 'member') return r.focus ?? '';
  if (r.tab === 'meeting' || r.tab === 'record') return r.meetingId ?? '';
  return '';
}

export function toHash(r: Route): string {
  const seg = segmentOf(r);
  let out = `#/${r.tab}`;
  if (seg) out += `/${encodeURIComponent(seg)}`;

  const qs = new URLSearchParams();
  if (r.tab === 'search' && r.query) qs.set('q', r.query);
  if (r.turn !== undefined && r.turn !== null) qs.set('turn', String(r.turn));
  const s = qs.toString();
  return s ? `${out}?${s}` : out;
}

export function fromHash(hash: string): Route | null {
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return null;

  const [path, search] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  const tab = parts[0] as ActiveTab;
  if (!TABS.includes(tab)) return null;

  const qs = new URLSearchParams(search ?? '');
  const turn = qs.get('turn');
  const r: Route = { tab };

  if (parts[1]) {
    if (tab === 'dept' || tab === 'member') r.focus = parts[1];
    else if (tab === 'meeting' || tab === 'record') r.meetingId = parts[1];
  }
  if (tab === 'search' && qs.get('q')) r.query = qs.get('q')!;
  if (turn !== null && /^\d+$/.test(turn)) r.turn = Number(turn);
  return r;
}
