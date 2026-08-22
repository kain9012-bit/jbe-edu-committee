import React, { useMemo, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import type { Ask, IndexDoc, Navigate } from '../types';
import { ChipRow, EmptyState, SectionTitle } from './Ui';
import { AskItem } from './AskItem';
import { MeetingFilter } from './MeetingFilter';
import { groupRank, looseTest } from '../lib/util';

interface Props {
  index: IndexDoc;
  asks: Ask[];
  loading: boolean;
  onNavigate: Navigate;
}

const TYPES = ['전체', '자료요구', '지적사항', '요청'] as const;

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
export const AsksTab: React.FC<Props> = ({ index, asks, loading, onNavigate }) => {
  const [type, setType] = useState<string>('전체');
  const [dept, setDept] = useState('전체');
  const [member, setMember] = useState('전체');
  const [meetingId, setMeetingId] = useState('전체');
  const [q, setQ] = useState('');

  const all = useMemo(
    () => [...asks].sort((a, b) => b.date.localeCompare(a.date)),
    [asks],
  );

  /*
   * 부서 필터는 **국 단위**로 묶는다.
   *
   * 과 단위로 늘어놓으면 `문예체건강과 (1)`, `미래교육과 (1)` 처럼 한 건짜리가
   * 국들 사이에 끼어 스무 개가 넘는 목록이 된다. 위원회 질의는 대개 국장이
   * 받으므로 과까지 내려가는 일 자체가 드물다. 그래서 국을 먼저 세우고,
   * 그 아래 실제로 나온 과를 붙여 둔다.
   */
  const groups = useMemo(() => {
    const m = new Map<string, { total: number; depts: Map<string, number> }>();
    all.forEach((a) => {
      const g = a.group ?? a.dept;
      if (!g) return;
      const slot = m.get(g) ?? { total: 0, depts: new Map<string, number>() };
      slot.total += 1;
      if (a.dept) slot.depts.set(a.dept, (slot.depts.get(a.dept) ?? 0) + 1);
      m.set(g, slot);
    });
    return [...m.entries()]
      .sort((x, y) => groupRank(x[0]) - groupRank(y[0]) || y[1].total - x[1].total)
      .map(([name, v]) => ({
        name,
        total: v.total,
        depts: [...v.depts.entries()]
          .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'ko'))
          .map(([n, c]) => ({ name: n, count: c })),
      }));
  }, [all]);
  const membersList = useMemo(
    () => [...new Set(all.map((a) => a.member).filter(Boolean) as string[])]
      .sort((x, y) => x.localeCompare(y, 'ko')),
    [all],
  );
  const perMeeting = useMemo(() => {
    const c = new Map<string, number>();
    all.forEach((a) => c.set(a.meeting, (c.get(a.meeting) ?? 0) + 1));
    return c;
  }, [all]);

  const shown = useMemo(() => {
    let list = all;
    if (type !== '전체') list = list.filter((a) => a.type === type);
    // `국:행정국` 이면 그 국 전체, `과:행정과` 면 그 과만.
    if (dept.startsWith('국:')) {
      const g = dept.slice(2);
      list = list.filter((a) => (a.group ?? a.dept) === g);
    } else if (dept.startsWith('과:')) {
      const d = dept.slice(2);
      list = list.filter((a) => a.dept === d);
    }
    if (member !== '전체') list = list.filter((a) => a.member === member);
    if (meetingId !== '전체') list = list.filter((a) => a.meeting === meetingId);
    const needle = q.trim();
    if (needle) {
      list = list.filter((a) =>
        looseTest(a.title, needle)
        || (a.body ?? []).some((b) => looseTest(b, needle))
        || looseTest(a.quote ?? '', needle)
        || (a.replies ?? []).some((r) => looseTest(r.text, needle)));
    }
    return list;
  }, [all, type, dept, member, meetingId, q]);

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
        <ChipRow
          label="종류"
          value={type}
          onChange={setType}
          options={TYPES.map((t) => ({
            value: t,
            label: t,
            count: t === '전체' ? all.length : all.filter((a) => a.type === t).length,
          }))}
        />

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <MeetingFilter index={index} value={meetingId} onChange={setMeetingId} counts={perMeeting} />

          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="부서로 좁히기"
            className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                       outline-none focus:border-blue-600"
          >
            <option value="전체">부서 전체 ({all.length})</option>
            {groups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                <option value={`국:${g.name}`}>{g.name} 전체 ({g.total})</option>
                {g.depts.length > 1 && g.depts.map((d) => (
                  <option key={d.name} value={`과:${d.name}`}>
                    &nbsp;&nbsp;{d.name} ({d.count})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            aria-label="위원으로 좁히기"
            className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                       outline-none focus:border-blue-600"
          >
            <option value="전체">위원 전체</option>
            {membersList.map((m) => (
              <option key={m} value={m}>{m} ({all.filter((a) => a.member === m).length})</option>
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
        />
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
