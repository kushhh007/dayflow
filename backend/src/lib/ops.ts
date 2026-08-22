export const ATTENTION_WEIGHTS = {
  COVERAGE_RISK: 40,
  LOW_BALANCE_WARNING: 25,
  UNEXPLAINED_ABSENCE: 20,
  ATTENDANCE_ANOMALY: 15
} as const;

export type RuleName = keyof typeof ATTENTION_WEIGHTS;

export interface FlagItem {
  rule: RuleName;
  type: 'EMPLOYEE' | 'DEPARTMENT';
  refId: string;
  employeeId: string | null;
  label: string;
}

export interface BriefFlagGroup {
  rule: RuleName;
  points: number;
  count: number;
  items: Array<Omit<FlagItem, 'rule'>>;
}

export interface AttentionQueueEntry {
  type: 'EMPLOYEE' | 'DEPARTMENT';
  refId: string;
  employeeId: string | null;
  label: string;
  score: number;
  breakdown: Array<{ rule: RuleName; points: number }>;
}

export const EMPTY_BRIEF_MESSAGE =
  'No issues detected today. All attendance, leave, and payroll signals are within expected parameters.';

export function weightFor(rule: RuleName): number {
  return ATTENTION_WEIGHTS[rule];
}

export function groupBriefFlags(flags: FlagItem[]): BriefFlagGroup[] {
  const groups = new Map<RuleName, BriefFlagGroup>();
  for (const flag of flags) {
    let group = groups.get(flag.rule);
    if (!group) {
      group = { rule: flag.rule, points: weightFor(flag.rule), count: 0, items: [] };
      groups.set(flag.rule, group);
    }
    group.count += 1;
    const { rule: _rule, ...item } = flag;
    group.items.push(item);
  }
  return [...groups.values()];
}

export function buildAttentionQueue(flags: FlagItem[]): AttentionQueueEntry[] {
  const entries = new Map<string, AttentionQueueEntry>();
  for (const flag of flags) {
    const key = `${flag.type}:${flag.refId}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        type: flag.type,
        refId: flag.refId,
        employeeId: flag.employeeId,
        label: flag.label,
        score: 0,
        breakdown: []
      };
      entries.set(key, entry);
    }
    entry.score += weightFor(flag.rule);
    entry.breakdown.push({ rule: flag.rule, points: weightFor(flag.rule) });
  }
  return [...entries.values()].sort((a, b) => b.score - a.score);
}
