import { VisaReminderType } from '../../common/constants/enums';
import {
  buildOpenCasePrimaryBucketRankCaseSql,
  mapMinRankToVisaReminderType,
} from './customer-visa-derived-risk.query';

describe('customer-visa-derived-risk.query', () => {
  describe('buildOpenCasePrimaryBucketRankCaseSql', () => {
    it('embeds supplement status check without log-id list when includeSupplementIdList is false', () => {
      const sql = buildOpenCasePrimaryBucketRankCaseSql('vc', false);
      expect(sql).toContain('vc.caseStatus = :cvDrSupSt');
      expect(sql).not.toContain('vc.id IN');
    });

    it('embeds OR id IN list when includeSupplementIdList is true (docs/25 §12.5 补件)', () => {
      const sql = buildOpenCasePrimaryBucketRankCaseSql('vc', true);
      expect(sql).toContain(
        '(vc.caseStatus = :cvDrSupSt OR vc.id IN (:...cvDrSupIds))',
      );
    });

    it('uses 7-day and 60-day calendar windows on expireDate (docs/25 §12.5)', () => {
      const sql = buildOpenCasePrimaryBucketRankCaseSql('vc', false);
      expect(sql).toContain('(vc.expireDate - CAST(:cvDrToday AS date)) <= 7');
      expect(sql).toContain('(vc.expireDate - CAST(:cvDrToday AS date)) > 7');
      expect(sql).toContain('(vc.expireDate - CAST(:cvDrToday AS date)) <= 60');
    });
  });

  describe('mapMinRankToVisaReminderType', () => {
    it('maps numeric ranks 0–3 to reminder types', () => {
      expect(mapMinRankToVisaReminderType(0)).toBe(VisaReminderType.SUPPLEMENT);
      expect(mapMinRankToVisaReminderType(1)).toBe(
        VisaReminderType.TODAY_FOLLOW_UP,
      );
      expect(mapMinRankToVisaReminderType(2)).toBe(
        VisaReminderType.EXPIRING_7_DAYS,
      );
      expect(mapMinRankToVisaReminderType(3)).toBe(
        VisaReminderType.EXPIRING_2_MONTHS,
      );
    });

    it('accepts string ranks from drivers', () => {
      expect(mapMinRankToVisaReminderType('2')).toBe(
        VisaReminderType.EXPIRING_7_DAYS,
      );
    });

    it('returns null for empty or unknown ranks', () => {
      expect(mapMinRankToVisaReminderType(null)).toBeNull();
      expect(mapMinRankToVisaReminderType(undefined)).toBeNull();
      expect(mapMinRankToVisaReminderType('')).toBeNull();
      expect(mapMinRankToVisaReminderType(99)).toBeNull();
      expect(mapMinRankToVisaReminderType('x')).toBeNull();
    });
  });
});
