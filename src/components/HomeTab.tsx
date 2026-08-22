import React, { useState } from 'react';
import {
  Search, ArrowRight, FileText, MessageSquareQuote, Building2, Gavel, Clock,
} from 'lucide-react';
import type { DerivedDoc, IndexDoc, Navigate } from '../types';
import { Badge, SectionTitle } from './Ui';
import { korDate, stageOf, STAGE_LABEL, STAGE_TONE } from '../lib/util';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  onNavigate: Navigate;
}

export const HomeTab: React.FC<Props> = ({ index, derived, onNavigate }) => {
  const [q, setQ] = useState('');
  const meetings = index.meetings;
  const withRecord = meetings.filter((m) => m.hasRecord);
  const waiting = meetings.filter((m) => !m.hasRecord && m.source !== 'asr');
  // 답변이 없어도 언급이 많은 과가 있다(총무과 23건). 둘을 합쳐 고른다 —
  // 담당자가 홈에서 자기 과를 못 찾으면 그 다음은 없다.
  const bocheong = derived.depts
    .filter((d) => d.kind === '본청')
    .sort((a, b) => (b.answerCount + b.mentionCount) - (a.answerCount + a.mentionCount))
    .slice(0, 8);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('search', { query: q.trim() });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ── 검색 띠 ── */}
      <section
        className="relative left-1/2 w-screen -translate-x-1/2 -mt-6
                   px-4 sm:px-6 lg:px-8 py-10 sm:py-16
                   bg-blue-50 border-b border-blue-100"
      >
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-[2.75rem] font-bold text-slate-900 leading-tight">
            <span className="block sm:inline">교육위원회에서</span>{' '}
            <span className="text-blue-700">우리 과에 무엇을 물었나</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            전북특별자치도의회 교육위원회 회의록을{' '}
            <strong className="font-bold text-slate-900">부서별</strong> ·
            <strong className="font-bold text-slate-900"> 의원별</strong> ·
            <strong className="font-bold text-slate-900"> 안건별</strong>로 갈라 봅니다
          </p>

          <form onSubmit={submit} className="max-w-2xl mx-auto">
            <label htmlFor="heroSearch" className="sr-only">회의록 검색</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-6 h-6 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="heroSearch"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="예: 늘봄, 교육장 공모, 학교 신설 — 띄어쓰기는 무시합니다"
                  className="w-full h-16 pl-12 pr-4 text-lg text-slate-900 placeholder-slate-400
                             bg-white border-2 border-blue-600 rounded-lg outline-none focus:border-blue-700"
                />
              </div>
              <button
                type="submit"
                className="h-16 px-5 sm:px-10 bg-blue-600 hover:bg-blue-700 text-white font-bold
                           text-lg rounded-lg transition-colors flex items-center gap-2 shrink-0"
              >
                <span>검색</span>
                <ArrowRight className="w-4 h-4 hidden sm:block" aria-hidden="true" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* 추천 검색어는 회의록에서 세어 만든다. 그럴듯해 보인다고 손으로 적으면
                결과가 0건인 칩이 첫 화면에 뜬다. 실제로 `#급식` 이 그랬다. */}
            {derived.topics.map((t) => (
              <button
                key={t.word}
                type="button"
                onClick={() => onNavigate('search', { query: t.word })}
                className="px-3 py-1.5 rounded-full bg-white border border-blue-200 text-sm
                           font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                #{t.word}
                <span className="ml-1 text-xs font-medium text-blue-400 tabular-nums">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 지표 ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: FileText, label: '회의', value: `${meetings.length}건`,
            sub: `회의록 있음 ${withRecord.length}건${waiting.length ? ` · 대기 ${waiting.length}건` : ''}`,
          },
          {
            icon: MessageSquareQuote, label: '질의응답',
            value: `${derived.exchanges.length.toLocaleString()}건`,
            sub: '집행부 답변마다 앞선 질의를 붙였습니다',
          },
          {
            icon: Building2, label: '답변한 기관', value: `${derived.depts.length}곳`,
            sub: `본청 ${derived.depts.filter((d) => d.kind === '본청').length} · 직속기관·지원청 ${
              derived.depts.filter((d) => d.kind === '직속기관' || d.kind === '교육지원청').length}`,
          },
          {
            icon: Gavel, label: '심사 안건', value: `${derived.agendas.length}건`,
            sub: `위원 ${derived.members.length}명 발언`,
          },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </section>

      {/* ── 부서 바로가기 ── */}
      {bocheong.length > 0 && (
        <section className="space-y-3">
          <SectionTitle desc="직접 답변 + 이름이 언급된 건을 합친 순">우리 과 찾기</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {bocheong.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => onNavigate('dept', { focus: d.name })}
                className="bg-white rounded-lg border border-slate-200 p-4 text-left
                           hover:border-blue-600 transition-colors space-y-1"
              >
                <p className="font-bold text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500">
                  답변 <span className="tabular-nums font-bold text-blue-700">{d.answerCount}</span>건
                  {d.mentionCount > 0 && <> · 언급 {d.mentionCount}건</>}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── 회의 목록 ── */}
      <section className="space-y-3">
        <SectionTitle count={meetings.length} desc="최근 회의부터">회의 목록</SectionTitle>
        <ul className="space-y-3">
          {meetings.map((m) => {
            const st = stageOf(m);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(m.hasSummary ? 'meeting' : 'record', { meetingId: m.id })
                  }
                  className="w-full text-left bg-white rounded-lg border border-slate-200 p-5
                             hover:border-blue-600 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge tone={STAGE_TONE[st]}>{STAGE_LABEL[st]}</Badge>
                    {m.kind === 'K' && <Badge tone="red">행정사무감사</Badge>}
                    <span className="text-sm text-slate-500">{korDate(m.date)}</span>
                  </div>
                  <p className="font-bold text-slate-900 text-lg">{m.title}</p>
                  {m.hasRecord ? (
                    <p className="text-sm text-slate-600 mt-1">
                      발언 <span className="tabular-nums font-bold">{m.turnCount}</span>건 ·
                      {' '}안건 {m.agendaCount}건 ·
                      {' '}위원 {m.members.length}명
                      {m.depts.length > 0 && <> · 답변 기관 {m.depts.length}곳</>}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      회의록이 아직 올라오지 않았습니다. 영상은 아래에서 볼 수 있습니다.
                    </p>
                  )}
                  {m.depts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {m.depts.slice(0, 6).map((d) => (
                        <span key={d} className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                          {d}
                        </span>
                      ))}
                      {m.depts.length > 6 && (
                        <span className="text-xs text-slate-400">외 {m.depts.length - 6}곳</span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
