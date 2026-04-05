import { VisaAlertLevel } from '../../common/constants/enums';
import {
  addCalendarDaysLocal,
  calendarDaysLeft,
  formatLocalDateOnly,
  resolveVisaAlertLevel,
} from './visa-alert.util';

describe('calendarDaysLeft', () => {
  it('returns 0 when expire date is today', () => {
    const today = new Date('2026-06-15');
    expect(calendarDaysLeft(new Date('2026-06-15'), today)).toBe(0);
  });

  it('returns positive days for future dates', () => {
    const today = new Date('2026-01-01');
    expect(calendarDaysLeft(new Date('2026-04-01'), today)).toBe(90);
  });

  it('returns negative days for past dates', () => {
    const today = new Date('2026-06-16');
    expect(calendarDaysLeft(new Date('2026-06-15'), today)).toBe(-1);
  });

  it('accepts PostgreSQL date-only string (YYYY-MM-DD) without throwing', () => {
    const today = new Date('2026-01-01');
    expect(calendarDaysLeft('2026-04-01', today)).toBe(90);
  });

  it('treats numeric epoch ms consistently with the same instant as Date', () => {
    const today = new Date(2026, 0, 1);
    const expire = new Date(2026, 3, 1);
    expect(calendarDaysLeft(expire.getTime(), today)).toBe(
      calendarDaysLeft(expire, today),
    );
  });
});

describe('resolveVisaAlertLevel', () => {
  it('returns null for daysLeft=120 (case 1)', () => {
    expect(resolveVisaAlertLevel(120)).toBeNull();
  });

  it('returns null for daysLeft=91 (case 2)', () => {
    expect(resolveVisaAlertLevel(91)).toBeNull();
  });

  it('returns NORMAL for daysLeft=90 (case 3)', () => {
    expect(resolveVisaAlertLevel(90)).toBe(VisaAlertLevel.NORMAL);
  });

  it('returns NORMAL for daysLeft=31 (case 4)', () => {
    expect(resolveVisaAlertLevel(31)).toBe(VisaAlertLevel.NORMAL);
  });

  it('returns HIGH for daysLeft=30 (case 5)', () => {
    expect(resolveVisaAlertLevel(30)).toBe(VisaAlertLevel.HIGH);
  });

  it('returns HIGH for daysLeft=8 (case 6)', () => {
    expect(resolveVisaAlertLevel(8)).toBe(VisaAlertLevel.HIGH);
  });

  it('returns URGENT for daysLeft=7 (case 7)', () => {
    expect(resolveVisaAlertLevel(7)).toBe(VisaAlertLevel.URGENT);
  });

  it('returns URGENT for daysLeft=0 (case 8)', () => {
    expect(resolveVisaAlertLevel(0)).toBe(VisaAlertLevel.URGENT);
  });

  it('returns EXPIRED for daysLeft=-1 (case 9)', () => {
    expect(resolveVisaAlertLevel(-1)).toBe(VisaAlertLevel.EXPIRED);
  });
});

describe('addCalendarDaysLocal / formatLocalDateOnly', () => {
  it('uses local calendar date for cutoff strings (avoids UTC day shift)', () => {
    const base = new Date(2026, 5, 15, 23, 59, 59);
    expect(formatLocalDateOnly(base)).toBe('2026-06-15');
    expect(formatLocalDateOnly(addCalendarDaysLocal(base, 90))).toBe(
      '2026-09-13',
    );
  });
});

describe('integration: calendarDaysLeft → resolveVisaAlertLevel', () => {
  it('combines correctly for a date 90 days away', () => {
    const today = new Date('2026-01-01');
    const expire = new Date('2026-04-01');
    const days = calendarDaysLeft(expire, today);
    expect(days).toBe(90);
    expect(resolveVisaAlertLevel(days)).toBe(VisaAlertLevel.NORMAL);
  });

  it('combines correctly for a date 91 days away → no alert', () => {
    const today = new Date('2026-01-01');
    const expire = new Date('2026-04-02');
    const days = calendarDaysLeft(expire, today);
    expect(days).toBe(91);
    expect(resolveVisaAlertLevel(days)).toBeNull();
  });
});
