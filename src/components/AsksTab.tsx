import React, { useCallback, useMemo, useState } from 'react';
import { ClipboardList, RotateCcw, Search } from 'lucide-react';
import type { Ask, DerivedDoc, IndexDoc, Navigate } from '../types';
import { ChipRow, EmptyState, SectionTitle } from './Ui';
import { AskItem } from './AskItem';
import { MeetingFilter } from './MeetingFilter';
import { kindRank, looseTest } from '../lib/util';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  asks: Ask[];
  loading: boolean;
  onNavigate: Navigate;
}

const TYPES = ['전체', '자료요구', '지적사항', '요청'] as const;

/** 고르개 하나하나가 목록을 어떻게 좁히는가 */
type FilterKey = 'type' | 'meeting' | 'dept' | 'member' | 'q';
const KEYS: FilterKey[] = ['type', 'meeting', 'dept', 'member', 'q'];

/**
 * 위원들이 요구하거나 지적한 것만 모아 보는 화면.
 *
 * 원래는 안건 탭 안쪽 칩에 들어 있었다. 그런데 이건 이 서비스에서 **집행부가
 * 실제로 받아 가야 할 숙제**다. 안건 이력보다 훨씬 자주 볼 것이 두 번째 칩에
 * 숨어 있으면 아무도 못 찾는다. 그래서 독립 탭으로 올렸다.
 *
 * 여기 나오는 항목은 **사람이 회의록을 읽고 뽑은 것**이다. 규칙으로 만들 수 없다 —
 * "검토해 보겠습니다" 같은 집행부의 답변과 위원의 요구를 글자로는 못 가른다.
 * 그래서 요약을 쓴 회차에서만 나온다.
 */
export const AsksTab: React.FC<Props> = ({ index, derived, asks, loading, onNavigate }) => {
  const [type, setType] = useState<string>('전체');
  const [dept, setDept] = useState('전체');
  const [member, setMember] = useState('전체');
  const [meetingId, setMeetingId] = useState('전체');
  const [q, setQ] = useState('');

  const all = useMemo(
    () => [...asks].sort((a, b) => b.date.localeCompare(a.date)),
    [asks],
  );

  const needle = q.trim();

  const preds = useMemo(() => ({
    type: (a: Ask) => type === '전체' || a.type === type,
    meeting: (a: Ask) => meetingId === '전체' || a.meeting === meetingId,
    dept: (a: Ask) => dept === '전체' || a.dept === dept,
    member: (a: Ask) => member === '전체' || a.member === member,
    q: (a: Ask) => !needle
      || looseTest(a.title, needle)
      || (a.body ?? []).some((b) => looseTest(b, needle))
      || looseTest(a.quote ?? '', needle)
      || (a.replies ?? []).some((r) => looseTest(r.text, needle)),
  }), [type, meetingId, dept, member, needle]);

  /**
   * 고르개들이 서로를 좁힌다.
   *
   * 예전에는 넷이 각자 놀았다. 회차를 골라도 부서 목록에는 그 회차에 나오지도 않는
   * 부서가 그대로 남아 있어서, 고르면 `0건` 이 떴다. **고를 수 있는데 아무것도 안
   * 나오는 선택지**는 쓰는 사람에게 "검색이 고장났다" 로 읽힌다.
   *
   * 그래서 각 고르개의 목록은 **자기를 뺀 나머지 조건**으로 좁힌 결과에서 만든다.
   * 자기까지 넣고 세면 고르는 순간 그 항목만 남아 다른 데로 옮겨 갈 수 없다.
   */
  const narrow = useCallback(
    (skip?: FilterKey) => all.filter((a) => KEYS.every((k) => k === skip || preds[k](a))),
    [all, preds],
  );

  const shown = useMemo(() => narrow(), [narrow]);
  const forType = useMemo(() => narrow('type'), [narrow]);
  const forMeeting = useMemo(() => narrow('meeting'), [narrow]);
  const forDept = useMemo(() => narrow('dept'), [narrow]);
  const forMember = useMemo(() => narrow('member'), [narrow]);

  const typeOptions = useMemo(
    () => TYPES.map((t) => {
      const count = t === '전체' ? forType.length : forType.filter((a) => a.type === t).length;
      return { value: t, label: t, count, disabled: count === 0 };
    }),
    [forType],
  );

  const perMeeting = useMemo(() => {
    const c = new Map<string, number>();
    forMeeting.forEach((a) => c.set(a.meeting, (c.get(a.meeting) ?? 0) + 1));
    return c;
  }, [forMeeting]);

  /**
   * 부서 고르개는 가나다순이 아니라 **본청 → 직속기관 → 교육지원청** 으로 묶는다.
   *
   * 가나다로 늘어놓으면 `과학교육원` 과 `교육국` 이 나란히 붙는다. 찾는 사람은
   * 자기가 본청인지 기관인지를 이미 알고 오기 때문에, 그 덩어리 안에서 고르는 편이
   * 훨씬 빠르다. 종류는 `derived.json` 이 알려 준다 — 이름으로 짐작하지 않는다.
   * 집계를 아직 못 받았으면 묶지 않고 예전처럼 한 줄로 늘어놓는다.
   */
  const deptGroups = useMemo(() => {
    const kindOf = new Map(derived.depts.map((d) => [d.name, d.kind]));
    const counts = new Map<string, number>();
    forDept.forEach((a) => { if (a.dept) counts.set(a.dept, (counts.get(a.dept) ?? 0) + 1); });
    // 고른 부서가 다른 조건 때문에 0건이 돼도 목록에서 빼지 않는다. 빠지면 고르개가
    // 빈칸이 되어 지금 무엇으로 좁혀져 있는지 알 수 없다.
    if (dept !== '전체' && !counts.has(dept)) counts.set(dept, 0);

    const byKind = new Map<string, { name: string; count: number }[]>();
    counts.forEach((count, name) => {
      const kind = kindOf.get(name) ?? (kindOf.size === 0 ? '' : '기타');
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind)!.push({ name, count });
    });

    return [...byKind.entries()]
      .sort((a, b) => kindRank(a[0]) - kindRank(b[0]) || a[0].localeCompare(b[0], 'ko'))
      .map(([kind, items]) => ({
        kind,
        items: items.sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ko')),
      }));
  }, [forDept, derived, dept]);

  const memberOptions = useMemo(() => {
    const counts = new Map<string, number>();
    forMember.forEach((a) => { if (a.member) counts.set(a.member, (counts.get(a.member) ?? 0) + 1); });
    if (member !== '전체' && !counts.has(member)) counts.set(member, 0);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ko'));
  }, [forMember, member]);

  const dirty = type !== '전체' || dept !== '전체' || member !== '전체'
    || meetingId !== '전체' || needle !== '';
  const reset = () => {
    setType('전체'); setDept('전체'); setMember('전체'); setMeetingId('전체'); setQ('');
  };

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-6 h-6" aria-hidden="true" />}
        title="아직 정리된 항목이 없습니다"
        desc="회의록 전문은 이미 볼 수 있습니다. 회차 요약을 쓰면 위원들의 자료요구와 지적사항이 여기 모입니다."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionTitle count={shown.length} desc={`전체 ${all.length}건`}>
        위원 지적 · 자료요구
      </SectionTitle>

      <p className="text-sm text-slate-600">
        위원이 자료를 달라거나, 잘못을 짚거나, 조치를 요구한 대목만 모았습니다.
        집행부의 <span className="text-slate-500">“검토해 보겠습니다”</span> 같은 답변은 넣지 않습니다.
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <ChipRow label="종류" value={type} onChange={setType} options={typeOptions} />
          {dirty && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border
                         border-slate-200 bg-white text-sm font-bold text-slate-600
                         hover:border-blue-600 hover:text-blue-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              조건 지우기
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <MeetingFilter index={index} value={meetingId} onChange={setMeetingId} counts={perMeeting} />

          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="부서로 좁히기"
            className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                       outline-none focus:border-blue-600"
          >
            <option value="전체">부서 전체 ({forDept.length})</option>
            {deptGroups.map((g) => {
              const opts = g.items.map((d) => (
                <option key={d.name} value={d.name}>{d.name} ({d.count})</option>
              ));
              return g.kind
                ? <optgroup key={g.kind} label={g.kind}>{opts}</optgroup>
                : <React.Fragment key="_">{opts}</React.Fragment>;
            })}
          </select>

          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            aria-label="위원으로 좁히기"
            className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                       outline-none focus:border-blue-600"
          >
            <option value="전체">위원 전체 ({forMember.length})</option>
            {memberOptions.map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({m.count})</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[12rem]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="내용에서 찾기"
              aria-label="내용에서 찾기"
              className="w-full h-11 pl-9 pr-3 rounded-md border border-slate-300 bg-white
                         outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" aria-hidden="true" />}
          title="해당하는 항목이 없습니다"
          desc="종류·회차·부서·위원을 바꿔 보세요."
        >
          {dirty && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-4 h-11 rounded-md border
                         border-slate-300 bg-white text-sm font-bold text-slate-700
                         hover:border-blue-600 hover:text-blue-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              조건 지우기
            </button>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((a, i) => (
            <li key={i} className="bg-white rounded-lg border border-slate-200 p-5">
              <AskItem ask={a} meetingTitle={titleOf(a.meeting)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
