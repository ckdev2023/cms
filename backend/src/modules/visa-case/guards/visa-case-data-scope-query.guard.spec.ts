import { ForbiddenException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { VisaDataScope } from '../../../common/constants/enums';
import { VisaCaseDataScopePermissionService } from '../visa-case-data-scope-permission.service';
import { VisaCaseDataScopeQueryGuard } from './visa-case-data-scope-query.guard';

describe('VisaCaseDataScopeQueryGuard', () => {
  const loadPermissionCodesForUser = jest.fn();
  const assertQueryDataScopeAllowed = jest.fn();

  const buildGuard = (): VisaCaseDataScopeQueryGuard =>
    new VisaCaseDataScopeQueryGuard({
      loadPermissionCodesForUser,
      assertQueryDataScopeAllowed,
    } as unknown as VisaCaseDataScopePermissionService);

  beforeEach(() => {
    jest.clearAllMocks();
    loadPermissionCodesForUser.mockResolvedValue(new Set(['visaCase:list']));
  });

  it('throws Forbidden when user id is missing', async () => {
    const guard = buildGuard();
    const ctx = new ExecutionContextHost([{ user: {}, query: {} }, {}, {}, {}]);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(assertQueryDataScopeAllowed).not.toHaveBeenCalled();
  });

  it('skips assert when dataScope query is invalid and defers to ValidationPipe', async () => {
    const guard = buildGuard();
    const ctx = new ExecutionContextHost([
      { user: { id: 'u1' }, query: { dataScope: 'bogus' } },
      {},
      {},
      {},
    ]);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(assertQueryDataScopeAllowed).not.toHaveBeenCalled();
  });

  it('calls assertQueryDataScopeAllowed with parsed mine scope', async () => {
    const guard = buildGuard();
    const ctx = new ExecutionContextHost([
      { user: { id: 'u1' }, query: { dataScope: 'mine' } },
      {},
      {},
      {},
    ]);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(loadPermissionCodesForUser).toHaveBeenCalledWith('u1');
    expect(assertQueryDataScopeAllowed).toHaveBeenCalledWith(
      expect.any(Set),
      VisaDataScope.MINE,
    );
  });

  it('passes undefined requested scope when dataScope omitted (defaults to all in service)', async () => {
    const guard = buildGuard();
    const ctx = new ExecutionContextHost([
      { user: { id: 'u1' }, query: {} },
      {},
      {},
      {},
    ]);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(assertQueryDataScopeAllowed).toHaveBeenCalledWith(
      expect.any(Set),
      undefined,
    );
  });
});
