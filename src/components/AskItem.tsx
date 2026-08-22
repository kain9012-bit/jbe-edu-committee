import React from 'react';
import { CircleSlash } from 'lucide-react';
import type { Ask, Navigate } from '../types';
import { Badge } from './Ui';
import { korDate } from '../lib/util';

const TONE = { 자료요구: 'blue', 지적사항: 'red', 요청: 'amber' } as const;

/**
 * 지적·자료요구 한 건.
 *
 * 세 덩어리로 읽는다.
 *   1) 개조식 제목 — 목록에서 이것만 보고 판단할 수 있어야 한다.
 *   2) 개조식 본문 — 무엇이 문제이고 무엇을 해야 하는지.
 *   3) **위원이 한 말과 집행부가 한 답** — 요구만 싣고 답을 빼면
 *      받아 갈 사람이 "그래서 뭐라고 했는데?" 를 알 수 없다.
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
          onClick={() => onNavigate('member', { focus: ask.member! })}
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

    {/* 오간 말 — 요구와 답을 나란히 둔다 */}
    <div className="rounded-md border border-slate-200 bg-slate-50/70 divide-y divide-slate-200">
      {ask.quote && (
        <div className="p-3.5">
          <p className="text-xs font-bold text-slate-500 mb-0.5">
            위원 발언{ask.speaker ? ` · ${ask.speaker}` : ''}
          </p>
          <p className="text-slate-700 leading-relaxed">“{ask.quote}”</p>
        </div>
      )}

      {ask.replies?.length > 0 ? (
        ask.replies.map((r) => (
          <div key={r.i} className="p-3.5 bg-white">
            <p className="text-xs font-bold text-slate-500 mb-0.5">집행부 답변 · {r.speaker}</p>
            <p className="text-slate-700 leading-relaxed">{r.text}</p>
          </div>
        ))
      ) : (
        <div className="p-3.5 bg-white flex items-start gap-2 text-sm text-slate-500">
          <CircleSlash className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            이 자리에서 집행부 답변은 없었습니다. 마무리 당부이거나 처리의견을 밝히는
            대목입니다.
          </p>
        </div>
      )}
    </div>
  </article>
);
