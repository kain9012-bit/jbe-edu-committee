import React, { useMemo, useState } from 'react';
import { Gavel, ClipboardList } from 'lucide-react';
import type { DerivedDoc, IndexDoc, MeetingDoc, Navigate } from '../types';
import { Badge, ChipRow, EmptyState, Quote, SectionTitle } from './Ui';
import { korDate } from '../lib/util';

interface Props {
  index: IndexDoc;
  derived: DerivedDoc;
  meetings: Record<string, MeetingDoc>;
  loading: boolean;
  onNavigate: Navigate;
}

/**
 * 안건 하나가 여러 차수에 걸쳐 심사되는 일이 흔하다.
 * 실제로 정원 조례 일부개정조례안은 2차·4차에서 보류된 뒤 5차에서 가결됐다.
 * 회차별로만 보면 이 흐름이 안 보이므로 **제목으로 묶어 이력을 세운다.**
 *
 * 묶는 기준은 발의자 표기와 `(계속)` 을 떼어낸 제목이다. 비슷해 보인다고
 * 묶지 않는다 — 글자가 같을 때만 같은 안건으로 본다.
 */
function normalize(title: string): string {
  return title
    .replace(/^\s*\d+\.\s*/, '')
    // 제안자 표기는 회차마다 꼴이 다르다. 같은 조례안인데
    // 2차는 `(전북특별자치도교육감)`, 4차·5차는 `(전북특별자치도교육감 제출)(계속)` 이었다.
    // 이걸 안 떼면 같은 안건이 두 개로 갈라져 이력이 끊긴다.
    .replace(/\([^)]*(?:발의|제출|교육감|의원|계속)[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ASK_TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

export const AgendaTab: React.FC<Props> = ({ index, derived, meetings, loading, onNavigate }) => {
  const [view, setView] = useState('안건');

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: { meeting: string; date: string; raw: string }[] }>();
    derived.agendas.forEach((a) => {
      const key = normalize(a.title);
      if (!key) return;
      const g = map.get(key) ?? { title: key, items: [] };
      g.items.push({ meeting: a.meeting, date: a.date, raw: a.title });
      map.set(key, g);
    });
    return [...map.values()]
      .map((g) => ({ ...g, items: [...g.items].sort((x, y) => x.date.localeCompare(y.date)) }))
      .sort((a, b) => b.items.length - a.items.length
        || b.items[b.items.length - 1].date.localeCompare(a.items[a.items.length - 1].date));
  }, [derived]);

  const asks = useMemo(
    () => Object.values(meetings).flatMap((m) => (m.asks ?? []).map((a) => ({ ...a, meeting: m.id }))),
    [meetings],
  );

  const titleOf = (id: string) => index.meetings.find((m) => m.id === id)?.title ?? id;
  const resultOf = (meetingId: string, title: string) => {
    const doc = meetings[meetingId];
    const hit = doc?.agenda?.find((a) => normalize(a.title) === normalize(title));
    return hit?.result ?? null;
  };

  if (loading) return <p role="status" className="text-sm text-slate-500 py-2">불러오는 중입니다…</p>;

  return (
    <div className="space-y-5 pb-12">
      <ChipRow
        label="보기"
        value={view}
        onChange={setView}
        options={[
          { value: '안건', label: '안건·조례 이력', count: groups.length },
          { value: '요구', label: '자료요구·지적사항', count: asks.length },
        ]}
      />

      {view === '안건' && (
        <>
          <SectionTitle count={groups.length} desc="같은 안건이 여러 차수에 걸치면 하나로 묶습니다">
            심사 안건
          </SectionTitle>

          {groups.length === 0 ? (
            <EmptyState
              icon={<Gavel className="w-6 h-6" aria-hidden="true" />}
              title="아직 정리된 안건이 없습니다"
              desc="속기록이 발간되면 심사 안건이 자동으로 채워집니다."
            />
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.title} className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <h4 className="font-bold text-slate-900 leading-snug flex-1 min-w-0">{g.title}</h4>
                    {g.items.length > 1 && (
                      <Badge tone="amber">{g.items.length}개 차수에 걸쳐 심사</Badge>
                    )}
                  </div>
                  <ol className="space-y-1.5">
                    {g.items.map((it, i) => {
                      const result = resultOf(it.meeting, it.raw);
                      return (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-slate-400 tabular-nums w-6 shrink-0">{i + 1}.</span>
                          <span className="text-slate-500">{korDate(it.date)}</span>
                          <button
                            type="button"
                            onClick={() => onNavigate('record', { meetingId: it.meeting })}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {titleOf(it.meeting)}
                          </button>
                          {result && (
                            <Badge tone={result === '보류' ? 'amber' : result === '보고 청취' ? 'slate' : 'green'}>
                              {result}
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === '요구' && (
        <>
          <SectionTitle count={asks.length}
            desc="회의록을 읽고 사람이 뽑은 항목입니다. 요약이 끝난 회차만 나옵니다">
            자료요구 · 지적사항
          </SectionTitle>

          {asks.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="w-6 h-6" aria-hidden="true" />}
              title="아직 정리된 항목이 없습니다"
              desc="회의록 전문은 이미 있습니다. 회차 요약을 쓰면 자료요구와 지적사항이 여기 모입니다."
            />
          ) : (
            <ul className="space-y-3">
              {asks.map((a, i) => (
                <li key={i} className="bg-white rounded-lg border border-slate-200 p-5 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ASK_TONE[a.type] ?? 'slate'}>{a.type}</Badge>
                    {a.dept && (
                      <button
                        type="button"
                        onClick={() => onNavigate('dept', { focus: a.dept! })}
                        className="text-sm font-bold text-blue-700 hover:underline"
                      >
                        {a.dept}
                      </button>
                    )}
                    {a.member && <span className="text-sm text-slate-500">{a.member} 위원</span>}
                    <button
                      type="button"
                      onClick={() => onNavigate('record', { meetingId: a.meeting, turn: a.turn ?? undefined })}
                      className="text-sm text-slate-500 hover:underline ml-auto"
                    >
                      {titleOf(a.meeting)}
                    </button>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{a.text}</p>
                  {a.quote && <Quote who={a.speaker}>{a.quote}</Quote>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
