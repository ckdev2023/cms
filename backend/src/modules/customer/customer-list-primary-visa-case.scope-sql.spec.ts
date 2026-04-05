import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import { buildPrimaryVisaCaseRawScopeClause } from './customer-list-primary-visa-case.scope-sql';

describe('buildPrimaryVisaCaseRawScopeClause', () => {
  it('returns empty fragment for all scope', () => {
    const r: ResolvedVisaDataScope = { mode: 'all' };
    expect(buildPrimaryVisaCaseRawScopeClause('vc', r)).toEqual({
      sql: '',
      paramValues: [],
    });
  });

  it('returns single assigned_to predicate for mine scope', () => {
    const r: ResolvedVisaDataScope = { mode: 'mine', userId: 'u-1' };
    expect(buildPrimaryVisaCaseRawScopeClause('vc', r)).toEqual({
      sql: ' AND vc.assigned_to = $4',
      paramValues: ['u-1'],
    });
  });

  it('returns OR+ANY predicate for team scope', () => {
    const r: ResolvedVisaDataScope = {
      mode: 'team',
      currentUserId: 'u-1',
      teamAssigneeIds: ['u-1', 'u-2'],
    };
    expect(buildPrimaryVisaCaseRawScopeClause('x', r)).toEqual({
      sql: ' AND (x.assigned_to = $4 OR (x.assigned_to IS NOT NULL AND x.assigned_to = ANY($5::uuid[])))',
      paramValues: ['u-1', ['u-1', 'u-2']],
    });
  });
});
