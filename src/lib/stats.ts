import type { DeptStat, Exchange, MemberStat } from '../types';

/**
 * 회차를 좁혔을 때 집계를 다시 센다.
 *
 * derived.json 에 들어 있는 집계는 **전 회차 합계**다. 회차를 고르면 그 숫자가
 * 그대로 남아 있으면 안 된다 — 목록에는 3건만 보이는데 카드에는 33건이라고
 * 적혀 있으면 어느 쪽을 믿어야 할지 알 수 없다.
 *
 * 그래서 회차를 고른 순간에는 화면에 보이는 질의응답으로 숫자를 다시 만든다.
 * 전체 보기일 때는 derived.json 의 값을 그대로 쓴다(같은 값이고 더 빠르다).
 */

function toPairs(m: Map<string, number>) {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function deptStatsFor(base: DeptStat[], ex: Exchange[]): DeptStat[] {
  const answer = new Map<string, number>();
  const mention = new Map<string, number>();
  const members = new Map<string, Map<string, number>>();
  const meetings = new Map<string, Map<string, number>>();

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  ex.forEach((e) => {
    bump(answer, e.dept);
    bump(meetings.get(e.dept) ?? meetings.set(e.dept, new Map()).get(e.dept)!, e.meeting);
    e.mentions.forEach((name) => {
      bump(mention, name);
      bump(meetings.get(name) ?? meetings.set(name, new Map()).get(name)!, e.meeting);
    });
    // 질의한 위원은 **짝이 확실한 것만** 센다. 국장이 답하다 과장이 이어받은
    // 자리에서 앞의 의원 발언을 그 과장에게 한 질의로 세면 통계가 조용히 틀어진다.
    if (e.member && e.direct) {
      const bag = members.get(e.dept) ?? members.set(e.dept, new Map()).get(e.dept)!;
      bump(bag, e.member);
    }
  });

  return base
    .map((d) => ({
      ...d,
      answerCount: answer.get(d.name) ?? 0,
      mentionCount: mention.get(d.name) ?? 0,
      meetings: toPairs(meetings.get(d.name) ?? new Map()).map((p) => ({ id: p.name, count: p.count })),
      members: toPairs(members.get(d.name) ?? new Map()),
    }))
    .filter((d) => d.answerCount + d.mentionCount > 0);
}

export function memberStatsFor(base: MemberStat[], ex: Exchange[]): MemberStat[] {
  const turns = new Map<string, number>();
  const depts = new Map<string, Map<string, number>>();
  const meetings = new Map<string, Map<string, number>>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  ex.forEach((e) => {
    if (!e.member) return;
    bump(turns, e.member);
    bump(meetings.get(e.member) ?? meetings.set(e.member, new Map()).get(e.member)!, e.meeting);
    if (e.direct) {
      const bag = depts.get(e.member) ?? depts.set(e.member, new Map()).get(e.member)!;
      bump(bag, e.dept);
    }
  });

  return base
    .map((m) => ({
      ...m,
      // 회차를 좁혔을 때의 `turnCount` 는 '발언 수' 가 아니라
      // **그 위원 뒤에 붙은 답변 수**다. 이름을 바꿔 쓰지 않고 화면에서 설명한다.
      turnCount: turns.get(m.name) ?? 0,
      depts: toPairs(depts.get(m.name) ?? new Map()),
      meetings: toPairs(meetings.get(m.name) ?? new Map()).map((p) => ({ id: p.name, count: p.count })),
    }))
    .filter((m) => m.turnCount > 0);
}
