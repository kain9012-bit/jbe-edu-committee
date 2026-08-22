import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CircleSlash, MessagesSquare } from 'lucide-react';
import type { AskReply } from '../types';

/**
 * 오간 말(위원 발언 + 집행부 답변)을 **접어 둔 채로** 보여준다.
 *
 * 목록에서는 제목과 개조식 본문만 보이면 된다. 요구가 수십 건인데
 * 발언 전문까지 늘어놓으면 무엇을 받아 가야 하는지가 글더미에 묻힌다.
 * 근거를 확인해야 할 때만 펼친다.
 */
export const AskDetail: React.FC<{
  quote?: string | null;
  speaker?: string | null;
  replies?: AskReply[];
  /** 이 요구가 나온 자리를 회의록 전문에서 열어 준다. 없으면 단추를 내지 않는다. */
  onOpenRecord?: (() => void) | null;
}> = ({ quote, speaker, replies, onOpenRecord }) => {
  const [open, setOpen] = useState(false);
  const count = replies?.length ?? 0;
  const hasDetail = !!quote || count > 0;

  if (!hasDetail && !onOpenRecord) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border
                       border-slate-200 text-sm font-bold text-slate-600
                       hover:border-blue-600 hover:text-blue-700 transition-colors"
          >
            {open
              ? <ChevronUp className="w-4 h-4" aria-hidden="true" />
              : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            {open
              ? '발언 접기'
              : count > 0
                ? `위원 발언 · 집행부 답변 ${count}건 보기`
                : '위원 발언 보기'}
          </button>
        )}

        {/* 인용문만 보고 끝낼 수 없는 대목이 있다. 앞뒤 맥락은 전문에서 본다. */}
        {onOpenRecord && (
          <button
            type="button"
            onClick={onOpenRecord}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500
                       hover:text-blue-700 hover:underline"
          >
            <MessagesSquare className="w-4 h-4" aria-hidden="true" />
            회의록 전문에서 보기
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-md border border-slate-200 bg-slate-50/70 divide-y divide-slate-200">
          {quote && (
            <div className="p-3.5">
              <p className="text-xs font-bold text-slate-500 mb-0.5">
                위원 발언{speaker ? ` · ${speaker}` : ''}
              </p>
              <p className="text-slate-700 leading-relaxed">“{quote}”</p>
            </div>
          )}

          {count > 0 ? (
            replies!.map((r) => (
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
      )}
    </div>
  );
};
