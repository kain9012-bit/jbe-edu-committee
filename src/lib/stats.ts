import type { DeptStat, Dialog, MemberStat } from '../types';

/**
 * 회차를 좁혔을 때 집계를 다시 센다.
 *
 * derived.json 에 들어 있는 집계는 **전 회차 합계**다. 회차를 고르면 그 숫자가
 * 그대로 남아 있으면 안 된다 — 목록에는 3건만 보이는데 카드에는 33건이라고
 * 적혀 있으면 어느 쪽을 믿어야 할지 알 수 없다.
 *
 * 전체 보기일 때는 derived.json 의 값을 그대로 쓴다(같은 값이고 더 빠르다).
 */

function toPairs(m: Map<string, number>) {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const nest = (m: Map<string, Map<string, number>>, k: string) =>
  m.get(k) ?? m.set(k, new Map()).get(k)!;

export function deptStatsFor(base: DeptStat[], dialogs: Dialog[]): DeptStat[] {
  const answer = new Map<string, number>();
  const mention = new Map<string, number>();
  const members = new Map<string, Map<string, number>>();
  const meetings = new Map<string, Map<string, number>>();

  dialogs.forEach((d) => {
    // 답변 수는 **발언 수**로 센다. 덩어리 수로 세면 한 번 길게 주고받은 것과
    // 짧게 여러 번 주고받은 것이 같아 보인다.
    const perDept = new Map<string, number>();
    d.turns.forEach((t) => { if (t.dept) bump(perDept, t.dept); });
    perDept.forEach((n, name) => {
      bump(answer, name, n);
      bump(nest(meetings, name), d.meeting);
    });
    d.mentions.forEach((name) => {
      bump(mention, name);
      bump(nest(meetings, name), d.meeting);
    });
    // 누가 물었나 — 덩어리 단위. 답변 수로 세면 말을 많이 받아낸 위원이
    // 더 집요해 보인다.
    if (d.member) d.depts.forEach((name) => bump(nest(members, name), d.member!));
  });

  return base
    .map((d) => ({
      ...d,
      answerCount: answer.get(d.name) ?? 0,
      mentionCount: mention.get(d.name) ?? 0,
      meetings: toPairs(meetings.get(d.name) ?? new Map())
        .map((p) => ({ id: p.name, count: p.count })),
      members: toPairs(members.get(d.name) ?? new Map()),
    }))
    .filter((d) => d.answerCount + d.mentionCount > 0);
}

export function memberStatsFor(base: MemberStat[], dialogs: Dialog[]): MemberStat[] {
  const turns = new Map<string, number>();
  const depts = new Map<string, Map<string, number>>();
  const meetings = new Map<string, Map<string, number>>();

  dialogs.forEach((d) => {
    if (!d.member) return;
    bump(turns, d.member, d.turns.filter((t) => t.role === '의원').length);
    bump(nest(meetings, d.member), d.meeting);
    d.depts.forEach((name) => bump(nest(depts, d.member!), name));
  });

  return base
    .map((m) => ({
      ...m,
      turnCount: turns.get(m.name) ?? 0,
      depts: toPairs(depts.get(m.name) ?? new Map()),
      meetings: toPairs(meetings.get(m.name) ?? new Map())
        .map((p) => ({ id: p.name, count: p.count })),
    }))
    .filter((m) => m.turnCount > 0);
}
