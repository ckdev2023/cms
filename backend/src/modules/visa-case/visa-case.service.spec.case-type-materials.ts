import { getRepositoryToken } from '@nestjs/typeorm';

import { MaterialTemplate } from './entities/material-template.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import type { RepoMock } from './material-checklist.spec.helpers';
import type {
  ContextAccessor,
  ServiceTestContext,
} from './visa-case.service.spec-helpers';
import { buildVisaCaseRecord } from './visa-case.service.spec-helpers';
import { VisaCaseMaterialService } from './visa-case-material.service';

function templateRepoMock(ctx: ServiceTestContext): RepoMock {
  return ctx.module.get<RepoMock>(getRepositoryToken(MaterialTemplate));
}

function materialItemsRepoMock(ctx: ServiceTestContext): RepoMock {
  return ctx.module.get<RepoMock>(getRepositoryToken(VisaCaseMaterialItem));
}

/**
 * @param getContext - 取得 VisaCaseService 测试上下文
 */
export function registerUpdateCaseTypeMaterialTests(
  getContext: ContextAccessor,
): void {
  registerUpdateCaseTypeAutoInitWhenEmpty(getContext);
  registerUpdateCaseTypeSkipWhenMaterialsExist(getContext);
  registerUpdateCaseTypeSkipWhenNoTemplate(getContext);
  registerUpdateCaseTypeSkipWhenNormalizedUnchanged(getContext);
}

function registerUpdateCaseTypeAutoInitWhenEmpty(
  getContext: ContextAccessor,
): void {
  describe('update · case_type change — auto-init when checklist empty', () => {
    let initializeSpy:
      | jest.SpiedFunction<
          (visaCaseId: string, userId: string) => Promise<unknown[]>
        >
      | undefined;

    afterEach(() => {
      initializeSpy?.mockRestore();
      initializeSpy = undefined;
    });

    it('calls initialize when type changes, template exists, material count is 0', async () => {
      const ctx = getContext();
      const materialService = ctx.module.get(VisaCaseMaterialService);
      initializeSpy = jest
        .spyOn(materialService, 'initialize')
        .mockResolvedValue([]);

      const { service, visaCaseRepo } = ctx;
      const tplRepo = templateRepoMock(ctx);
      const miRepo = materialItemsRepoMock(ctx);

      const existing = buildVisaCaseRecord({
        caseType: '技術・人文知識・国際業務',
        familyMembers: [],
      });
      const updated = buildVisaCaseRecord({
        caseType: '経営・管理',
        familyMembers: [],
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      tplRepo.findOne.mockResolvedValue({
        id: 'tpl-startup',
        caseType: '経営・管理',
        isActive: true,
        items: [],
      });
      miRepo.count.mockResolvedValue(0);

      await service.update('vc-1', { caseType: '経営・管理' }, 'user-1');

      expect(initializeSpy).toHaveBeenCalledWith('vc-1', 'user-1');
    });
  });
}

function registerUpdateCaseTypeSkipWhenMaterialsExist(
  getContext: ContextAccessor,
): void {
  describe('update · case_type change — skip auto-init when rows exist', () => {
    let initializeSpy:
      | jest.SpiedFunction<
          (visaCaseId: string, userId: string) => Promise<unknown[]>
        >
      | undefined;

    afterEach(() => {
      initializeSpy?.mockRestore();
      initializeSpy = undefined;
    });

    it('does not call initialize when material rows already exist', async () => {
      const ctx = getContext();
      const materialService = ctx.module.get(VisaCaseMaterialService);
      initializeSpy = jest
        .spyOn(materialService, 'initialize')
        .mockResolvedValue([]);

      const { service, visaCaseRepo } = ctx;
      const tplRepo = templateRepoMock(ctx);
      const miRepo = materialItemsRepoMock(ctx);

      const existing = buildVisaCaseRecord({
        caseType: '技術・人文知識・国際業務',
        familyMembers: [],
      });
      const updated = buildVisaCaseRecord({
        caseType: '経営・管理',
        familyMembers: [],
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      tplRepo.findOne.mockResolvedValue({
        id: 'tpl-startup',
        caseType: '経営・管理',
        isActive: true,
        items: [],
      });
      miRepo.count.mockResolvedValue(3);

      await service.update('vc-1', { caseType: '経営・管理' }, 'user-1');

      expect(initializeSpy).not.toHaveBeenCalled();
    });
  });
}

function registerUpdateCaseTypeSkipWhenNoTemplate(
  getContext: ContextAccessor,
): void {
  describe('update · case_type change — skip when no active template', () => {
    let initializeSpy:
      | jest.SpiedFunction<
          (visaCaseId: string, userId: string) => Promise<unknown[]>
        >
      | undefined;

    afterEach(() => {
      initializeSpy?.mockRestore();
      initializeSpy = undefined;
    });

    it('does not call initialize when no template for new case type', async () => {
      const ctx = getContext();
      const materialService = ctx.module.get(VisaCaseMaterialService);
      initializeSpy = jest
        .spyOn(materialService, 'initialize')
        .mockResolvedValue([]);

      const { service, visaCaseRepo } = ctx;
      const tplRepo = templateRepoMock(ctx);
      const miRepo = materialItemsRepoMock(ctx);

      const existing = buildVisaCaseRecord({
        caseType: 'OLD',
        familyMembers: [],
      });
      const updated = buildVisaCaseRecord({
        caseType: 'CUSTOM_NO_TEMPLATE',
        familyMembers: [],
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      tplRepo.findOne.mockResolvedValue(null);
      miRepo.count.mockResolvedValue(0);

      await service.update(
        'vc-1',
        { caseType: 'CUSTOM_NO_TEMPLATE' },
        'user-1',
      );

      expect(initializeSpy).not.toHaveBeenCalled();
    });
  });
}

function registerUpdateCaseTypeSkipWhenNormalizedUnchanged(
  getContext: ContextAccessor,
): void {
  describe('update · case_type change — unchanged after normalize', () => {
    let initializeSpy:
      | jest.SpiedFunction<
          (visaCaseId: string, userId: string) => Promise<unknown[]>
        >
      | undefined;

    afterEach(() => {
      initializeSpy?.mockRestore();
      initializeSpy = undefined;
    });

    it('does not call initialize when payload only adds surrounding spaces', async () => {
      const ctx = getContext();
      const materialService = ctx.module.get(VisaCaseMaterialService);
      initializeSpy = jest
        .spyOn(materialService, 'initialize')
        .mockResolvedValue([]);

      const { service, visaCaseRepo } = ctx;
      const tplRepo = templateRepoMock(ctx);
      const miRepo = materialItemsRepoMock(ctx);

      const existing = buildVisaCaseRecord({
        caseType: '技術・人文知識・国際業務',
        familyMembers: [],
      });

      visaCaseRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          caseType: '  技術・人文知識・国際業務  ',
        });

      tplRepo.findOne.mockResolvedValue({
        id: 'tpl-1',
        caseType: '技術・人文知識・国際業務',
        isActive: true,
        items: [],
      });
      miRepo.count.mockResolvedValue(0);

      await service.update(
        'vc-1',
        { caseType: '  技術・人文知識・国際業務  ' },
        'user-1',
      );

      expect(initializeSpy).not.toHaveBeenCalled();
    });
  });
}
