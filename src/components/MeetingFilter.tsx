import React from 'react';
import type { IndexDoc } from '../types';
import { korDate } from '../lib/util';

/**
 * 회차로 좁히는 고르개.
 *
 * 부서별·의원별 화면은 전 회차를 한 덩어리로 보여줬다. "이번 회기에 우리 과에
 * 뭐가 나왔나" 를 보려면 회차를 골라야 하는데 그 길이 없었다. 회의가 쌓일수록
 * 이 문제는 커진다.
 */
export const MeetingFilter: React.FC<{
  index: IndexDoc;
  value: string;
  onChange: (v: string) => void;
  /** 회차별 건수. 0건인 회차는 고를 수 있게 두되 숫자로 알려 준다. */
  counts?: Map<string, number>;
  label?: string;
}> = ({ index, value, onChange, counts, label = '회차로 좁히기' }) => {
  const total = counts ? [...counts.values()].reduce((a, b) => a + b, 0) : null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                 outline-none focus:border-blue-600 max-w-full"
    >
      <option value="전체">
        회차 전체{total !== null ? ` (${total})` : ''}
      </option>
      {index.meetings.map((m) => (
        <option key={m.id} value={m.id}>
          {korDate(m.date)} · {m.title}
          {counts ? ` (${counts.get(m.id) ?? 0})` : ''}
        </option>
      ))}
    </select>
  );
};
