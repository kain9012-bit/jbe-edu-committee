import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import type { DerivedDoc, IndexDoc, Navigate } from '../types';
import { Badge, ChipRow, EmptyState, SectionTitle } from './Ui';
import { korDate, kindRank } from '../lib/util';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  loading: boolean;
  focus: string | null;
  onFocused: () => void;
  onNavigate: Navigate;
}

const KINDS = ['전체', '본청', '직속기관', '교육지원청'];

/**
 * "우리 과에 무엇이 나왔나" 를 보는 화면.
 *
 * 회의록에 발언자 소속이 태그로 붙어 있어서, 집행부 답변 바로 앞의 의원 발언을
 * 질의로 보고 짝지었다. 요약을 쓰기 전에도 이 탭은 채워진다.
 */
export const DeptTab: React.FC<Props> = ({ index, derived, loading, focus, onFocused, onNavigate }) => {
  const [kind, setKind] = useState('전체');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    setOpen(focus);
    setKind('전체');
    setQ('');
    onFocused();
  }, [focus, onFocused]);

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  const depts = useMemo(() => {
    let list = derived.depts;
    if (kind !== '전체') list = list.filter((d) => d.kind === kind);
    const needle = q.trim();
    if (needle) list = list.filter((d) => d.name.includes(needle));
    return [...list].sort(
      (a, b) => kindRank(a.kind) - kindRank(b.kind) || b.turnCount - a.turnCount,
    );
  }, [derived, kind, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: derived.depts.length };
    derived.depts.forEach((d) => { c[d.kind] = (c[d.kind] ?? 0) + 1; });
    return c;
  }, [derived]);

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  if (derived.depts.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="w-6 h-6" aria-hidden="true" />}
        title="아직 정리된 회의록이 없습니다"
        desc="속기록이 발간되면 부서별 질의응답이 자동으로 채워집니다."
      />
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionTitle count={derived.depts.length} unit="곳"
        desc="집행부 답변 발언 기준. 답변 앞의 의원 발언을 질의로 봅니다">
        부서별 질의응답
      </SectionTitle>

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
        />
      ) : (
        <ul className="space-y-3">
          {depts.map((d) => {
            const on = open === d.name;
            const ex = on
              ? derived.exchanges.filter((e) => e.dept === d.name)
              : [];
            return (
              <li key={d.name} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(on ? null : d.name)}
                  className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold text-slate-900">{d.name}</h4>
                    <Badge tone={d.kind === '본청' ? 'blue' : 'slate'}>{d.kind}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">
                    답변 <span className="font-bold tabular-nums text-blue-700">{d.turnCount}</span>건 ·
                    {' '}회의 {d.meetings.length}회
                    {d.members.length > 0 && (
                      <> · 질의한 위원 {d.members.map((m) => `${m.name}(${m.count})`).join(', ')}</>
                    )}
                  </p>
                </button>

                {on && (
                  <div className="border-t border-slate-200 divide-y divide-slate-100">
                    {ex.length === 0 && (
                      <p className="p-5 text-sm text-slate-500">
                        질의와 짝지어진 답변이 없습니다. 회의록 전문에서 확인해 주세요.
                      </p>
                    )}
                    {ex.map((e, i) => (
                      <article key={i} className="p-5 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-500">{korDate(e.date)}</span>
                          <button
                            type="button"
                            onClick={() => onNavigate('record', { meetingId: e.meeting, turn: e.answerTurn })}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {titleOf(e.meeting)}
                          </button>
                          {e.agenda && (
                            <span className="text-slate-400 truncate max-w-full sm:max-w-lg">{e.agenda}</span>
                          )}
                        </div>
                        {e.question && (
                          <div>
                            <p className="text-xs font-bold text-slate-500 mb-0.5">
                              질의 · {e.member} 위원
                            </p>
                            <p className="text-slate-700 leading-relaxed">{e.question}</p>
                          </div>
                        )}
                        <div className="pl-3 border-l-[3px] border-blue-200">
                          <p className="text-xs font-bold text-slate-500 mb-0.5">답변 · {e.answerer}</p>
                          <p className="text-slate-700 leading-relaxed">{e.answer}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        질의는 집행부 답변 바로 앞의 의원 발언입니다. 회의 진행 발언(개의·상정·산회)은
        질의로 세지 않습니다. 정확한 앞뒤 맥락은 회의록 전문에서 확인하세요.
      </p>
    </div>
  );
};
