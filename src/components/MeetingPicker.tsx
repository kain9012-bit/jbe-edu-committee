import React from 'react';
import type { IndexDoc } from '../types';
import { korDate, stageOf, STAGE_LABEL } from '../lib/util';

/** 회차 고르기 — 회의 요약·회의록 전문 탭이 함께 쓴다. */
export const MeetingPicker: React.FC<{
  index: IndexDoc;
  currentId: string;
  setCurrentId: (id: string) => void;
  /** 속기록이 있는 회의만 고를 수 있게 한다 */
  recordOnly?: boolean;
}> = ({ index, currentId, setCurrentId, recordOnly }) => {
  const list = recordOnly ? index.meetings.filter((m) => m.hasRecord) : index.meetings;
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="meetingPick" className="text-sm font-bold text-slate-600 shrink-0">
        회차
      </label>
      <select
        id="meetingPick"
        value={currentId}
        onChange={(e) => setCurrentId(e.target.value)}
        className="flex-1 min-w-0 sm:flex-none sm:min-w-[26rem] h-11 px-3 rounded-md border
                   border-slate-300 bg-white text-slate-900 font-medium outline-none
                   focus:border-blue-600"
      >
        {list.map((m) => (
          <option key={m.id} value={m.id}>
            {korDate(m.date)} · {m.title} — {STAGE_LABEL[stageOf(m)]}
          </option>
        ))}
      </select>
    </div>
  );
};
