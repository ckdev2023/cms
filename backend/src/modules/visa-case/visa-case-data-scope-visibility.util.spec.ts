import { isVisaCaseAssignedRowInResolvedScope } from './visa-case-data-scope-visibility.util';

describe('isVisaCaseAssignedRowInResolvedScope', () => {
  it('returns true for all scope', () => {
    expect(isVisaCaseAssignedRowInResolvedScope(null, { mode: 'all' })).toBe(
      true,
    );
  });

  it('mine excludes unassigned rows', () => {
    expect(
      isVisaCaseAssignedRowInResolvedScope(null, {
        mode: 'mine',
        userId: 'u1',
      }),
    ).toBe(false);
  });

  it('mine matches assigned_to equal user', () => {
    expect(
      isVisaCaseAssignedRowInResolvedScope('u1', {
        mode: 'mine',
        userId: 'u1',
      }),
    ).toBe(true);
  });

  it('team includes self even if assignee list omits edge', () => {
    expect(
      isVisaCaseAssignedRowInResolvedScope('u1', {
        mode: 'team',
        currentUserId: 'u1',
        teamAssigneeIds: ['u2'],
      }),
    ).toBe(true);
  });

  it('team excludes unassigned', () => {
    expect(
      isVisaCaseAssignedRowInResolvedScope(null, {
        mode: 'team',
        currentUserId: 'u1',
        teamAssigneeIds: ['u1', 'u2'],
      }),
    ).toBe(false);
  });

  it('team includes teammate assignee', () => {
    expect(
      isVisaCaseAssignedRowInResolvedScope('u2', {
        mode: 'team',
        currentUserId: 'u1',
        teamAssigneeIds: ['u1', 'u2'],
      }),
    ).toBe(true);
  });
});
