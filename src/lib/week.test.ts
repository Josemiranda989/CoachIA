import { describe, it, expect } from 'vitest';
import { getCurrentWeekStart } from './week';

describe('getCurrentWeekStart', () => {
  it('returns the same Monday for a Monday in ART', () => {
    const monday = new Date('2026-04-20T15:00:00Z');
    expect(getCurrentWeekStart(monday)).toBe('2026-04-20');
  });

  it('returns the previous Monday for a Wednesday', () => {
    const wednesday = new Date('2026-04-22T18:00:00Z');
    expect(getCurrentWeekStart(wednesday)).toBe('2026-04-20');
  });

  it('returns the previous Monday for a Sunday late night in ART', () => {
    const sundayLate = new Date('2026-04-27T02:30:00Z');
    expect(getCurrentWeekStart(sundayLate)).toBe('2026-04-20');
  });

  it('crosses month boundary correctly (Wed 1-abr -> Mon 30-mar)', () => {
    const wedApril1 = new Date('2026-04-01T15:00:00Z');
    expect(getCurrentWeekStart(wedApril1)).toBe('2026-03-30');
  });

  it('crosses year boundary correctly (Fri 1-jan-2027 -> Mon 28-dec-2026)', () => {
    const friJan1 = new Date('2027-01-01T15:00:00Z');
    expect(getCurrentWeekStart(friJan1)).toBe('2026-12-28');
  });

  it('uses ART timezone: Monday 2AM UTC is still Sunday in ART -> previous Monday', () => {
    const mondayUTCButSundayART = new Date('2026-04-20T02:00:00Z');
    expect(getCurrentWeekStart(mondayUTCButSundayART)).toBe('2026-04-13');
  });
});
