export type ActiveTab = 'home' | 'meeting' | 'record' | 'dept' | 'member' | 'agenda' | 'search';

/** 회의록이 어디서 왔는가. 화면에 반드시 밝힌다. */
export type Source = 'record' | 'asr' | null;

export interface VodRef {
  vodNo: string;
  label: string;
  date: string;
  playerUrl: string;
  m3u8?: string | null;
  poster?: string | null;
  chapters?: { position: number; name: string; title: string }[];
}

export interface IndexEntry {
  id: string;
  /** S = 상임위원회, K = 행정사무감사 */
  kind: 'S' | 'K';
  daesu: number;
  session: number;
  sessionName: string;
  chasoo: number;
  date: string;
  title: string;
  vod: VodRef[];
  hasRecord: boolean;
  hasSummary: boolean;
  source: Source;
  /** 임시 = 속기 미확정본, 확정 = 확정본 */
  recordStatus: '임시' | '확정' | null;
  publishedAt: string | null;
  viewerUrl: string | null;
  turnCount: number;
  sentenceCount: number;
  members: string[];
  depts: string[];
  agendaCount: number;
  attachmentCount: number;
}

export interface IndexDoc {
  updatedAt: string;
  committee: string;
  meetings: IndexEntry[];
}

export const emptyIndex: IndexDoc = {
  updatedAt: '',
  committee: '전북특별자치도의회 교육위원회',
  meetings: [],
};

export interface Turn {
  i: number;
  agenda: string | null;
  agendaTitle: string;
  speaker: string;
  title: string;
  name: string;
  cmUid: number | null;
  role: '의원' | '집행부' | '전문위원' | '기타';
  dept: string | null;
  deptKind: string;
  line: number;
  lines: string[];
}

export interface RecordDoc {
  id: string;
  title: string;
  date: string;
  source: Source;
  recordStatus: '임시' | '확정' | null;
  publishedAt: string | null;
  viewerUrl: string | null;
  hwpUrl: string | null;
  meta: {
    count: string;
    title: string;
    sort: string;
    place: string;
    dateText: string;
    startTime: string;
  };
  purpose: string[];
  matters: string[];
  agendas: { idx: string | null; title: string }[];
  turns: Turn[];
  attend: Record<string, string[]>;
  attachments: { name: string; kbyte: number; url: string }[];
}

/** 사람이 쓴 요약. 없을 수 있다. */
export interface MeetingDoc {
  id: string;
  summary: string;
  /** 이 회의에서 가장 중요한 것들 */
  highlights: {
    title: string;
    body: string;
    dept?: string | null;
    member?: string | null;
    quote?: string | null;
    speaker?: string | null;
    turn?: number | null;
  }[];
  /** 안건별 처리 결과 */
  agenda: { title: string; result?: string | null; note?: string | null }[];
  /** 집행부가 받아 가야 할 것 — 자료요구·지적사항·요청 */
  asks: {
    type: '자료요구' | '지적사항' | '요청';
    dept?: string | null;
    member?: string | null;
    text: string;
    quote?: string | null;
    speaker?: string | null;
    turn?: number | null;
  }[];
}

export interface Exchange {
  meeting: string;
  date: string;
  agenda: string;
  dept: string;
  deptKind: string;
  answerer: string;
  answer: string;
  answerTurn: number;
  member: string | null;
  question: string | null;
  questionTurn: number | null;
}

export interface DeptStat {
  name: string;
  kind: string;
  turnCount: number;
  meetings: { id: string; count: number }[];
  members: { name: string; count: number }[];
}

export interface MemberStat {
  name: string;
  cmUid: number | null;
  turnCount: number;
  meetings: { id: string; count: number }[];
  depts: { name: string; count: number }[];
}

export interface DerivedDoc {
  depts: DeptStat[];
  members: MemberStat[];
  agendas: { meeting: string; date: string; title: string }[];
  exchanges: Exchange[];
}

export const emptyDerived: DerivedDoc = { depts: [], members: [], agendas: [], exchanges: [] };

/** 탭 이동. `focus` 는 부서명·의원명처럼 그 탭에서 바로 펼쳐 볼 대상. */
export type Navigate = (
  tab: ActiveTab,
  opts?: { query?: string; meetingId?: string; focus?: string; turn?: number },
) => void;
