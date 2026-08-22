import { describe, expect, it } from 'vitest';
import {
  ATTENTION_WEIGHTS,
  buildAttentionQueue,
  groupBriefFlags,
  type FlagItem
} from '../src/lib/ops.js';

const absence: FlagItem = {
  rule: 'UNEXPLAINED_ABSENCE',
  type: 'EMPLOYEE',
  refId: 'emp-1',
  employeeId: 'emp-1',
  label: 'John Doe marked ABSENT with no leave'
};

const anomaly: FlagItem = {
  rule: 'ATTENDANCE_ANOMALY',
  type: 'EMPLOYEE',
  refId: 'emp-1',
  employeeId: 'emp-1',
  label: 'John Doe PRESENT without check-in'
};

const coverage: FlagItem = {
  rule: 'COVERAGE_RISK',
  type: 'DEPARTMENT',
  refId: 'dept-1',
  employeeId: null,
  label: 'Engineering coverage risk HIGH'
};

const lowBalance: FlagItem = {
  rule: 'LOW_BALANCE_WARNING',
  type: 'EMPLOYEE',
  refId: 'emp-2',
  employeeId: 'emp-2',
  label: 'Jane Ray PAID balance at 95%'
};

describe('groupBriefFlags', () => {
  it('groups flags by rule with counts and weights', () => {
    const groups = groupBriefFlags([absence, anomaly, coverage]);
    expect(groups).toHaveLength(3);

    const byRule = new Map(groups.map((g) => [g.rule, g]));
    expect(byRule.get('UNEXPLAINED_ABSENCE')?.count).toBe(1);
    expect(byRule.get('ATTENDANCE_ANOMALY')?.count).toBe(1);
    expect(byRule.get('COVERAGE_RISK')?.points).toBe(40);
  });

  it('counts multiple flags of the same rule', () => {
    const groups = groupBriefFlags([absence, absence]);
    expect(groups[0].count).toBe(2);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('buildAttentionQueue (spec §10 stacking)', () => {
  it('stacks scores for the same item and shows the breakdown', () => {
    const queue = buildAttentionQueue([absence, anomaly, lowBalance]);

    expect(queue[0].refId).toBe('emp-1');
    expect(queue[0].score).toBe(
      ATTENTION_WEIGHTS.UNEXPLAINED_ABSENCE + ATTENTION_WEIGHTS.ATTENDANCE_ANOMALY
    );
    expect(queue[0].breakdown).toHaveLength(2);
    expect(queue[0].score).toBe(35);
  });

  it('keeps department items separate from employees', () => {
    const queue = buildAttentionQueue([coverage, lowBalance]);
    expect(queue.map((q) => q.type)).toEqual(['DEPARTMENT', 'EMPLOYEE']);
    expect(queue[0].employeeId).toBeNull();
  });

  it('sorts descending by stacked score', () => {
    const queue = buildAttentionQueue([lowBalance, absence, anomaly, coverage, coverage]);
    expect(queue.map((q) => q.score)).toEqual([80, 35, 25]);
  });
});
