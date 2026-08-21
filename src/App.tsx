import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type {
  ActiveTab, DerivedDoc, IndexDoc, MeetingDoc, Navigate, RecordDoc,
} from './types';
import { emptyDerived, emptyIndex } from './types';
import { Header } from './components/Header';
import { HomeTab } from './components/HomeTab';
import { MeetingTab } from './components/MeetingTab';
import { RecordTab } from './components/RecordTab';
import { DeptTab } from './components/DeptTab';
import { MemberTab } from './components/MemberTab';
import { AgendaTab } from './components/AgendaTab';
import { SearchTab } from './components/SearchTab';

/**
 * 그 회의의 회의록 파일 경로.
 * 속기록이 있으면 그것을, 없고 받아쓴 임시본만 있으면 그것을 읽는다.
 * 화면에 보이는 회의록은 항상 **가장 믿을 만한 단계**의 결과다.
 */
function recordPath(e: { id: string; hasRecord: boolean; source: string | null }): string | null {
  if (e.hasRecord) return `records/${e.id}.json`;
  if (e.source === 'asr') return `records/${e.id}.asr.json`;
  return null;
}

/** data/*.json 을 BASE_URL 기준 상대경로로 읽는다 (Pages 하위 경로 대응) */
async function loadJson<T>(path: string): Promise<T | null> {
  const base = import.meta.env.BASE_URL || './';
  const url = `${base}data/${path}`.replace(/([^:]\/)\/+/g, '$1');
  try {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    console.warn(`${path} 응답 ${res.status}`);
  } catch (err) {
    console.warn(`${path} 을 불러오지 못했습니다.`, err);
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [focus, setFocus] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<number | null>(null);

  // 자료가 도착하기 전에는 빈 껍데기를 쓴다.
  // 그럴듯한 표본을 채워두면 못 받았을 때 가짜가 진짜처럼 보인다.
  const [index, setIndex] = useState<IndexDoc>(emptyIndex);
  const [derived, setDerived] = useState<DerivedDoc>(emptyDerived);
  const [records, setRecords] = useState<Record<string, RecordDoc>>({});
  const [meetings, setMeetings] = useState<Record<string, MeetingDoc>>({});

  const [currentId, setCurrentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── 목록 ──
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const idx = await loadJson<IndexDoc>('index.json');
      if (!alive) return;
      if (idx) {
        setIndex(idx);
        setCurrentId((cur) => cur || idx.meetings.find((m) => m.hasRecord)?.id || idx.meetings[0]?.id || '');
      }
      setLoadFailed(!idx);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [retryToken]);

  // ── 부서·의원·안건 탭이 쓰는 집계. 그 탭에 들어갈 때만 받는다. ──
  const derivedRequested = React.useRef(false);
  useEffect(() => {
    if (!['dept', 'member', 'agenda'].includes(activeTab)) return;
    if (derivedRequested.current) return;
    derivedRequested.current = true;
    setDetailLoading(true);
    (async () => {
      const d = await loadJson<DerivedDoc>('derived.json');
      if (d) setDerived(d);
      else derivedRequested.current = false;   // 한 번 끊겼다고 계속 빈 목록만 보이면 안 된다
      setDetailLoading(false);
    })();
  }, [activeTab]);

  // 홈 화면의 지표와 부서 바로가기도 집계를 쓴다. 가볍게 한 번만 받아 둔다.
  useEffect(() => {
    if (activeTab !== 'home' || derivedRequested.current) return;
    derivedRequested.current = true;
    (async () => {
      const d = await loadJson<DerivedDoc>('derived.json');
      if (d) setDerived(d);
      else derivedRequested.current = false;
    })();
  }, [activeTab, index]);

  // ── 회차 상세: 지금 보는 회차만 먼저 받는다 ──
  const ensureDetail = useCallback(async (id: string) => {
    if (!id) return;
    const entry = index.meetings.find((m) => m.id === id);
    if (!entry) return;
    const rp = recordPath(entry);
    const needRecord = !!rp && !records[id];
    const needMeeting = entry.hasSummary && !meetings[id];
    if (!needRecord && !needMeeting) return;

    setDetailLoading(true);
    const [r, m] = await Promise.all([
      needRecord && rp ? loadJson<RecordDoc>(rp) : null,
      needMeeting ? loadJson<MeetingDoc>(`meetings/${id}.json`) : null,
    ]);
    if (r) setRecords((prev) => ({ ...prev, [id]: r }));
    if (m) setMeetings((prev) => ({ ...prev, [id]: m }));
    setDetailLoading(false);
  }, [index, records, meetings]);

  useEffect(() => { void ensureDetail(currentId); }, [currentId, ensureDetail]);

  // ── 통합검색·안건 탭은 전 회차가 필요하다. 그 탭에 들어갈 때만 받는다. ──
  const bulkRequested = React.useRef(false);
  useEffect(() => {
    if (activeTab !== 'search' && activeTab !== 'agenda') return;
    if (bulkRequested.current || index.meetings.length === 0) return;
    bulkRequested.current = true;

    setDetailLoading(true);
    (async () => {
      const results = await Promise.all(
        index.meetings.map(async (e) => ({
          id: e.id,
          r: recordPath(e) ? await loadJson<RecordDoc>(recordPath(e)!) : null,
          m: e.hasSummary ? await loadJson<MeetingDoc>(`meetings/${e.id}.json`) : null,
        })),
      );
      const okAny = results.some((x) => x.r || x.m);
      setRecords((prev) => {
        const next = { ...prev };
        results.forEach((x) => { if (x.r) next[x.id] = x.r; });
        return next;
      });
      setMeetings((prev) => {
        const next = { ...prev };
        results.forEach((x) => { if (x.m) next[x.id] = x.m; });
        return next;
      });
      setDetailLoading(false);
      if (!okAny) bulkRequested.current = false;
    })();
  }, [activeTab, index]);

  // 탭을 바꾸면 화면 맨 위부터 보여준다.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [activeTab]);

  const navigate: Navigate = (tab, opts) => {
    if (opts?.query !== undefined) setSearchQuery(opts.query);
    if (opts?.meetingId) setCurrentId(opts.meetingId);
    setFocus(opts?.focus ?? null);
    setJumpTo(opts?.turn ?? null);
    setActiveTab(tab);
  };

  const latest = index.meetings[0]?.date ?? null;

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-800 font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      <a href="#container" className="krds-skip">본문 바로가기</a>

      <Header activeTab={activeTab} setActiveTab={setActiveTab} latestDate={latest} />

      <main id="container" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && (
          <p className="text-sm text-slate-500 py-2" role="status">수집 자료를 불러오는 중입니다…</p>
        )}

        {!loading && loadFailed && (
          <div role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5 space-y-2">
            <p className="font-bold text-slate-900">수집 자료를 불러오지 못했습니다</p>
            <p className="text-sm text-slate-700">
              화면에 아무 회의도 표시되지 않습니다. 없는 자료를 임의로 채워 보여주지 않습니다.
              연결 상태를 확인한 뒤 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={() => {
                bulkRequested.current = false;
                derivedRequested.current = false;
                setRetryToken((n) => n + 1);
              }}
              className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !loadFailed && (
          <>
            {activeTab === 'home' && (
              <HomeTab index={index} derived={derived} onNavigate={navigate} />
            )}

            {activeTab === 'meeting' && (
              <MeetingTab
                index={index}
                currentId={currentId}
                setCurrentId={setCurrentId}
                meeting={meetings[currentId] ?? null}
                record={records[currentId] ?? null}
                loading={detailLoading}
                onNavigate={navigate}
              />
            )}

            {activeTab === 'record' && (
              <RecordTab
                index={index}
                currentId={currentId}
                setCurrentId={setCurrentId}
                record={records[currentId] ?? null}
                loading={detailLoading}
                jumpTo={jumpTo}
                onJumped={() => setJumpTo(null)}
                onNavigate={navigate}
              />
            )}

            {activeTab === 'dept' && (
              <DeptTab
                index={index}
                derived={derived}
                loading={detailLoading}
                focus={focus}
                onFocused={() => setFocus(null)}
                onNavigate={navigate}
              />
            )}

            {activeTab === 'member' && (
              <MemberTab
                index={index}
                derived={derived}
                loading={detailLoading}
                focus={focus}
                onFocused={() => setFocus(null)}
                onNavigate={navigate}
              />
            )}

            {activeTab === 'agenda' && (
              <AgendaTab
                index={index}
                derived={derived}
                meetings={meetings}
                loading={detailLoading}
                onNavigate={navigate}
              />
            )}

            {activeTab === 'search' && (
              <SearchTab
                index={index}
                records={records}
                meetings={meetings}
                initialQuery={searchQuery}
                onConsumeInitialQuery={() => setSearchQuery('')}
                onNavigate={navigate}
                loading={detailLoading}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-slate-900 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-base font-bold text-white">
                교육위원회 브리핑{' '}
                <span className="text-slate-400 font-medium">전북특별자치도의회</span>
              </p>
              <p className="text-sm text-slate-300">
                도의회가 공개한 회의록을 정리한 자료입니다. 도의회 공식 서비스가 아닙니다.
              </p>
            </div>
            <div className="text-sm text-slate-300 md:text-right space-y-1">
              <p>회의록 출처: 전북특별자치도의회 전자회의록</p>
              <p>영상 출처: 전북특별자치도의회 인터넷 의사중계</p>
              <p>속기 미확정본은 확정 회의록으로 교체되면 내용이 바뀔 수 있습니다.</p>
            </div>
          </div>
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
}

/** 화면을 어느 정도 내렸을 때만 나타나는 '맨 위로' 버튼 (KRDS 상단이동 패턴) */
function ScrollToTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="맨 위로 이동"
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-1.5 px-4 py-3
                  rounded-full border border-slate-300 bg-white text-slate-700 shadow-lg
                  text-sm font-bold hover:bg-blue-600 hover:border-blue-600 hover:text-white
                  transition-all ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
    >
      <ArrowUp className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">맨 위로</span>
    </button>
  );
}
