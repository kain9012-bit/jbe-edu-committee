import React from 'react';
import { FileText, Clock, ExternalLink } from 'lucide-react';
import type { IndexDoc, MeetingDoc, Navigate, RecordDoc } from '../types';
import { Badge, EmptyState, Quote, SectionTitle, SourceLink } from './Ui';
import { MeetingPicker } from './MeetingPicker';
import { daysBetween, korDate, sourceNote } from '../lib/util';

interface Props {
  index: IndexDoc;
  currentId: string;
  setCurrentId: (id: string) => void;
  meeting: MeetingDoc | null;
  record: RecordDoc | null;
  loading: boolean;
  onNavigate: Navigate;
}

const ASK_TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

export const MeetingTab: React.FC<Props> = ({
  index, currentId, setCurrentId, meeting, record, loading, onNavigate,
}) => {
  const entry = index.meetings.find((m) => m.id === currentId);
  const lag = entry?.publishedAt ? daysBetween(entry.date, entry.publishedAt) : null;

  return (
    <div className="space-y-6 pb-12">
      <MeetingPicker index={index} currentId={currentId} setCurrentId={setCurrentId} />

      {entry && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {entry.kind === 'K' && <Badge tone="red">행정사무감사</Badge>}
            {entry.recordStatus === '임시' && <Badge tone="amber">속기 미확정</Badge>}
            {entry.recordStatus === '확정' && <Badge tone="green">확정 회의록</Badge>}
            <span className="text-sm text-slate-500">{korDate(entry.date)}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{entry.title}</h2>
          <p className="text-sm text-slate-600">
            {sourceNote(entry)}
            {lag !== null && <> · 회의 후 {lag}일 만에 발간</>}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {entry.viewerUrl && <SourceLink href={entry.viewerUrl}>도의회 회의록 원문</SourceLink>}
            {entry.vod.map((v) => (
              <SourceLink key={v.vodNo} href={v.playerUrl}>{v.label} 영상</SourceLink>
            ))}
            {entry.hasRecord && (
              <button
                type="button"
                onClick={() => onNavigate('record', { meetingId: entry.id })}
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
              >
                회의록 전문 보기
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      )}

      {loading && <p role="status" className="text-sm text-slate-500">불러오는 중입니다…</p>}

      {/* 요약이 없을 때 — 없는 요약을 지어내지 않는다. 대신 회의록에서 바로 나오는 것을 보여준다. */}
      {!loading && !meeting && (
        <>
          <EmptyState
            icon={entry?.hasRecord
              ? <FileText className="w-6 h-6" aria-hidden="true" />
              : <Clock className="w-6 h-6" aria-hidden="true" />}
            title={entry?.hasRecord ? '아직 요약을 쓰지 않았습니다' : '속기록이 아직 발간되지 않았습니다'}
            desc={entry?.hasRecord
              ? '회의록 전문과 부서별·의원별 정리는 이미 볼 수 있습니다. 요약은 사람이 읽고 씁니다.'
              : '도의회 속기록은 회의 후 보통 3~4주, 정례회·행정사무감사철에는 두 달까지 걸립니다.'}
          />

          {record && record.matters.length > 0 && (
            <section className="space-y-3">
              <SectionTitle count={record.matters.length}>이 회의에서 심사한 안건</SectionTitle>
              <ol className="space-y-2">
                {record.matters.map((t, i) => (
                  <li key={i} className="bg-white rounded-lg border border-slate-200 p-4 text-slate-800">
                    {t}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {meeting && (
        <>
          <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
            <SectionTitle>한 줄 요약</SectionTitle>
            <p className="text-slate-800 leading-relaxed">{meeting.summary}</p>
          </section>

          {meeting.agenda?.length > 0 && (
            <section className="space-y-3">
              <SectionTitle count={meeting.agenda.length}>안건 처리 결과</SectionTitle>
              <ul className="space-y-2">
                {meeting.agenda.map((a, i) => (
                  <li key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-1">
                    <div className="flex flex-wrap items-start gap-2">
                      <p className="font-bold text-slate-900 flex-1 min-w-0 leading-snug">{a.title}</p>
                      {a.result && <Badge tone="green">{a.result}</Badge>}
                    </div>
                    {a.note && <p className="text-sm text-slate-600">{a.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meeting.highlights?.length > 0 && (
            <section className="space-y-3">
              <SectionTitle count={meeting.highlights.length}>주요 질의응답</SectionTitle>
              <ul className="space-y-3">
                {meeting.highlights.map((h, i) => (
                  <li key={i} className="bg-white rounded-lg border border-slate-200 p-5 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900">{h.title}</h4>
                      {h.dept && (
                        <button
                          type="button"
                          onClick={() => onNavigate('dept', { focus: h.dept! })}
                          className="text-xs font-bold text-blue-700 hover:underline"
                        >
                          {h.dept}
                        </button>
                      )}
                      {h.member && <span className="text-xs text-slate-500">{h.member} 위원</span>}
                      {h.turn !== null && h.turn !== undefined && (
                        <button
                          type="button"
                          onClick={() => onNavigate('record', { meetingId: currentId, turn: h.turn! })}
                          className="text-xs font-bold text-slate-500 hover:text-blue-700 hover:underline ml-auto"
                        >
                          회의록에서 보기
                        </button>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed">{h.body}</p>
                    {h.quote && <Quote who={h.speaker}>{h.quote}</Quote>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meeting.asks?.length > 0 && (
            <section className="space-y-3">
              <SectionTitle count={meeting.asks.length}
                desc="집행부가 받아 가야 할 것">자료요구 · 지적사항</SectionTitle>
              <ul className="space-y-2">
                {meeting.asks.map((a, i) => (
                  <li key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-1.5">
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
                    </div>
                    <p className="text-slate-800 leading-relaxed">{a.text}</p>
                    {a.quote && <Quote who={a.speaker}>{a.quote}</Quote>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
