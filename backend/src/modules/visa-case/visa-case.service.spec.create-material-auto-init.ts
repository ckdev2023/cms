import { getRepositoryToken } from '@nestjs/typeorm';

import { MaterialItemScope } from '../../common/constants/enums';
import { MaterialTemplate } from './entities/material-template.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import type { ContextAccessor } from './visa-case.service.spec-helpers';
import { buildVisaCaseRecord } from './visa-case.service.spec-helpers';
import { VisaCaseMaterialService } from './visa-case-material.service';

/**
 * 装配「活跃模板 + 空清单」场景，断言建案内联 `initialize` 会写入模板行。
 *
 * @param getContext - 取得 VisaCaseService 测试上下文
 */
async function runPersistTemplateRowsScenario(
  getContext: ContextAccessor,
): Promise<void> {
  /* Nest `TestingModule.get` 在测试夹具中返回 jest mock 仓储，与正式 `Repository<T>` 签名不完全一致。 */
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  const ctx = getContext();
  const { service, visaCaseRepo, module } = ctx;
  const materialItemRepo = module.get(getRepositoryToken(VisaCaseMaterialItem));
  const templateRepo = module.get(getRepositoryToken(MaterialTemplate));

  const caseType = '経営・管理';
  const savedEntity = buildVisaCaseRecord({
    id: 'vc-new',
    caseType,
  });
  visaCaseRepo.save.mockResolvedValue(savedEntity);
  visaCaseRepo.findOne.mockImplementation(
    (opts: { relations?: string[] } | undefined) => {
      if (opts?.relations?.includes('assignee')) {
        return Promise.resolve(savedEntity);
      }
      return Promise.resolve({ id: 'vc-new', caseType });
    },
  );

  templateRepo.findOne.mockResolvedValue({
    id: 'tpl-1',
    caseType,
    isActive: true,
    items: [
      {
        id: 'ti-pass',
        templateId: 'tpl-1',
        groupName: '基本',
        itemName: 'パスポート写し',
        scope: MaterialItemScope.CASE,
        sortOrder: 0,
        isRequired: true,
      },
    ],
  });

  materialItemRepo.find.mockResolvedValue([]);

  await service.create('cust-1', { customerId: 'cust-1', caseType }, 'user-1');

  expect(jest.mocked(materialItemRepo.save)).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        visaCaseId: 'vc-new',
        itemName: 'パスポート写し',
        templateItemId: 'ti-pass',
      }),
    ]),
  );
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
}

/**
 * 建案成功后内联材料 `initialize` 的回归：与 `POST .../materials/initialize` 幂等语义一致。
 *
 * @param getContext - 取得 VisaCaseService 测试上下文
 */
export function registerCreateMaterialAutoInitTests(
  getContext: ContextAccessor,
): void {
  describe('create · material checklist auto-init', () => {
    let initializeSpy:
      | jest.SpiedFunction<
          (visaCaseId: string, userId: string) => Promise<unknown[]>
        >
      | undefined;

    afterEach(() => {
      initializeSpy?.mockRestore();
      initializeSpy = undefined;
    });

    it('should invoke VisaCaseMaterialService.initialize after persist', async () => {
      const ctx = getContext();
      const materialService = ctx.module.get(VisaCaseMaterialService);
      initializeSpy = jest.spyOn(materialService, 'initialize');

      const { service, visaCaseRepo } = ctx;
      const savedEntity = buildVisaCaseRecord({
        id: 'vc-new',
      });
      visaCaseRepo.save.mockResolvedValue(savedEntity);
      visaCaseRepo.findOne.mockResolvedValue(savedEntity);

      await service.create('cust-1', { customerId: 'cust-1' }, 'user-1');

      expect(initializeSpy).toHaveBeenCalledWith('vc-new', 'user-1');
    });

    it('should persist template-derived material rows when caseType matches active template', async () => {
      await runPersistTemplateRowsScenario(getContext);
    });
  });
}
