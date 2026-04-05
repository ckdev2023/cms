import { SelectQueryBuilder } from 'typeorm';

import {
  applyVisaCaseDataScopeToQueryBuilder,
  buildVisaCaseDataScopeExistsFragment,
} from './visa-case-data-scope.query';

describe('buildVisaCaseDataScopeExistsFragment', () => {
  it('returns empty fragment for all scope', () => {
    const r = buildVisaCaseDataScopeExistsFragment('vf', { mode: 'all' }, 'p');
    expect(r.sql).toBe('');
    expect(r.params).toEqual({});
  });

  it('returns mine clause with param', () => {
    const r = buildVisaCaseDataScopeExistsFragment(
      'vf',
      { mode: 'mine', userId: 'u-1' },
      'p',
    );
    expect(r.sql).toContain('vf.assigned_to = :pMine');
    expect(r.params).toEqual({ pMine: 'u-1' });
  });

  it('returns team clause with uid and IN list', () => {
    const r = buildVisaCaseDataScopeExistsFragment(
      'vf',
      {
        mode: 'team',
        currentUserId: 'u-1',
        teamAssigneeIds: ['u-1', 'u-2'],
      },
      'p',
    );
    expect(r.sql).toContain('vf.assigned_to = :pUid');
    expect(r.sql).toContain('IN (:...pTeam)');
    expect(r.params).toEqual({
      pUid: 'u-1',
      pTeam: ['u-1', 'u-2'],
    });
  });
});

describe('applyVisaCaseDataScopeToQueryBuilder', () => {
  it('does not call andWhere for all scope', () => {
    const andWhere = jest.fn().mockReturnThis();
    const setParameter = jest.fn().mockReturnThis();
    const qb = {
      andWhere,
      setParameter,
    } as unknown as SelectQueryBuilder<Record<string, unknown>>;

    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', { mode: 'all' }, 'x');

    expect(andWhere).not.toHaveBeenCalled();
  });

  it('applies mine as single assignedTo equality', () => {
    const andWhere = jest.fn().mockReturnThis();
    const setParameter = jest.fn().mockReturnThis();
    const qb = {
      andWhere,
      setParameter,
    } as unknown as SelectQueryBuilder<Record<string, unknown>>;

    applyVisaCaseDataScopeToQueryBuilder(
      qb,
      'vc',
      { mode: 'mine', userId: 'uid-a' },
      'm',
    );

    expect(andWhere).toHaveBeenCalledWith('vc.assignedTo = :mMine', {
      mMine: 'uid-a',
    });
  });

  it('applies team scope with andWhere and team id list parameter', () => {
    const andWhere = jest.fn().mockReturnThis();
    const setParameter = jest.fn().mockReturnThis();
    const qb = {
      andWhere,
      setParameter,
    } as unknown as SelectQueryBuilder<Record<string, unknown>>;

    applyVisaCaseDataScopeToQueryBuilder(
      qb,
      'vc',
      {
        mode: 'team',
        currentUserId: 'u-1',
        teamAssigneeIds: ['u-1', 'u-2'],
      },
      't',
    );

    expect(andWhere).toHaveBeenCalledTimes(1);
    expect(setParameter).toHaveBeenCalledWith('tTeam', ['u-1', 'u-2']);
  });
});
