import React, { useState } from 'react';
import {
  Search, ArrowRight, FileText, MessageSquareQuote, Building2, Gavel, Clock,
  CircleCheck, CircleAlert,
} from 'lucide-react';
import type { Ask, DerivedDoc, IndexDoc, IndexEntry, MeetingDoc, Navigate } from '../types';
import { Badge, SectionTitle } from './Ui';
import { korDate, stageOf, STAGE_LABEL, STAGE_TONE } from '../lib/util';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  /** 집행부가 받아 가야 할 것. 이 화면의 주인공이다. */
  asks: Ask[];
  /** 요약을 쓴 가장 최근 회차 */
  latest: IndexEntry | null;
  latestDoc: MeetingDoc | null;
  onNavigate: Navigate;
}

const TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

/**
 * 홈.
 *
 * 예전 홈은 **숫자 넷과 단추 여덟**이 전부였다. 들어와서 글 한 줄을 읽으려면
 * 두 번을 눌러야 했고, 그래서 "정보는 많은데 볼 게 없다" 는 화면이 됐다.
 *
 * 순서를 바꿨다. 읽을 것을 먼저 놓고, 세어 놓은 숫자는 맨 아래로 내린다.
 *
 *   1) 가장 최근 회의에서 무엇이 있었나  — 한눈에 보기 본문 그대로
 *   2) 집행부가 받아 가야 할 것          — 이 서비스에 오는 이유
 *   3) 우리 과 찾기
 *   4) 회의 목록                        — 카드 여섯 장이 아니라 표 한 장
 *   5) 숫자
 */
export const HomeTab: React.FC<Props> = ({
  index, derived, asks, latest, latestDoc, onNavigate,
}) => {
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

  const recentAsks = [...asks]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

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
            도의회 교육위원회 회의의 <strong className="font-bold text-slate-900">회의록 전문</strong> ·
            <strong className="font-bold text-slate-900"> 자료요구·지적사항</strong> ·
            <strong className="font-bold text-slate-900"> 부서별 질의응답</strong>을 한곳에서 찾습니다
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
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 가장 최근 회의 — 목차가 아니라 내용을 먼저 보인다 ── */}
      {latest && (
        <section className="space-y-3">
          <SectionTitle desc={korDate(latest.date)}>가장 최근 회의</SectionTitle>
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {latest.kind === 'K' && <Badge tone="red">행정사무감사</Badge>}
              <Badge tone="slate">안건 {latest.agendaCount}건</Badge>
              <Badge tone="slate">발언 {latest.turnCount}건</Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{latest.title}</h3>

            {latestDoc?.glance?.length ? (
              <ul className="space-y-1.5">
                {latestDoc.glance.slice(0, 5).map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-slate-800 leading-relaxed">
                    <span aria-hidden="true" className="text-blue-500 shrink-0 mt-[0.45rem]">
                      <span className="block w-1.5 h-1.5 rounded-full bg-current" />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : latestDoc?.summary ? (
              <p className="text-slate-800 leading-relaxed">{latestDoc.summary}</p>
            ) : (
              <p className="text-sm text-slate-500">요약을 불러오는 중입니다…</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('meeting', { meetingId: latest.id })}
                className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
              >
                회의 요약 보기
              </button>
              <button
                type="button"
                onClick={() => onNavigate('record', { meetingId: latest.id })}
                className="px-4 py-2 rounded-md border border-slate-300 hover:border-blue-600
                           hover:text-blue-700 text-slate-700 text-sm font-bold"
              >
                회의록 전문 보기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 받아 가야 할 것 — 이 서비스에 오는 이유 ── */}
      {recentAsks.length > 0 && (
        <section className="space-y-3">
          <SectionTitle count={asks.length} desc="위원이 자료를 달라거나 조치를 요구한 것">
            집행부가 받아 가야 할 것
          </SectionTitle>
          <ul className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {recentAsks.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onNavigate('asks')}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[a.type] ?? 'slate'}>{a.type}</Badge>
                    {a.dept && <span className="text-sm font-bold text-blue-700">{a.dept}</span>}
                    {a.member && <span className="text-sm text-slate-500">{a.member} 위원</span>}
                    <span className="text-xs text-slate-400 ml-auto">{korDate(a.date)}</span>
                  </div>
                  <p className="font-bold text-slate-900 leading-snug">{a.title}</p>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('asks')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
          >
            전체 {asks.length}건 보기
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </section>
      )}

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

      {/*
        회의 목록 — 카드 여섯 장이었다. 배지·날짜·발언수·부서칩까지 붙어서
        여섯 회차를 훑는 데 스크롤이 세 번 필요했다. 표로 바꾸면 한 화면이다.
      */}
      <section className="space-y-3">
        <SectionTitle count={meetings.length} desc="최근 회의부터">회의 목록</SectionTitle>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-bold px-4 py-3 whitespace-nowrap">일자</th>
                  <th className="text-left font-bold px-4 py-3">회의</th>
                  <th className="text-right font-bold px-4 py-3 whitespace-nowrap">발언</th>
                  <th className="text-right font-bold px-4 py-3 whitespace-nowrap">안건</th>
                  <th className="text-left font-bold px-4 py-3 whitespace-nowrap">상태</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const st = stageOf(m);
                  return (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{korDate(m.date)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(m.hasSummary ? 'meeting' : 'record', { meetingId: m.id })
                          }
                          className="font-semibold text-slate-800 hover:text-blue-700 text-left"
                        >
                          {m.title}
                        </button>
                        {m.kind === 'K' && (
                          <span className="ml-2 align-middle"><Badge tone="red">행감</Badge></span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        {m.hasRecord ? m.turnCount : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        {m.hasRecord ? m.agendaCount : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {m.hasSummary
                            ? <CircleCheck className="w-4 h-4 text-green-600" aria-hidden="true" />
                            : m.hasRecord
                              ? <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
                              : <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />}
                          <span className={`font-semibold ${
                            STAGE_TONE[st] === 'amber' ? 'text-amber-700' : 'text-slate-700'
                          }`}>
                            {STAGE_LABEL[st]}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {waiting.length > 0 && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CircleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            회의록 대기 {waiting.length}건 — 도의회 회의록은 회의 후 보통 3~4주 걸립니다.
          </p>
        )}
      </section>

      {/* ── 숫자는 맨 아래. 이걸 보러 오는 사람은 없다. ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: FileText, label: '회의', value: `${meetings.length}건`,
            sub: `회의록 있음 ${withRecord.length}건${waiting.length ? ` · 대기 ${waiting.length}건` : ''}`,
          },
          {
            icon: MessageSquareQuote, label: '질의응답',
            value: `${derived.dialogCount.toLocaleString()}건`,
            sub: '한 위원이 한 부서와 주고받은 것을 하나로 묶었습니다',
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
    </div>
  );
};
