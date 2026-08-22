import React, { useState } from 'react';
import { ChevronDown, MessagesSquare } from 'lucide-react';
import type { Dialog, Navigate } from '../types';
import { Badge } from './Ui';
import { korDate } from '../lib/util';

/** 접기 전에 보여줄 발언 수. 첫 질의와 그에 대한 답이 반드시 들어갈 만큼. */
const PREVIEW = 6;

/**
 * 주고받은 덩어리 하나.
 *
 * 위원의 질의와 집행부의 답변이 **오간 순서 그대로** 한 카드 안에 들어간다.
 * 답변마다 카드를 쪼개면 앞뒤가 끊겨서, 왜 그런 답이 나왔는지 알 수 없다.
 * 실제로 "그 추천받은 인원 수인가요?" 라는 되물음이 질의처럼 홀로 떠 있었다.
 */
export const DialogItem: React.FC<{
  dialog: Dialog;
  meetingTitle: string;
  onNavigate: Navigate;
  /** 지금 보고 있는 부서. 그 부서 발언에 표시를 준다. */
  highlightDept?: string;
  /** 의원별 화면처럼 이미 그 위원 것만 보고 있을 때는 이름을 또 적지 않는다. */
  hideMember?: boolean;
}> = ({ dialog, meetingTitle, onNavigate, highlightDept, hideMember }) => {
  const [open, setOpen] = useState(false);
  const turns = open ? dialog.turns : dialog.turns.slice(0, PREVIEW);
  const rest = dialog.turnCount - turns.length;

  const asked = dialog.turns.filter((t) => t.role === '의원').length;
  const answered = dialog.turnCount - asked;
  const byMention = !!highlightDept && !dialog.depts.includes(highlightDept);

  return (
    <article className="p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">{korDate(dialog.date)}</span>
        <button
          type="button"
          onClick={() => onNavigate('record', { meetingId: dialog.meeting, turn: dialog.startTurn })}
          className="font-bold text-blue-700 hover:underline"
        >
          {meetingTitle}
        </button>
        {dialog.agenda && (
          <span className="text-slate-400 truncate max-w-full sm:max-w-lg">{dialog.agenda}</span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {!hideMember && dialog.member && (
          <button
            type="button"
            onClick={() => onNavigate('member', { focus: dialog.member! })}
            className="font-bold text-slate-900 hover:text-blue-700 hover:underline"
          >
            {dialog.member} 위원
          </button>
        )}
        {!hideMember && dialog.member && dialog.depts.length > 0 && (
          <span className="text-slate-300" aria-hidden="true">→</span>
        )}
        {dialog.depts.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onNavigate('dept', { focus: d })}
            className="font-bold text-blue-700 hover:underline"
          >
            {d}
          </button>
        ))}
        {!dialog.member && <Badge tone="slate">업무보고·제안설명</Badge>}
        {byMention && <Badge tone="slate">이름만 언급됨</Badge>}
        <span className="text-xs text-slate-500 ml-auto tabular-nums">
          질의 {asked} · 답변 {answered}
        </span>
      </div>

      <ol className="space-y-2.5">
        {turns.map((t) => {
          const mine = highlightDept && t.dept === highlightDept;
          return (
            <li
              key={t.i}
              className={`pl-3 border-l-[3px] ${
                t.role === '의원'
                  ? 'border-slate-200'
                  : mine ? 'border-blue-500' : 'border-blue-100'
              }`}
            >
              <p className="text-xs font-bold text-slate-500 mb-0.5">
                {t.role === '의원' ? '질의' : '답변'} · {t.speaker}
              </p>
              <p className="text-slate-700 leading-relaxed">{t.text}</p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border
                       border-slate-200 text-sm font-bold text-slate-600
                       hover:border-blue-600 hover:text-blue-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
            남은 발언 {rest}건 더 보기
          </button>
        )}
        {open && dialog.turnCount > PREVIEW && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-bold text-slate-500 hover:text-slate-800"
          >
            접기
          </button>
        )}
        <button
          type="button"
          onClick={() => onNavigate('record', { meetingId: dialog.meeting, turn: dialog.startTurn })}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500
                     hover:text-blue-700 hover:underline"
        >
          <MessagesSquare className="w-4 h-4" aria-hidden="true" />
          회의록 전문에서 보기
        </button>
      </div>
    </article>
  );
};
