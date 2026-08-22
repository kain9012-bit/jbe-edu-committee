import React from 'react';
import { CornerDownRight } from 'lucide-react';
import type { Exchange, Navigate } from '../types';
import { Badge } from './Ui';
import { korDate } from '../lib/util';

/**
 * 질의응답 한 건.
 *
 * `direct` 가 아니면 **질의를 답변과 나란히 두지 않는다.** 국장이 답하다 과장이
 * 이어받는 자리에서는 바로 앞의 의원 발언이 그 답변에 대한 질의가 아닌데,
 * 나란히 놓으면 읽는 사람은 그것을 짝이라고 믿는다. 틀린 짝을 맞는 짝처럼
 * 보여주는 것이 아무것도 안 보여주는 것보다 나쁘다.
 */
export const ExchangeItem: React.FC<{
  ex: Exchange;
  meetingTitle: string;
  onNavigate: Navigate;
  /** 지금 보고 있는 부서. 그 부서가 '언급'으로 걸린 건이면 표시한다. */
  viewingDept?: string;
}> = ({ ex, meetingTitle, onNavigate, viewingDept }) => {
  const byMention = !!viewingDept && ex.dept !== viewingDept;

  return (
    <article className="p-5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">{korDate(ex.date)}</span>
        <button
          type="button"
          onClick={() => onNavigate('record', { meetingId: ex.meeting, turn: ex.answerTurn })}
          className="font-bold text-blue-700 hover:underline"
        >
          {meetingTitle}
        </button>
        {byMention && <Badge tone="slate">언급됨 · 답변은 {ex.dept}</Badge>}
        {ex.agenda && (
          <span className="text-slate-400 truncate max-w-full sm:max-w-lg">{ex.agenda}</span>
        )}
      </div>

      {ex.direct && ex.question && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-0.5">질의 · {ex.member} 위원</p>
          <p className="text-slate-700 leading-relaxed">{ex.question}</p>
        </div>
      )}

      <div className="pl-3 border-l-[3px] border-blue-200">
        <p className="text-xs font-bold text-slate-500 mb-0.5">답변 · {ex.answerer}</p>
        <p className="text-slate-700 leading-relaxed">{ex.answer}</p>
      </div>

      {!ex.direct && (
        <div className="flex items-start gap-1.5 text-xs text-slate-500">
          <CornerDownRight className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            앞선 발언과 바로 이어지지 않아 질의를 함께 싣지 않았습니다.
            {ex.member && <> 이 대목 앞에서는 {ex.member} 위원이 말했습니다.</>}{' '}
            <button
              type="button"
              onClick={() => onNavigate('record', { meetingId: ex.meeting, turn: ex.answerTurn })}
              className="font-bold text-blue-700 hover:underline"
            >
              회의록에서 앞뒤 보기
            </button>
          </p>
        </div>
      )}
    </article>
  );
};
