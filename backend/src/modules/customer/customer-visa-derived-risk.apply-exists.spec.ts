import type { SelectQueryBuilder } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { applyCustomerListVisaReminderBucketExists } from './customer-visa-derived-risk.query';
import type { Customer } from './entities/customer.entity';

/**
 * 构造最小 QueryBuilder mock，记录 `setParameter` / `andWhere` 调用，供 EXISTS 片段单测使用。
 *
 * @returns mock 与调用记录
 */
function createCustomerQbMock(): {
  qb: SelectQueryBuilder<Customer>;
  setParameterMock: jest.Mock;
  andWhereMock: jest.Mock;
} {
  const setParameterMock = jest.fn().mockReturnThis();
  const andWhereMock = jest.fn().mockReturnThis();
  const qb = {
    setParameter: setParameterMock,
    andWhere: andWhereMock,
  } as unknown as SelectQueryBuilder<Customer>;
  return { qb, setParameterMock, andWhereMock };
}

/**
 * 将 `andWhere` mock 的各次调用首参（字符串条件）拼接，便于断言原生 SQL 片段。
 *
 * @param m - jest mock
 * @returns 拼接后的 SQL 文本
 */
function joinFirstArgStrings(m: jest.Mock): string {
  const calls = m.mock.calls as unknown[][];
  return calls
    .map((c) => {
      const first = c[0];
      return typeof first === 'string' ? first : '';
    })
    .join('\n');
}

/** docs/25 §12.4 C3：`visaReminderBucket` EXISTS 与全局列表 reminderBucket 语义对齐。 */
describe('applyCustomerListVisaReminderBucketExists / supplement & today follow-up', () => {
  const today = '2026-04-04';

  it('SUPPLEMENT: sets today / excluded / supplement status and applies EXISTS', () => {
    const { qb, setParameterMock, andWhereMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.SUPPLEMENT,
      today,
      [],
      { mode: 'all' },
    );
    expect(setParameterMock).toHaveBeenCalledWith('clexToday', today);
    expect(setParameterMock).toHaveBeenCalledWith(
      'clexExcluded',
      expect.arrayContaining([
        VisaCaseStatus.COMPLETED,
        VisaCaseStatus.CANCELLED,
      ]),
    );
    expect(setParameterMock).toHaveBeenCalledWith(
      'clexSupSt',
      VisaCaseStatus.SUPPLEMENT,
    );
    expect(andWhereMock).toHaveBeenCalled();
  });

  it('SUPPLEMENT with log-hit ids: binds clexSuppIds for NOT IN / IN branches', () => {
    const { qb, setParameterMock } = createCustomerQbMock();
    const ids = ['case-a', 'case-b'];
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.SUPPLEMENT,
      today,
      ids,
      { mode: 'all' },
    );
    expect(setParameterMock).toHaveBeenCalledWith('clexSuppIds', ids);
  });

  it('TODAY_FOLLOW_UP: applies calendar-day match on next_follow_up_at', () => {
    const { qb, andWhereMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.TODAY_FOLLOW_UP,
      today,
      [],
      { mode: 'all' },
    );
    expect(andWhereMock).toHaveBeenCalled();
    expect(joinFirstArgStrings(andWhereMock)).toContain(
      'DATE(vf.next_follow_up_at) = CAST(:clexToday AS date)',
    );
  });
});

describe('applyCustomerListVisaReminderBucketExists / expire windows & data scope', () => {
  const today = '2026-04-04';

  it('EXPIRING_7_DAYS: requires expire_date window <= 7 after higher-priority exclusions', () => {
    const { qb, andWhereMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.EXPIRING_7_DAYS,
      today,
      [],
      { mode: 'all' },
    );
    expect(andWhereMock).toHaveBeenCalled();
    expect(joinFirstArgStrings(andWhereMock)).toContain(
      '(vf.expire_date - CAST(:clexToday AS date)) <= 7',
    );
  });

  it('EXPIRING_2_MONTHS: uses (7, 60] day window per docs/25 §12.5', () => {
    const { qb, andWhereMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.EXPIRING_2_MONTHS,
      today,
      [],
      { mode: 'all' },
    );
    const joined = joinFirstArgStrings(andWhereMock);
    expect(joined).toContain('(vf.expire_date - CAST(:clexToday AS date)) > 7');
    expect(joined).toContain(
      '(vf.expire_date - CAST(:clexToday AS date)) <= 60',
    );
  });

  it('merges mine data scope fragment parameters on vf (docs/25 §4.4 EXISTS + scope)', () => {
    const { qb, setParameterMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.SUPPLEMENT,
      today,
      [],
      { mode: 'mine', userId: 'user-99' },
    );
    expect(setParameterMock).toHaveBeenCalledWith('clexVdsMine', 'user-99');
  });

  /** Phase F1b：团队档位 EXISTS 与 `applyVisaCaseDataScopeToQueryBuilder` 共用 `buildVisaCaseDataScopeExistsFragment` 参数语义。 */
  it('merges team data scope uid + IN list parameters on vf (F1b / docs/27)', () => {
    const { qb, setParameterMock, andWhereMock } = createCustomerQbMock();
    applyCustomerListVisaReminderBucketExists(
      qb,
      VisaReminderType.EXPIRING_7_DAYS,
      today,
      [],
      {
        mode: 'team',
        currentUserId: 'lead-1',
        teamAssigneeIds: ['lead-1', 'member-2'],
      },
    );
    expect(setParameterMock).toHaveBeenCalledWith('clexVdsUid', 'lead-1');
    expect(setParameterMock).toHaveBeenCalledWith('clexVdsTeam', [
      'lead-1',
      'member-2',
    ]);
    expect(joinFirstArgStrings(andWhereMock)).toContain(
      'vf.assigned_to = :clexVdsUid',
    );
    expect(joinFirstArgStrings(andWhereMock)).toContain('IN (:...clexVdsTeam)');
  });
});
