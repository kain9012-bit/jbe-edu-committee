import React from 'react';
import type { Ask, Navigate } from '../types';
import { Badge } from './Ui';
import { AskDetail } from './AskDetail';
import { korDate } from '../lib/util';

const TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

/**
 * 지적·자료요구 한 건.
 *
 * 세 덩어리로 읽는다.
 *   1) 개조식 제목 — 목록에서 이것만 보고 판단할 수 있어야 한다.
 *   2) 개조식 본문 — 무엇이 문제이고 무엇을 해야 하는지.
 *   3) **위원이 한 말과 집행부가 한 답** — 접어 둔다. 근거를 확인해야 할 때만 편다.
 *      요구가 수십 건인데 발언 전문까지 늘어놓으면 무엇을 받아 가야 하는지가 묻힌다.
 *
 * 답변이 없는 자리도 있다(마무리 당부, 처리의견 개진). 그때는 없다고 밝힌다.
 */
export const AskItem: React.FC<{
  ask: Ask;
  meetingTitle: string;
  onNavigate: Navigate;
  /** 의원별 화면처럼 이미 그 위원 것만 보고 있을 때는 이름을 또 적지 않는다. */
  hideMember?: boolean;
}> = ({ ask, meetingTitle, onNavigate, hideMember }) => (
  <article className="space-y-3">
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
          onClick={() => onNavigate('dept', { member: ask.member! })}
          className="text-sm text-slate-600 hover:text-blue-700 hover:underline"
        >
          {ask.member} 위원
        </button>
      )}
      <span className="text-xs text-slate-400 ml-auto flex items-center gap-2">
        {korDate(ask.date)}
        <button
          type="button"
          onClick={() => onNavigate('record', { meetingId: ask.meeting, turn: ask.turn ?? undefined })}
          className="font-bold text-blue-700 hover:underline"
        >
          {meetingTitle}
        </button>
      </span>
    </div>

    <div className="space-y-1.5">
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
    </div>

    {/* 오간 말 — 접어 둔다. 목록에서는 제목과 본문만 훑는다. */}
    <AskDetail
      quote={ask.quote}
      speaker={ask.speaker}
      replies={ask.replies}
      onOpenRecord={ask.turn !== null && ask.turn !== undefined
        ? () => onNavigate('record', { meetingId: ask.meeting, turn: ask.turn! })
        : null}
    />
  </article>
);
