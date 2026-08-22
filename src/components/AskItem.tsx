import React from 'react';
import type { MeetingDoc, Navigate } from '../types';
import { Badge, Quote } from './Ui';

type Ask = MeetingDoc['asks'][number] & { meeting: string };

const TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

/**
 * 자료요구·지적사항 한 건.
 *
 * 예전에는 한 줄짜리 서술문 하나였다("…자료를 제출하라는 요구가 있었다").
 * 그러면 목록을 훑어도 무슨 내용인지 알 수가 없어서, 결국 회의록을 다시 열어야 했다.
 * **개조식 제목 + 개조식 본문**으로 바꿔 목록에서 바로 판단할 수 있게 한다.
 */
export const AskItem: React.FC<{
  ask: Ask;
  meetingTitle: string;
  date?: string;
  onNavigate: Navigate;
  /** 의원별 화면처럼 이미 그 위원 것만 보고 있을 때는 이름을 또 적지 않는다. */
  hideMember?: boolean;
}> = ({ ask, meetingTitle, date, onNavigate, hideMember }) => (
  <article className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={TONE[ask.type] ?? 'slate'}>{ask.type}</Badge>
      {ask.dept && (
        <button
          type="button"
          onClick={() => onNavigate('dept', { focus: ask.dept! })}
          className="text-sm font-bold text-blue-700 hover:underline"
        >
          {ask.dept}
        </button>
      )}
      {!hideMember && ask.member && (
        <button
          type="button"
          onClick={() => onNavigate('member', { focus: ask.member! })}
          className="text-sm text-slate-600 hover:text-blue-700 hover:underline"
        >
          {ask.member} 위원
        </button>
      )}
      <span className="text-xs text-slate-400 ml-auto flex items-center gap-2">
        {date}
        <button
          type="button"
          onClick={() => onNavigate('record', { meetingId: ask.meeting, turn: ask.turn ?? undefined })}
          className="font-bold text-blue-700 hover:underline"
        >
          {meetingTitle}
        </button>
      </span>
    </div>

    <h4 className="font-bold text-slate-900 leading-snug">{ask.title}</h4>

    {ask.body?.length > 0 && (
      <ul className="space-y-1">
        {ask.body.map((line, i) => (
          <li key={i} className="flex gap-2 text-slate-700 leading-relaxed">
            <span aria-hidden="true" className="text-slate-300 select-none shrink-0">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    )}

    {ask.quote && <Quote who={ask.speaker}>{ask.quote}</Quote>}
  </article>
);
