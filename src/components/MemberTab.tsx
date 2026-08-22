import React, { useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import type { DerivedDoc, Exchange, IndexDoc, MeetingDoc, Navigate } from '../types';
import { EmptyState, SectionTitle } from './Ui';
import { AskItem } from './AskItem';
import { ExchangeItem } from './Exchange';
import { MeetingFilter } from './MeetingFilter';
import { memberStatsFor } from '../lib/stats';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  /** 오간 말 전문. 따로 받아 온다(805KB). */
  exchanges: Exchange[];
  /** 요약(사람이 쓴 것). 그 위원이 요구·지적한 것을 여기서 가져온다. */
  meetings: Record<string, MeetingDoc>;
  loading: boolean;
  /** 지금 펼쳐 볼 항목. 주소에서 온다 — 그래야 링크로 그 화면을 줄 수 있다. */
  open: string | null;
  onNavigate: Navigate;
}

/**
 * 위원 한 명이 무엇을 반복해서 묻는지 보는 화면.
 *
 * 답변한 기관과 함께, **그 위원이 요구·지적한 것**을 따로 모아 준다.
 * 부서 담당자에게 가장 실용적인 정보는 "이 위원이 우리 과에 무엇을 요구했나" 다.
 */
export const MemberTab: React.FC<Props> = ({
  index, derived, exchanges, meetings, loading, open, onNavigate,
}) => {
  const [meetingId, setMeetingId] = useState('전체');
  const narrowed = meetingId !== '전체';

  // 펼친 위원도 주소에 담는다. 링크를 받은 사람이 같은 화면을 본다.
  const toggle = (name: string) =>
    onNavigate('member', { focus: open === name ? undefined : name });

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  const ex = useMemo(
    () => (narrowed ? exchanges.filter((e) => e.meeting === meetingId) : exchanges),
    [exchanges, meetingId, narrowed],
  );

  const perMeeting = useMemo(() => {
    const c = new Map<string, number>();
    exchanges.forEach((e) => {
      if (e.member) c.set(e.meeting, (c.get(e.meeting) ?? 0) + 1);
    });
    return c;
  }, [exchanges]);

  const members = useMemo(
    () => (narrowed ? memberStatsFor(derived.members, ex) : derived.members),
    [derived, ex, narrowed],
  );

  /** 그 위원이 요구·지적한 것. 요약을 쓴 회차에서만 나온다. */
  const asksOf = (name: string) =>
    Object.values(meetings)
      .filter((m) => !narrowed || m.id === meetingId)
      .flatMap((m) => (m.asks ?? [])
        .filter((a) => a.member === name)
        .map((a) => ({ ...a, meeting: m.id })));

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  if (derived.members.length === 0) {
    return (
      <EmptyState
        icon={<UserRound className="w-6 h-6" aria-hidden="true" />}
        title="아직 정리된 회의록이 없습니다"
        desc="회의록이 올라오면 위원별 발언이 자동으로 채워집니다."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionTitle count={members.length} unit="명"
        desc={narrowed ? '고른 회차 기준' : '발언이 많은 순'}>
        위원별 질의
      </SectionTitle>

      <MeetingFilter index={index} value={meetingId} onChange={setMeetingId} counts={perMeeting} />

      <p className="text-sm text-slate-600">
        아래 부서 목록은 <strong className="font-bold text-slate-900">질의 바로 다음에 그 부서가
        답한 건</strong>만 셉니다. 답변이 여러 사람을 거친 경우는 세지 않습니다.
      </p>

      {members.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-6 h-6" aria-hidden="true" />}
          title="고른 회차에 질의한 위원이 없습니다"
          desc="회차를 바꿔 보세요."
        />
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const on = open === m.name;
            const mine = on ? ex.filter((e) => e.member === m.name) : [];
            const asks = on ? asksOf(m.name) : [];
            return (
              <li key={m.name} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => toggle(m.name)}
                  className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <h4 className="text-lg font-bold text-slate-900">{m.name} 위원</h4>
                    <span className="text-sm text-slate-500">
                      {narrowed ? '질의응답' : '발언'}{' '}
                      <span className="font-bold tabular-nums text-blue-700">{m.turnCount}</span>건 ·
                      {' '}회의 {m.meetings.length}회
                    </span>
                  </div>
                  {m.depts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.depts.slice(0, 8).map((d) => (
                        <span
                          key={d.name}
                          className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                        >
                          {d.name} <span className="tabular-nums text-slate-400">{d.count}</span>
                        </span>
                      ))}
                      {m.depts.length > 8 && (
                        <span className="text-xs text-slate-400">외 {m.depts.length - 8}곳</span>
                      )}
                    </div>
                  )}
                </button>

                {on && (
                  <div className="border-t border-slate-200">
                    {asks.length > 0 && (
                      <section className="bg-amber-50/40 border-b border-slate-200">
                        <h5 className="px-5 pt-4 pb-1 text-sm font-bold text-slate-900">
                          이 위원이 요구·지적한 것{' '}
                          <span className="text-blue-700 tabular-nums">{asks.length}건</span>
                        </h5>
                        <ul className="px-5 pb-4 pt-2 space-y-4">
                          {asks.map((a, k) => (
                            <li key={k}>
                              <AskItem ask={a} meetingTitle={titleOf(a.meeting)}
                                onNavigate={onNavigate} hideMember />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="divide-y divide-slate-100">
                      {mine.length === 0 && (
                        <p className="p-5 text-sm text-slate-500">
                          집행부 답변과 짝지어진 질의가 없습니다. 회의 진행 발언만 있는 경우입니다.
                        </p>
                      )}
                      {mine.map((e, i) => (
                        <ExchangeItem key={i} ex={e} meetingTitle={titleOf(e.meeting)}
                          onNavigate={onNavigate} />
                      ))}
                    </div>
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
