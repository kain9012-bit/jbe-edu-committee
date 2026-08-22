import React from 'react';
import { UserRound } from 'lucide-react';
import type { DerivedDoc, IndexDoc, Navigate } from '../types';
import { EmptyState, SectionTitle } from './Ui';
import { ExchangeItem } from './Exchange';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  loading: boolean;
  /** 지금 펼쳐 볼 항목. 주소에서 온다 — 그래야 링크로 그 화면을 줄 수 있다. */
  open: string | null;
  onNavigate: Navigate;
}

/**
 * 위원 한 명이 무엇을 반복해서 묻는지 보는 화면.
 *
 * 답변한 기관을 함께 보여준다. "이 위원이 우리 과에 몇 번 물었나" 가
 * 부서 담당자에게는 가장 실용적인 정보다.
 */
export const MemberTab: React.FC<Props> = ({ index, derived, loading, open, onNavigate }) => {
  // 펼친 위원도 주소에 담는다. 링크를 받은 사람이 같은 화면을 본다.
  const toggle = (name: string) =>
    onNavigate('member', { focus: open === name ? undefined : name });

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  if (derived.members.length === 0) {
    return (
      <EmptyState
        icon={<UserRound className="w-6 h-6" aria-hidden="true" />}
        title="아직 정리된 회의록이 없습니다"
        desc="속기록이 발간되면 위원별 발언이 자동으로 채워집니다."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionTitle count={derived.members.length} unit="명" desc="발언이 많은 순">
        위원별 질의
      </SectionTitle>

      <p className="text-sm text-slate-600">
        아래 부서 목록은 <strong className="font-bold text-slate-900">질의 바로 다음에 그 부서가
        답한 건</strong>만 셉니다. 답변이 여러 사람을 거친 경우는 세지 않습니다.
      </p>

      <ul className="space-y-3">
        {derived.members.map((m) => {
          const on = open === m.name;
          const ex = on ? derived.exchanges.filter((e) => e.member === m.name) : [];
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
                    발언 <span className="font-bold tabular-nums text-blue-700">{m.turnCount}</span>건 ·
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
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                  {ex.length === 0 && (
                    <p className="p-5 text-sm text-slate-500">
                      집행부 답변과 짝지어진 질의가 없습니다. 회의 진행 발언만 있는 경우입니다.
                    </p>
                  )}
                  {ex.map((e, i) => (
                    <ExchangeItem key={i} ex={e} meetingTitle={titleOf(e.meeting)}
                      onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
