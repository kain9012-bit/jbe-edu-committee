import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import type { DerivedDoc, Exchange, IndexDoc, Navigate } from '../types';
import { Badge, ChipRow, EmptyState, SectionTitle } from './Ui';
import { ExchangeItem } from './Exchange';
import { MeetingFilter } from './MeetingFilter';
import { kindRank } from '../lib/util';
import { deptStatsFor } from '../lib/stats';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  /** 오간 말 전문. 따로 받아 온다(805KB). */
  exchanges: Exchange[];
  loading: boolean;
  /** 지금 펼쳐 볼 항목. 주소에서 온다 — 그래야 링크로 그 화면을 줄 수 있다. */
  open: string | null;
  onNavigate: Navigate;
}

const KINDS = ['전체', '본청', '직속기관', '교육지원청'];

/**
 * "우리 과에 무엇이 나왔나" 를 보는 화면.
 *
 * 위원회에서는 국장이 과 대신 답하는 일이 많다. 그래서 답변한 사람의 소속만 보면
 * 정작 담당 과는 비어 있다. **답변한 것**과 **이름이 언급된 것**을 따로 세고,
 * 화면에서도 따로 보여준다. 섞으면 언급된 것을 답변한 것으로 오해한다.
 */
export const DeptTab: React.FC<Props> = ({ index, derived, exchanges, loading, open, onNavigate }) => {
  const [kind, setKind] = useState('전체');
  const [q, setQ] = useState('');
  const [meetingId, setMeetingId] = useState('전체');

  // 펼친 부서는 화면 안의 상태가 아니라 **주소**다. 그래야 그 화면을 링크로 준다.
  const toggle = (name: string) =>
    onNavigate('dept', { focus: open === name ? undefined : name });

  // 링크로 들어온 부서가 지금 필터에 가려져 있으면 필터를 푼다.
  useEffect(() => {
    if (open) { setKind('전체'); setQ(''); }
  }, [open]);

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  // 회차를 좁히면 목록·숫자·펼친 내용이 **한꺼번에** 그 회차 것만 남아야 한다.
  // 목록만 걸러 놓고 카드 숫자는 전체 합계로 두면 어느 쪽을 믿을지 알 수 없다.
  const ex = useMemo(
    () => (meetingId === '전체'
      ? exchanges
      : exchanges.filter((e) => e.meeting === meetingId)),
    [exchanges, meetingId],
  );

  const perMeeting = useMemo(() => {
    const c = new Map<string, number>();
    exchanges.forEach((e) => c.set(e.meeting, (c.get(e.meeting) ?? 0) + 1));
    return c;
  }, [exchanges]);

  const base = useMemo(
    () => (meetingId === '전체' ? derived.depts : deptStatsFor(derived.depts, ex)),
    [derived, ex, meetingId],
  );

  const depts = useMemo(() => {
    let list = base;
    if (kind !== '전체') list = list.filter((d) => d.kind === kind);
    const needle = q.trim();
    if (needle) list = list.filter((d) => d.name.includes(needle) || (d.bureau ?? '').includes(needle));
    return [...list].sort(
      (a, b) => kindRank(a.kind) - kindRank(b.kind)
        || b.answerCount - a.answerCount
        || b.mentionCount - a.mentionCount,
    );
  }, [base, kind, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: base.length };
    base.forEach((d) => { c[d.kind] = (c[d.kind] ?? 0) + 1; });
    return c;
  }, [base]);

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  if (derived.depts.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="w-6 h-6" aria-hidden="true" />}
        title="아직 정리된 회의록이 없습니다"
        desc="회의록이 올라오면 부서별 질의응답이 자동으로 채워집니다."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionTitle count={depts.length} unit="곳"
        desc={meetingId === '전체' ? '답변이 많은 순' : '고른 회차 기준'}>
        부서별 질의응답
      </SectionTitle>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
        <p>
          <strong className="font-bold text-slate-900">답변</strong> 은 그 부서 사람이 직접 답한 것,{' '}
          <strong className="font-bold text-slate-900">언급</strong> 은 질의나 답변 본문에 그 부서
          이름이 나온 것입니다.
        </p>
        <p className="text-slate-600">
          위원회에서는 국장이 과 대신 답하는 일이 많아, 답변한 사람만 따지면 담당 과가 비어
          보입니다. 그래서 두 갈래로 나눠 세되 섞지 않습니다.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
        <MeetingFilter index={index} value={meetingId} onChange={setMeetingId} counts={perMeeting} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <ChipRow
          label="기관 종류"
          value={kind}
          onChange={setKind}
          options={KINDS.map((k) => ({ value: k, label: k, count: counts[k] ?? 0 }))}
        />
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="부서 이름"
            aria-label="부서 이름으로 찾기"
            className="w-full h-11 pl-9 pr-3 rounded-md border border-slate-300 bg-white
                       outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {depts.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" aria-hidden="true" />}
          title="해당하는 부서가 없습니다"
          desc={meetingId === '전체' ? undefined : '고른 회차에서 답변한 부서가 없습니다. 회차를 바꿔 보세요.'}
        />
      ) : (
        <ul className="space-y-3">
          {depts.map((d) => {
            const on = open === d.name;
            const answered = on ? ex.filter((e) => e.dept === d.name) : [];
            const mentioned = on
              ? ex.filter((e) => e.dept !== d.name && e.mentions.includes(d.name))
              : [];
            // 국을 열면 소속 과가 답한 것도 함께 본다. 국장이 대신 답한 건과
            // 과가 직접 답한 건이 갈려 있어서, 국 단위로 봐야 전체가 보인다.
            const childNames = base
              .filter((x) => x.bureau === d.name)
              .map((x) => x.name);
            const children = on && childNames.length
              ? ex.filter((e) => childNames.includes(e.dept))
              : [];

            return (
              <li key={d.name} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => toggle(d.name)}
                  className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold text-slate-900">{d.name}</h4>
                    <Badge tone={d.kind === '본청' ? 'blue' : 'slate'}>{d.kind}</Badge>
                    {d.bureau && <span className="text-xs text-slate-500">{d.bureau} 소속</span>}
                  </div>
                  <p className="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      답변 <span className="font-bold tabular-nums text-blue-700">{d.answerCount}</span>건
                    </span>
                    {d.mentionCount > 0 && (
                      <span>
                        언급 <span className="font-bold tabular-nums text-slate-700">{d.mentionCount}</span>건
                      </span>
                    )}
                    <span className="text-slate-500">회의 {d.meetings.length}회</span>
                  </p>
                  {d.members.length > 0 && (
                    <p className="text-sm text-slate-500 mt-1">
                      질의한 위원 {d.members.map((m) => `${m.name}(${m.count})`).join(', ')}
                    </p>
                  )}
                  {d.answerCount === 0 && d.mentionCount > 0 && (
                    <p className="text-xs text-amber-700 mt-1.5">
                      이 과가 직접 답한 발언은 없습니다. 다른 사람의 발언에 이름이 나온 건만 있습니다.
                    </p>
                  )}
                </button>

                {on && (
                  <div className="border-t border-slate-200">
                    {answered.length > 0 && (
                      <section>
                        <h5 className="px-5 pt-4 pb-1 text-sm font-bold text-slate-900">
                          직접 답변 <span className="text-blue-700 tabular-nums">{answered.length}건</span>
                        </h5>
                        <div className="divide-y divide-slate-100">
                          {answered.map((e, i) => (
                            <ExchangeItem key={`a${i}`} ex={e} meetingTitle={titleOf(e.meeting)}
                              onNavigate={onNavigate} />
                          ))}
                        </div>
                      </section>
                    )}

                    {mentioned.length > 0 && (
                      <section className="border-t border-slate-200 bg-slate-50/60">
                        <h5 className="px-5 pt-4 pb-1 text-sm font-bold text-slate-900">
                          이름이 언급된 질의응답{' '}
                          <span className="text-slate-700 tabular-nums">{mentioned.length}건</span>
                          <span className="ml-2 font-medium text-xs text-slate-500">
                            다른 사람이 답했지만 이 과가 걸린 사안입니다
                          </span>
                        </h5>
                        <div className="divide-y divide-slate-100">
                          {mentioned.map((e, i) => (
                            <ExchangeItem key={`m${i}`} ex={e} meetingTitle={titleOf(e.meeting)}
                              onNavigate={onNavigate} viewingDept={d.name} />
                          ))}
                        </div>
                      </section>
                    )}

                    {children.length > 0 && (
                      <section className="border-t border-slate-200">
                        <h5 className="px-5 pt-4 pb-1 text-sm font-bold text-slate-900">
                          소속 과가 직접 답변{' '}
                          <span className="text-slate-700 tabular-nums">{children.length}건</span>
                          <span className="ml-2 font-medium text-xs text-slate-500">
                            {childNames.join(', ')}
                          </span>
                        </h5>
                        <div className="divide-y divide-slate-100">
                          {children.map((e, i) => (
                            <ExchangeItem key={`c${i}`} ex={e} meetingTitle={titleOf(e.meeting)}
                              onNavigate={onNavigate} />
                          ))}
                        </div>
                      </section>
                    )}

                    {answered.length + mentioned.length + children.length === 0 && (
                      <p className="p-5 text-sm text-slate-500">
                        표시할 질의응답이 없습니다. 회의록 전문에서 확인해 주세요.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
