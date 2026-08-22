import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Paperclip, Users, Clock, ListTree } from 'lucide-react';
import type { IndexDoc, Navigate, RecordDoc } from '../types';
import { Badge, EmptyState, SectionTitle, SourceLink } from './Ui';
import { MeetingPicker } from './MeetingPicker';
import { korDate, highlight, looseTest, QUOTE_CAUTION } from '../lib/util';

interface Props {
  index: IndexDoc;
  currentId: string;
  setCurrentId: (id: string) => void;
  record: RecordDoc | null;
  loading: boolean;
  /** 다른 탭에서 "이 발언을 회의록에서 보고 싶다" 며 넘어온 자리 */
  jumpTo: number | null;
  onNavigate: Navigate;
}

export const RecordTab: React.FC<Props> = ({
  index, currentId, setCurrentId, record, loading, jumpTo, onNavigate,
}) => {
  const entry = index.meetings.find((m) => m.id === currentId);
  const [who, setWho] = useState('전체');
  const [agenda, setAgenda] = useState('전체');
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLUListElement>(null);

  // 회차를 바꾸면 필터를 되돌린다. 앞 회차의 부서가 남아 있으면 빈 목록이 뜬다.
  useEffect(() => { setWho('전체'); setAgenda('전체'); setQ(''); }, [currentId]);

  /**
   * 발언자 목록.
   *
   * 도의원과 도교육청 기관을 한 목록에 섞어 두면, 고르는 사람이 `장연국 위원` 과
   * `과학교육원` 사이에서 무엇을 고르는 것인지 매번 다시 판단해야 한다.
   * 성격이 다른 것을 나란히 두지 않는다 — 묶어서 보여준다.
   */
  const groups = useMemo(() => {
    const bag = new Map<string, Map<string, number>>();
    const put = (group: string, key: string) => {
      const m = bag.get(group) ?? bag.set(group, new Map()).get(group)!;
      m.set(key, (m.get(key) ?? 0) + 1);
    };
    (record?.turns ?? []).forEach((t) => {
      if (t.role === '의원') put('도의원', `${t.name} 위원`);
      else if (t.dept && (t.deptKind === '본청' || t.deptKind === '기관장')) put('도교육청 본청', t.dept);
      else if (t.dept && t.deptKind === '직속기관') put('직속기관', t.dept);
      else if (t.dept && t.deptKind === '교육지원청') put('교육지원청', t.dept);
      else put('그 밖', t.dept ?? t.speaker);
    });
    // 이 회의에 없는 묶음은 아예 내보내지 않는다. 직속기관 보고 회의에
    // 빈 `교육지원청` 칸이 뜨면 고를 게 있는 줄 안다.
    return ['도의원', '도교육청 본청', '직속기관', '교육지원청', '그 밖']
      .map((g) => ({
        label: g,
        items: [...(bag.get(g) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]),
      }))
      .filter((g) => g.items.length > 0);
  }, [record]);

  /**
   * 안건별 목차.
   * 830건짜리 회의록을 위에서부터 훑는 것 말고 길이 없었다. 안건 정보는 이미
   * 발언마다 붙어 있는데 화면에서 쓰지 않고 있었다.
   */
  const chapters = useMemo(() => {
    const seen = new Map<string, number>();
    (record?.turns ?? []).forEach((t) => {
      const key = t.agendaTitle || '(안건 지정 없음)';
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return [...seen.entries()];
  }, [record]);

  const turns = useMemo(() => {
    let list = record?.turns ?? [];
    if (agenda !== '전체') {
      list = list.filter((t) => (t.agendaTitle || '(안건 지정 없음)') === agenda);
    }
    if (who !== '전체') {
      list = list.filter(
        (t) => (t.dept ?? (t.role === '의원' ? `${t.name} 위원` : t.speaker)) === who,
      );
    }
    const needle = q.trim();
    if (needle) list = list.filter((t) => t.lines.some((l) => looseTest(l, needle)));
    return list;
  }, [record, who, agenda, q]);

  /**
   * 넘어온 발언 자리로 데려간다.
   *
   * 못 찾으면 **그냥 넘어가지 않는다.** 예전에는 못 찾아도 목적지를 지워 버려서,
   * 회의록이 늦게 도착하면 영영 못 갔다. 한 번 데려간 자리는 ref 에 적어 두고
   * 같은 자리로 두 번 끌고 가지 않는다.
   */
  const jumped = useRef<string | null>(null);
  useEffect(() => {
    if (jumpTo === null || !record) return;
    const key = `${currentId}#${jumpTo}`;
    if (jumped.current === key) return;

    // 필터에 가려 그 발언이 화면에 없으면 필터를 푼다.
    // 링크를 받고 들어온 사람이 앞 회차의 필터 때문에 빈 화면을 보면 안 된다.
    const el = boxRef.current?.querySelector(`[data-turn="${jumpTo}"]`);
    if (!el) {
      if (who !== '전체' || agenda !== '전체' || q) {
        setWho('전체'); setAgenda('전체'); setQ('');
      }
      return;                       // 다음 그림에서 다시 찾는다
    }

    jumped.current = key;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement).classList.add('ring-2', 'ring-blue-500');
    window.setTimeout(
      () => (el as HTMLElement).classList.remove('ring-2', 'ring-blue-500'), 2400,
    );
  }, [jumpTo, record, turns, currentId, who, agenda, q]);

  return (
    <div className="space-y-6 pb-12">
      <MeetingPicker index={index} currentId={currentId} setCurrentId={setCurrentId} />

      {loading && <p role="status" className="text-sm text-slate-500">회의록을 불러오는 중입니다…</p>}

      {!loading && !record && (
        <EmptyState
          icon={<Clock className="w-6 h-6" aria-hidden="true" />}
          title="회의록이 아직 올라오지 않았습니다"
          desc={
            entry
              ? `${korDate(entry.date)} 회의입니다. 도의회 회의록은 회의 후 보통 3~4주, 정례회·행정사무감사철에는 두 달까지 걸립니다. 그동안은 영상으로 확인해 주세요.`
              : undefined
          }
        >
          {entry?.vod?.[0] && (
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              {entry.vod.map((v) => (
                <SourceLink key={v.vodNo} href={v.playerUrl}>{v.label} 영상 보기</SourceLink>
              ))}
            </div>
          )}
        </EmptyState>
      )}

      {record && (
        <>
          {/* 회의 개요 */}
          <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">도의회 공식 회의록</Badge>
              <span className="text-sm text-slate-500">{korDate(record.date)}</span>
              {record.publishedAt && (
                <span className="text-sm text-slate-400">발간 {korDate(record.publishedAt)}</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{record.title}</h2>
            <p className="text-sm text-slate-600">
              {record.meta.count} · {record.meta.sort}
              {record.meta.startTime && <> · {record.meta.startTime}</>}
            </p>

            {record.purpose.length > 0 && (
              <div className="pt-1">
                <p className="text-sm font-bold text-slate-700 mb-1">의사일정</p>
                <ol className="space-y-1 text-sm text-slate-600 list-none">
                  {record.purpose.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">
              {record.viewerUrl && (
                <SourceLink href={record.viewerUrl}>도의회 회의록 원문</SourceLink>
              )}
              {record.hwpUrl && <SourceLink href={record.hwpUrl}>회의록 HWP 내려받기</SourceLink>}
              {entry?.vod?.map((v) => (
                <SourceLink key={v.vodNo} href={v.playerUrl}>{v.label} 영상</SourceLink>
              ))}
            </div>

            {/* 확정 전이라는 사실은 **인용하는 사람에게만** 쓸모가 있다.
                목록이나 요약에서는 아무 조치도 못 하므로 적지 않는다. */}
            {record.recordStatus === '임시' && (
              <p className="text-xs text-slate-500 pt-1">{QUOTE_CAUTION}</p>
            )}
          </section>

          {/* 출석 */}
          {Object.keys(record.attend).length > 0 && (
            <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Users className="w-4 h-4" aria-hidden="true" />출석
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {Object.entries(record.attend).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500 text-xs font-bold">{k} ({v.length}명)</dt>
                    <dd className="text-slate-700">{v.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* 첨부 */}
          {record.attachments.length > 0 && (
            <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Paperclip className="w-4 h-4" aria-hidden="true" />부록 · 검토보고서
              </div>
              <ul className="space-y-1">
                {record.attachments.map((a) => (
                  <li key={a.url}>
                    <SourceLink href={a.url}>{a.name}</SourceLink>
                    <span className="text-xs text-slate-400 ml-1.5">
                      {Math.round(a.kbyte)}KB
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 안건 목차 */}
          {chapters.length > 1 && (
            <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <ListTree className="w-4 h-4" aria-hidden="true" />안건별로 건너뛰기
              </div>
              <ul className="flex flex-wrap gap-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => setAgenda('전체')}
                    aria-pressed={agenda === '전체'}
                    className={`px-3 py-1.5 rounded-full border text-sm font-bold transition-colors ${
                      agenda === '전체'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-600'
                    }`}
                  >
                    전체 <span className="tabular-nums opacity-70">{record.turns.length}</span>
                  </button>
                </li>
                {chapters.map(([title, n]) => (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => setAgenda(title)}
                      aria-pressed={agenda === title}
                      title={title}
                      className={`px-3 py-1.5 rounded-full border text-sm font-bold transition-colors
                                  max-w-full sm:max-w-md truncate ${
                        agenda === title
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-600'
                      }`}
                    >
                      {title} <span className="tabular-nums opacity-70">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 발언 */}
          <section className="space-y-3">
            <SectionTitle count={turns.length} desc={`전체 ${record.turns.length}건`}>
              발언 전문
            </SectionTitle>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                aria-label="발언자로 좁히기"
                className="h-11 px-3 rounded-md border border-slate-300 bg-white font-medium
                           outline-none focus:border-blue-600 sm:w-72"
              >
                <option value="전체">발언자 전체</option>
                {groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map(([name, n]) => (
                      <option key={name} value={name}>{name} ({n})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이 회의록 안에서 찾기"
                aria-label="이 회의록 안에서 찾기"
                className="flex-1 h-11 px-3 rounded-md border border-slate-300 bg-white
                           outline-none focus:border-blue-600"
              />
            </div>

            {turns.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6" aria-hidden="true" />}
                title="해당하는 발언이 없습니다"
                desc="발언자나 검색어를 바꿔 보세요."
              />
            ) : (
              <ul ref={boxRef} className="space-y-2">
                {turns.map((t) => (
                  <li
                    key={t.i}
                    data-turn={t.i}
                    className="bg-white rounded-lg border border-slate-200 p-4 scroll-mt-32 transition-shadow"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-slate-900">{t.speaker}</span>
                      {t.dept && (
                        <button
                          type="button"
                          onClick={() => onNavigate('dept', { focus: t.dept! })}
                          className="text-xs font-bold text-blue-700 hover:underline"
                        >
                          {t.dept}
                        </button>
                      )}
                      {t.role === '의원' && (
                        <button
                          type="button"
                          onClick={() => onNavigate('dept', { member: t.name })}
                          className="text-xs font-bold text-blue-700 hover:underline"
                        >
                          이 위원 질의 모아 보기
                        </button>
                      )}
                      {t.agendaTitle && (
                        <span className="text-xs text-slate-400 truncate max-w-full sm:max-w-md">
                          {t.agendaTitle}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-slate-700 leading-relaxed">
                      {t.lines.map((l, i) => (
                        <p key={i}>{q.trim() ? highlight(l, q) : l}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
