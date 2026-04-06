import { NotFoundException } from '@nestjs/common';

import {
  MaterialItemScope,
  MaterialItemStatus,
} from '../../common/constants/enums';
import type { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import {
  buildFamilyMember,
  buildMaterialItem,
  buildTemplate,
  buildTemplateItem,
  buildVisaCase,
} from './material-checklist.spec.helpers';
import type { VisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';
import {
  getMaterialRepoTransactionMock,
  stubActiveTemplateByCaseType,
} from './visa-case-material.service.spec.runners-helpers';

export async function runBackfillReturnsZeroWhenNoTemplateBackedRows(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ templateItemId: null, id: 'manual-only' }),
  ]);

  const n = await f.service.backfillMemberScopedRowsAfterFamilyMemberChange(
    'vc-1',
    'user-1',
  );

  expect(n).toBe(0);
  expect(f.materialItemRepo.save).not.toHaveBeenCalled();
  expect(getMaterialRepoTransactionMock(f.materialItemRepo)).toHaveBeenCalled();
}

export async function runBackfillAddsMissingMemberRows(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-m',
        scope: MaterialItemScope.MEMBER,
        itemName: 'パスポート',
      }),
    ],
  });
  stubActiveTemplateByCaseType(f, template);

  f.familyMemberRepo.find.mockResolvedValue([
    buildFamilyMember({ id: 'fm-1' }),
    buildFamilyMember({ id: 'fm-2', isPrimary: false }),
  ]);

  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({
      templateItemId: 'ti-m',
      visaCaseFamilyMemberId: 'fm-1',
    }),
  ]);

  f.materialItemRepo.save.mockResolvedValue([]);

  const n = await f.service.backfillMemberScopedRowsAfterFamilyMemberChange(
    'vc-1',
    'user-1',
  );

  expect(n).toBe(1);
  expect(f.materialItemRepo.save).toHaveBeenCalled();
  const [[savedBatch]] = f.materialItemRepo.save.mock.calls as unknown as [
    [VisaCaseMaterialItem[]],
  ];
  expect(savedBatch).toHaveLength(1);
  expect(savedBatch[0]?.visaCaseFamilyMemberId).toBe('fm-2');
  expect(savedBatch[0]?.templateItemId).toBe('ti-m');
}

export async function runBackfillIdempotentWhenAllPairsExist(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-m',
        scope: MaterialItemScope.MEMBER,
      }),
    ],
  });
  stubActiveTemplateByCaseType(f, template);

  f.familyMemberRepo.find.mockResolvedValue([
    buildFamilyMember({ id: 'fm-1' }),
  ]);
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({
      templateItemId: 'ti-m',
      visaCaseFamilyMemberId: 'fm-1',
    }),
  ]);

  const n = await f.service.backfillMemberScopedRowsAfterFamilyMemberChange(
    'vc-1',
    'user-1',
  );

  expect(n).toBe(0);
  expect(f.materialItemRepo.save).not.toHaveBeenCalled();
}

export async function runBackfillThrowsWhenCaseMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(0);

  await expect(
    f.service.backfillMemberScopedRowsAfterFamilyMemberChange('vc-1', 'user-1'),
  ).rejects.toThrow(NotFoundException);
}

/**
 * 0 人家族で作られた MEMBER 占位行（`visaCaseFamilyMemberId` が null）在挂载首名成员时应 UPDATE 绑定并保留 `NOT_APPLICABLE` 等状态。
 */
export async function runBackfillReassignsPlaceholderPreservingStatus(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-m',
        scope: MaterialItemScope.MEMBER,
        itemName: 'パスポート',
      }),
    ],
  });
  stubActiveTemplateByCaseType(f, template);

  f.familyMemberRepo.find.mockResolvedValue([
    buildFamilyMember({ id: 'fm-1' }),
  ]);
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({
      id: 'ph-1',
      templateItemId: 'ti-m',
      visaCaseFamilyMemberId: null,
      itemStatus: MaterialItemStatus.NOT_APPLICABLE,
    }),
  ]);
  f.materialItemRepo.save.mockResolvedValue([]);

  const n = await f.service.backfillMemberScopedRowsAfterFamilyMemberChange(
    'vc-1',
    'user-1',
  );

  expect(n).toBe(0);
  expect(f.materialItemRepo.save).toHaveBeenCalled();
  const [[savedBatch]] = f.materialItemRepo.save.mock.calls as unknown as [
    [VisaCaseMaterialItem[]],
  ];
  expect(savedBatch).toHaveLength(1);
  expect(savedBatch[0]?.visaCaseFamilyMemberId).toBe('fm-1');
  expect(savedBatch[0]?.itemStatus).toBe(MaterialItemStatus.NOT_APPLICABLE);
}
