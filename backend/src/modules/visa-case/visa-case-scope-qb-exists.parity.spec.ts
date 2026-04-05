import { SelectQueryBuilder } from 'typeorm';

import {
  applyVisaCaseDataScopeToQueryBuilder,
  buildVisaCaseDataScopeExistsFragment,
} from './visa-case-data-scope.query';
import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';

/**
 * 从 mock QueryBuilder 的 `setParameter` 调用中取出指定键的值。
 *
 * @param setParameterMock - `setParameter` jest mock
 * @param key - 参数名
 * @returns 最后一次绑定到该键的值；未调用时 undefined
 */
function lastSetParameterValue(
  setParameterMock: jest.Mock,
  key: string,
): unknown {
  const calls = setParameterMock.mock.calls as [string, unknown][];
  let last: unknown;
  for (const [k, v] of calls) {
    if (k === key) last = v;
  }
  return last;
}

/**
 * Phase F1b：客户列表 EXISTS（`buildVisaCaseDataScopeExistsFragment`）与案件/提醒 QueryBuilder
 *（`applyVisaCaseDataScopeToQueryBuilder`）对同一 `ResolvedVisaDataScope` 绑定相同的负责人键值，
 * 与 `VisaCaseReminderService.loadReminderCandidateCases` 所用 QB 路径一致。
 */
describe('F1b: visa data scope QueryBuilder vs EXISTS fragment parity', () => {
  const rows: { label: string; resolved: ResolvedVisaDataScope }[] = [
    { label: 'all', resolved: { mode: 'all' } },
    { label: 'mine', resolved: { mode: 'mine', userId: 'user-42' } },
    {
      label: 'team',
      resolved: {
        mode: 'team',
        currentUserId: 'user-42',
        teamAssigneeIds: ['user-42', 'peer-9'],
      },
    },
  ];

  it.each(rows)(
    'aligns EXISTS params with QB scope for $label',
    ({ resolved }) => {
      const andWhere = jest.fn().mockReturnThis();
      const setParameter = jest.fn().mockReturnThis();
      const qb = { andWhere, setParameter } as unknown as SelectQueryBuilder<
        Record<string, unknown>
      >;

      applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'parity');
      const frag = buildVisaCaseDataScopeExistsFragment(
        'vf',
        resolved,
        'parity',
      );

      if (resolved.mode === 'all') {
        expect(andWhere).not.toHaveBeenCalled();
        expect(frag.sql).toBe('');
        expect(frag.params).toEqual({});
        return;
      }

      if (resolved.mode === 'mine') {
        expect(andWhere).toHaveBeenCalled();
        const calls = andWhere.mock.calls as Array<
          [unknown, Record<string, unknown>?]
        >;
        const mineCall = calls.find((c) => {
          const first = c[0];
          return (
            typeof first === 'string' &&
            first.includes('vc.assignedTo = :parityMine')
          );
        });
        expect(mineCall?.[1]).toEqual({ parityMine: resolved.userId });
        expect(frag.params.parityMine).toBe(resolved.userId);
        return;
      }

      expect(lastSetParameterValue(setParameter, 'parityTeam')).toEqual(
        resolved.teamAssigneeIds,
      );
      expect(frag.params.parityUid).toBe(resolved.currentUserId);
      expect(frag.params.parityTeam).toEqual(resolved.teamAssigneeIds);
    },
  );
});
