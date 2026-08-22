import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileSearch } from 'lucide-react';
import type { IndexDoc, MeetingDoc, Navigate, RecordDoc } from '../types';
import { Badge, ChipRow, EmptyState, SectionTitle } from './Ui';
import { highlight, korDate, looseTest } from '../lib/util';

interface Props {
  index: IndexDoc;
  records: Record<string, RecordDoc>;
  meetings: Record<string, MeetingDoc>;
  initialQuery: string;
  onConsumeInitialQuery: () => void;
  onNavigate: Navigate;
  loading: boolean;
}

interface Hit {
  meeting: string;
  date: string;
  turn: number;
  speaker: string;
  dept: string | null;
  role: string;
  agenda: string;
  text: string;
}

const ROLES = ['전체', '의원', '집행부'];

export const SearchTab: React.FC<Props> = ({
  index, records, meetings, initialQuery, onConsumeInitialQuery, onNavigate, loading,
}) => {
  const [q, setQ] = useState(initialQuery);
  const [role, setRole] = useState('전체');
  const [meetingFilter, setMeetingFilter] = useState('전체');

  useEffect(() => {
    if (initialQuery) {
      setQ(initialQuery);
      onConsumeInitialQuery();
    }
  }, [initialQuery, onConsumeInitialQuery]);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim();
    if (needle.length < 2) return [];
    const out: Hit[] = [];
    Object.values(records).forEach((doc) => {
      doc.turns.forEach((t) => {
        const text = t.lines.find((l) => looseTest(l, needle));
        if (!text) return;
        out.push({
          meeting: doc.id, date: doc.date, turn: t.i,
          speaker: t.speaker, dept: t.dept, role: t.role,
          agenda: t.agendaTitle, text,
        });
      });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.turn - b.turn);
  }, [records, q]);

  const filtered = useMemo(() => {
    let list = hits;
    if (role !== '전체') list = list.filter((h) => h.role === role);
    if (meetingFilter !== '전체') list = list.filter((h) => h.meeting === meetingFilter);
    return list;
  }, [hits, role, meetingFilter]);

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;

  const summaryHits = useMemo(() => {
    const needle = q.trim();
    if (needle.length < 2) return [];
    return Object.values(meetings).flatMap((m) =>
      [
        ...(looseTest(m.summary ?? '', needle) ? [{ id: m.id, kind: '요약', text: m.summary }] : []),
        ...(m.highlights ?? [])
          .filter((h) => looseTest(h.title, needle) || looseTest(h.body, needle))
          .map((h) => ({ id: m.id, kind: '주요 질의응답', text: `${h.title} — ${h.body}` })),
        ...(m.asks ?? [])
          .filter((a) => looseTest(a.text, needle))
          .map((a) => ({ id: m.id, kind: a.type, text: a.text })),
      ],
    );
  }, [meetings, q]);

  const perMeeting = useMemo(() => {
    const c = new Map<string, number>();
    hits.forEach((h) => c.set(h.meeting, (c.get(h.meeting) ?? 0) + 1));
    return c;
  }, [hits]);

  return (
    <div className="space-y-5 pb-12">
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">회의록 통합검색</label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="회의록 전문에서 찾습니다 — 두 글자 이상, 띄어쓰기는 무시합니다"
          className="w-full h-14 pl-12 pr-4 text-lg bg-white border-2 border-slate-300 rounded-lg
                     outline-none focus:border-blue-600"
        />
      </div>

      {loading && <p role="status" className="text-sm text-slate-500">회의록을 불러오는 중입니다…</p>}

      {!loading && q.trim().length < 2 && (
        <EmptyState
          icon={<FileSearch className="w-6 h-6" aria-hidden="true" />}
          title="찾을 말을 넣어 주세요"
          desc="발언 전문에서 찾습니다. 띄어쓰기는 무시하므로 '학교폭력'과 '학교 폭력'이 같은 결과를 냅니다."
        />
      )}

      {!loading && q.trim().length >= 2 && (
        <>
          {summaryHits.length > 0 && (
            <section className="space-y-2">
              <SectionTitle count={summaryHits.length}>요약에서</SectionTitle>
              <ul className="space-y-2">
                {summaryHits.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onNavigate('meeting', { meetingId: s.id })}
                      className="w-full text-left bg-white rounded-lg border border-slate-200 p-4
                                 hover:border-blue-600 transition-colors space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="blue">{s.kind}</Badge>
                        <span className="text-sm text-slate-500">{titleOf(s.id)}</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{highlight(s.text, q)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <ChipRow label="발언자" value={role} onChange={setRole}
              options={ROLES.map((r) => ({
                value: r, label: r,
                count: r === '전체' ? hits.length : hits.filter((h) => h.role === r).length,
              }))} />
            <select
              value={meetingFilter}
              onChange={(e) => setMeetingFilter(e.target.value)}
              aria-label="회차로 좁히기"
              className="sm:ml-auto h-11 px-3 rounded-md border border-slate-300 bg-white
                         font-medium outline-none focus:border-blue-600"
            >
              <option value="전체">회차 전체 ({hits.length})</option>
              {index.meetings
                .filter((m) => perMeeting.has(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({perMeeting.get(m.id)})
                  </option>
                ))}
            </select>
          </div>

          <SectionTitle count={filtered.length} desc="회의록 전문에서">발언</SectionTitle>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileSearch className="w-6 h-6" aria-hidden="true" />}
              title="찾는 말이 없습니다"
              desc="회의록이 확보된 회차 안에서만 찾습니다. 회의록이 아직 안 나온 회의는 검색되지 않습니다."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.slice(0, 300).map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onNavigate('record', { meetingId: h.meeting, turn: h.turn })}
                    className="w-full text-left bg-white rounded-lg border border-slate-200 p-4
                               hover:border-blue-600 transition-colors space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900">{h.speaker}</span>
                      {h.dept && <Badge tone="slate">{h.dept}</Badge>}
                      <span className="text-slate-500">{korDate(h.date)}</span>
                      <span className="text-slate-400 truncate max-w-full sm:max-w-md">
                        {titleOf(h.meeting)}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{highlight(h.text, q)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {filtered.length > 300 && (
            <p className="text-sm text-slate-500">
              {filtered.length}건 중 300건만 보여줍니다. 검색어를 좁혀 주세요.
            </p>
          )}
        </>
      )}
    </div>
  );
};
