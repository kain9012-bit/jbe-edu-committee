export type ActiveTab =
  | 'home' | 'meeting' | 'record' | 'dept' | 'member' | 'asks' | 'agenda' | 'search';

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

/**
 * 지적·자료요구 한 건. `data/asks.json` 에서 온다.
 * 사람이 쓴 요약(meetings/*.json)의 asks 에 **집행부 답변을 붙여** 만든다.
 */
export interface Ask {
  type: '자료요구' | '지적사항' | '요청';
  dept?: string | null;
  member?: string | null;
  /** 개조식 한 줄. 명사형으로 끝낸다. */
  title: string;
  /** 개조식 항목들 */
  body: string[];
  quote?: string | null;
  speaker?: string | null;
  turn?: number | null;
  meeting: string;
  date: string;
  /** 그 발언 바로 뒤에 이어진 집행부 답변. 없을 수 있다. */
  replies: { i: number; speaker: string; dept: string | null; text: string }[];
}

/** 사람이 쓴 요약. 없을 수 있다. */
export interface MeetingDoc {
  id: string;
  /**
   * 한눈에 보기 — 이 회의에서 건질 것만 개조식으로 6~8줄.
   *
   * 요약 문단을 먼저 두면 아무도 안 읽는다. 목록을 훑다가 걸리는 게 있을 때
   * 문단으로 내려간다. `핵심 사실 — 부연` 꼴로 쓴다.
   */
  glance: string[];
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
  /**
   * 집행부가 받아 가야 할 것 — 자료요구·지적사항·요청.
   *
   * 한 줄로만 적었더니 무슨 내용인지 알 수가 없었다. 제목과 본문을 나누고
   * 둘 다 **개조식**으로 쓴다. `~지적이 있었다` 같은 서술은 쓰지 않는다.
   *   title  "인수위 명의 공문 발송의 법적 근거 확인·설명 필요"
   *   body   ["교육감 임기 시작 전 인수위 요청으로 공문 발송", "비용 발생 여부 불명", …]
   */
  asks: {
    type: '자료요구' | '지적사항' | '요청';
    dept?: string | null;
    member?: string | null;
    /** 개조식 한 줄. 명사형으로 끝낸다. */
    title: string;
    /** 개조식 항목들. 무엇이 문제이고 무엇을 해야 하는지. */
    body: string[];
    quote?: string | null;
    speaker?: string | null;
    turn?: number | null;
  }[];
}

export interface DialogTurn {
  i: number;
  role: '의원' | '집행부' | '전문위원' | '기타';
  speaker: string;
  dept: string | null;
  text: string;
}

/**
 * 한 위원이 한 안건에서 **한 부서를 상대로 주고받은 덩어리**.
 *
 * 예전에는 답변 하나마다 한 건으로 쪼갰다. 그랬더니 같은 주제로 열 번 주고받은
 * 대목이 열 개 카드가 됐고, 회의록 전문에 필터만 씌운 것과 다를 게 없었다.
 */
export interface Dialog {
  meeting: string;
  date: string;
  agenda: string;
  /** 질의한 위원. 업무보고·제안설명처럼 질의 없이 시작한 대목은 null. */
  member: string | null;
  /** 이 덩어리에서 답한 기관들 */
  depts: string[];
  /** 오간 말에 이름이 나온 다른 부서 */
  mentions: string[];
  turns: DialogTurn[];
  turnCount: number;
  startTurn: number;
  endTurn: number;
}

export interface DeptStat {
  name: string;
  kind: string;
  /** 상위 국. 회의록의 안건 제목에서 읽어낸 값이라 없을 수 있다. */
  bureau: string | null;
  /** 이 부서 사람이 직접 답한 발언 수 */
  answerCount: number;
  /** 이 부서 이름이 질의·답변 본문에 나온 질의응답 수 */
  mentionCount: number;
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
  /** 홈 추천 검색어 — 실제 회의록에서 세어 만든 것이라 0건이 나올 수 없다 */
  topics: { word: string; count: number }[];
  depts: DeptStat[];
  members: MemberStat[];
  agendas: { meeting: string; date: string; title: string }[];
  /** 오간 말은 dialogs.json 에 따로 있다. 여기는 개수만. */
  dialogCount: number;
}

export const emptyDerived: DerivedDoc = {
  topics: [], depts: [], members: [], agendas: [], dialogCount: 0,
};

/** 탭 이동. `focus` 는 부서명·의원명처럼 그 탭에서 바로 펼쳐 볼 대상. */
export type Navigate = (
  tab: ActiveTab,
  opts?: { query?: string; meetingId?: string; focus?: string; turn?: number },
) => void;
