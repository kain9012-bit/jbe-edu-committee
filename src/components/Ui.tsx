import React from 'react';
import { ExternalLink } from 'lucide-react';

/** 부서·상태 배지 — KRDS 색 토큰 위에서 쓰는 공통 조각 */
export const Badge: React.FC<{
  tone?: 'blue' | 'slate' | 'amber' | 'green' | 'red';
  children: React.ReactNode;
}> = ({ tone = 'slate', children }) => {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[tone];
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-bold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
};

/** 회의록에서 그대로 따온 문장 */
export const Quote: React.FC<{ children: React.ReactNode; who?: string | null }> = ({
  children,
  who,
}) => (
  <blockquote className="mt-2 pl-3 border-l-[3px] border-slate-200 text-sm text-slate-600">
    “{children}”
    {who && <cite className="not-italic block mt-1 text-xs text-slate-400">— {who}</cite>}
  </blockquote>
);

export const SectionTitle: React.FC<{
  children: React.ReactNode;
  count?: number;
  unit?: string;
  desc?: string;
}> = ({ children, count, unit = '건', desc }) => (
  <div className="flex items-baseline gap-2 flex-wrap">
    <h3 className="text-lg font-bold text-slate-900">{children}</h3>
    {count !== undefined && (
      <span className="text-sm font-bold text-blue-700 tabular-nums">{count}{unit}</span>
    )}
    {desc && <span className="text-xs text-slate-500">{desc}</span>}
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}> = ({ icon, title, desc, children }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
      {icon}
    </div>
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
    {desc && <p className="text-sm text-slate-500 max-w-md mx-auto">{desc}</p>}
    {children}
  </div>
);

/** 도의회 원문으로 나가는 링크. 이 서비스가 무엇을 근거로 하는지 늘 보이게 둔다. */
export const SourceLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800 hover:underline"
  >
    {children}
    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
  </a>
);

/**
 * 목록 위에 붙는 필터 칩 줄.
 *
 * `disabled` 는 **다른 조건 때문에 지금은 0건인 칩**에 쓴다. 지우지 않고 흐리게
 * 남기는 이유는, 사라지면 칩 줄의 길이가 매번 달라져 어디를 눌렀는지 놓치기
 * 때문이다. 고른 칩은 0건이어도 계속 누를 수 있게 둔다 — 못 풀면 갇힌다.
 */
export const ChipRow: React.FC<{
  options: { value: string; label: string; count?: number; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}> = ({ options, value, onChange, label }) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const on = o.value === value;
      const off = !!o.disabled && !on;
      return (
        <button
          key={o.value}
          type="button"
          aria-pressed={on}
          disabled={off}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full border text-sm font-bold transition-colors ${
            on
              ? 'bg-blue-600 border-blue-600 text-white'
              : off
                ? 'bg-white border-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-700'
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`ml-1.5 tabular-nums ${
              on ? 'text-blue-100' : off ? 'text-slate-300' : 'text-slate-400'
            }`}>
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
