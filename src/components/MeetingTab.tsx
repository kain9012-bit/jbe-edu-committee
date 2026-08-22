import React from 'react';
import { FileText, Clock, ExternalLink } from 'lucide-react';
import type { Ask, IndexDoc, MeetingDoc, Navigate, RecordDoc } from '../types';
import { Badge, EmptyState, Quote, SectionTitle, SourceLink } from './Ui';
import { MeetingPicker } from './MeetingPicker';
import { AskDetail } from './AskDetail';
import { korDate, sourceNote } from '../lib/util';

interface Props {
  index: IndexDoc;
  currentId: string;
  setCurrentId: (id: string) => void;
  meeting: MeetingDoc | null;
  record: RecordDoc | null;
  /** 집행부 답변이 붙은 판(asks.json). 요약의 asks 에는 답변이 없다. */
  asks: Ask[];
  loading: boolean;
  onNavigate: Navigate;
}

export const MeetingTab: React.FC<Props> = ({
  index, currentId, setCurrentId, meeting, record, asks, loading, onNavigate,
}) => {
  const entry = index.meetings.find((m) => m.id === currentId);

  // 요약의 asks 와 asks.json 을 회차·제목으로 맞춘다. 답변은 asks.json 에만 있다.
  const repliesOf = (title: string) =>
    asks.find((a) => a.meeting === currentId && a.title === title)?.replies ?? [];

  return (
    <div className="space-y-6 pb-12">
      <MeetingPicker index={index} currentId={currentId} setCurrentId={setCurrentId} />

      {entry && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {entry.kind === 'K' && <Badge tone="red">행정사무감사</Badge>}
            <span className="text-sm text-slate-500">{korDate(entry.date)}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{entry.title}</h2>
          <p className="text-sm text-slate-600">{sourceNote(entry)}</p>
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
            title={entry?.hasRecord ? '아직 요약을 쓰지 않았습니다' : '회의록이 아직 올라오지 않았습니다'}
            desc={entry?.hasRecord
              ? '회의록 전문과 부서별·의원별 정리는 이미 볼 수 있습니다. 요약은 사람이 읽고 씁니다.'
              : '도의회 회의록은 회의 후 보통 3~4주, 정례회·행정사무감사철에는 두 달까지 걸립니다.'}
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
          {meeting.glance?.length > 0 && (
            <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-5 space-y-2.5">
              <h3 className="font-bold text-slate-900">한눈에 보기</h3>
              <ul className="space-y-1.5">
                {meeting.glance.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-slate-800 leading-relaxed">
                    <span aria-hidden="true" className="text-blue-500 select-none shrink-0 mt-[0.35rem]">
                      <span className="block w-1.5 h-1.5 rounded-full bg-current" />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <SectionTitle>회의 요약</SectionTitle>
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-slate-800 leading-relaxed">{meeting.summary}</p>
            </div>
          </section>

          {meeting.agenda?.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <SectionTitle count={meeting.agenda.length}>안건 처리 결과</SectionTitle>
                {/* 안건 탭을 없앴다. 전 회차 안건 이력은 여기서 연다. */}
                <button
                  type="button"
                  onClick={() => onNavigate('agenda')}
                  className="text-sm font-bold text-slate-500 hover:text-blue-700 hover:underline"
                >
                  전 회차 안건 이력 보기
                </button>
              </div>
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
                  <li key={i} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={a.type === '지적사항' ? 'red' : a.type === '자료요구' ? 'blue' : 'amber'}>
                        {a.type}
                      </Badge>
                      {a.dept && <span className="text-sm font-bold text-blue-700">{a.dept}</span>}
                      {a.member && <span className="text-sm text-slate-500">{a.member} 위원</span>}
                      <button
                        type="button"
                        onClick={() => onNavigate('asks')}
                        className="text-xs font-bold text-slate-500 hover:text-blue-700 hover:underline ml-auto"
                      >
                        지적·요구 모아 보기
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-900 leading-snug">{a.title}</p>
                      <ul className="space-y-1">
                        {(a.body ?? []).map((line, k) => (
                          <li key={k} className="flex gap-2 text-slate-700 leading-relaxed">
                            <span aria-hidden="true" className="text-slate-300 shrink-0">·</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* 오간 말은 접어 둔다. 여기서는 받아 갈 것만 훑는다. */}
                    <AskDetail
                      quote={a.quote}
                      speaker={a.speaker}
                      replies={repliesOf(a.title)}
                      onOpenRecord={a.turn !== null && a.turn !== undefined
                        ? () => onNavigate('record', { meetingId: currentId, turn: a.turn! })
                        : null}
                    />
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
