import { describe, it, expect } from 'vitest';
import { computeWorkLogBackfill, type LogWithRoutineContext } from './worklog-weekstart';

describe('computeWorkLogBackfill', () => {
  it('returns empty updates and orphans for empty input', () => {
    const result = computeWorkLogBackfill([]);
    expect(result.updates).toEqual([]);
    expect(result.orphans).toEqual([]);
  });

  it('maps each log to its routine weekStart', () => {
    const logs: LogWithRoutineContext[] = [
      { id: 'log-1', routineWeekStart: '2026-04-20' },
      { id: 'log-2', routineWeekStart: '2026-04-20' },
      { id: 'log-3', routineWeekStart: '2026-03-23' },
    ];
    const result = computeWorkLogBackfill(logs);
    expect(result.updates).toEqual([
      { id: 'log-1', weekStart: '2026-04-20' },
      { id: 'log-2', weekStart: '2026-04-20' },
      { id: 'log-3', weekStart: '2026-03-23' },
    ]);
    expect(result.orphans).toEqual([]);
  });

  it('separates logs without routineWeekStart into orphans', () => {
    const logs: LogWithRoutineContext[] = [
      { id: 'log-1', routineWeekStart: '2026-04-20' },
      { id: 'log-orphan', routineWeekStart: null },
    ];
    const result = computeWorkLogBackfill(logs);
    expect(result.updates).toEqual([{ id: 'log-1', weekStart: '2026-04-20' }]);
    expect(result.orphans).toEqual(['log-orphan']);
  });

  it('treats undefined routineWeekStart as orphan', () => {
    const logs: LogWithRoutineContext[] = [
      { id: 'log-undef', routineWeekStart: undefined },
    ];
    const result = computeWorkLogBackfill(logs);
    expect(result.updates).toEqual([]);
    expect(result.orphans).toEqual(['log-undef']);
  });

  it('rejects empty-string routineWeekStart as orphan (defensive)', () => {
    const logs: LogWithRoutineContext[] = [
      { id: 'log-empty', routineWeekStart: '' },
    ];
    const result = computeWorkLogBackfill(logs);
    expect(result.orphans).toEqual(['log-empty']);
  });
});
