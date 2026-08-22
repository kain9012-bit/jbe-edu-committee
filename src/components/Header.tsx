import React from 'react';
import { Landmark } from 'lucide-react';
import { korDate } from '../lib/util';
import type { ActiveTab, Navigate } from '../types';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'meeting', label: '회의 요약' },
  { id: 'dept', label: '부서별' },
  { id: 'member', label: '의원별' },
  { id: 'agenda', label: '안건' },
  { id: 'record', label: '회의록 전문' },
  { id: 'search', label: '통합검색' },
];

interface Props {
  activeTab: ActiveTab;
  onNavigate: Navigate;
  /** 가장 최근 회의 날짜 (ISO). 자료가 어디까지 와 있는지 보여준다. */
  latestDate?: string | null;
}

export const Header: React.FC<Props> = ({ activeTab, onNavigate, latestDate }) => (
  <header className="bg-white sticky top-0 z-30 border-b border-slate-200">
    {/* 안내 띠 — 도의회가 만든 자료가 아님을 먼저 밝힌다 (KRDS 마스트헤드 관례) */}
    <div className="bg-slate-50 text-slate-600 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span>
          전북특별자치도의회 공개 회의록을 정리한{' '}
          <strong className="font-bold text-slate-900">비공식</strong> 자료입니다
        </span>
        {latestDate && <span className="shrink-0">최근 회의 {korDate(latestDate)}</span>}
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 py-3.5 text-left group shrink-0"
        >
          <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 group-hover:bg-blue-700 transition-colors">
            <Landmark className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900 whitespace-nowrap">
              교육위원회 브리핑
            </span>
            <span className="hidden sm:inline text-xs font-medium text-slate-400 whitespace-nowrap">
              전북특별자치도의회
            </span>
          </span>
        </button>

        {/*
          탭이 7개라 좁은 화면에서는 오른쪽이 잘린다. 옆으로 밀린다는 표시가 없으면
          `회의록 전문`·`통합검색` 탭이 아예 없는 줄 안다.
          오른쪽 끝에 흰색에서 투명으로 가는 띠를 덮어 "더 있다"를 보이게 한다.
        */}
        <nav aria-label="주 메뉴" className="-mb-px w-full sm:w-auto relative">
          <div
            aria-hidden="true"
            className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-10
                       bg-gradient-to-l from-white to-transparent z-10"
          />
          <ul className="flex overflow-x-auto overflow-y-hidden no-scrollbar" role="tablist">
            {TABS.map(({ id, label }) => {
              const on = activeTab === id;
              return (
                <li key={id} role="presentation" className="shrink-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onNavigate(id)}
                    className={`px-3 sm:px-3.5 py-4 text-base font-bold whitespace-nowrap
                                border-b-[3px] transition-colors ${
                                  on
                                    ? 'text-blue-700 border-blue-600'
                                    : 'text-slate-600 border-transparent hover:text-slate-900'
                                }`}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  </header>
);
