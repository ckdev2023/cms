import {
  addLocalCalendarDays,
  calendarDaysUntil,
  formatLocalDateYyyyMmDd,
} from './visa-case.mapper';

describe('visa-case.mapper date helpers', () => {
  it('formats pg date string YYYY-MM-DD as local calendar', () => {
    expect(formatLocalDateYyyyMmDd('2027-06-15')).toBe('2027-06-15');
  });

  it('computes calendarDaysUntil when expireDate is pg date string', () => {
    const from = new Date(2026, 3, 4);
    expect(calendarDaysUntil('2027-01-01', from)).toBe(272);
  });

  it('addLocalCalendarDays accepts date-only string base', () => {
    const out = addLocalCalendarDays('2026-04-01', 5);
    expect(out.getFullYear()).toBe(2026);
    expect(out.getMonth()).toBe(3);
    expect(out.getDate()).toBe(6);
  });

  it('rejects invalid date string', () => {
    expect(() => formatLocalDateYyyyMmDd('not-a-date')).toThrow(TypeError);
  });
});
