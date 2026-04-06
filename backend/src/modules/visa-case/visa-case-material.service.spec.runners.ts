import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  MaterialItemScope,
  MaterialItemStatus,
  MaterialStatus,
} from '../../common/constants/enums';
import { MaterialTemplate } from './entities/material-template.entity';
import {
  buildFamilyMember,
  buildMaterialItem,
  buildTemplate,
  buildTemplateItem,
  buildVisaCase,
} from './material-checklist.spec.helpers';
import type { VisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';

export async function runInitializeSkipsWhenItemsExist(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.count.mockResolvedValue(3);
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.materialItemRepo.find.mockResolvedValue([buildMaterialItem()]);

  const result = await f.service.initialize('vc-1', 'user-1');

  expect(result).toHaveLength(1);
  expect(f.materialItemRepo.save).not.toHaveBeenCalled();
}

export async function runInitializeEmptyWhenNoCaseType(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase({ caseType: null }));
  f.materialItemRepo.count.mockResolvedValue(0);

  const result = await f.service.initialize('vc-1', 'user-1');

  expect(result).toEqual([]);
}

export async function runInitializeEmptyWhenNoTemplate(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.count.mockResolvedValue(0);
  jest.spyOn(f.templateService, 'findActiveByCaseType').mockResolvedValue(null);

  const result = await f.service.initialize('vc-1', 'user-1');

  expect(result).toEqual([]);
}

export async function runInitializeCaseScopeOnce(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.materialItemRepo.count.mockResolvedValue(0);

  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-case',
        scope: MaterialItemScope.CASE,
        itemName: '申請書',
      }),
    ],
  });
  jest
    .spyOn(f.templateService, 'findActiveByCaseType')
    .mockResolvedValue(template as unknown as MaterialTemplate);

  f.familyMemberRepo.find.mockResolvedValue([
    buildFamilyMember(),
    buildFamilyMember({ id: 'fm-2' }),
  ]);
  f.materialItemRepo.save.mockResolvedValue([]);
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemName: '申請書' }),
  ]);

  const result = await f.service.initialize('vc-1', 'user-1');

  const callArgs = f.materialItemRepo.save.mock.calls as unknown as unknown[][];
  const savedItems = callArgs[0][0] as Array<Record<string, unknown>>;
  expect(savedItems).toHaveLength(1);
  expect(savedItems[0].visaCaseFamilyMemberId).toBeNull();
  expect(result).toHaveLength(1);
}

export async function runInitializeMemberScopePerFamily(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.materialItemRepo.count.mockResolvedValue(0);

  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-member',
        scope: MaterialItemScope.MEMBER,
        itemName: 'パスポート',
      }),
    ],
  });
  jest
    .spyOn(f.templateService, 'findActiveByCaseType')
    .mockResolvedValue(template as unknown as MaterialTemplate);

  f.familyMemberRepo.find.mockResolvedValue([
    buildFamilyMember({ id: 'fm-1' }),
    buildFamilyMember({ id: 'fm-2' }),
  ]);
  f.materialItemRepo.save.mockResolvedValue([]);
  f.materialItemRepo.find.mockResolvedValue([]);

  await f.service.initialize('vc-1', 'user-1');

  const callArgs = f.materialItemRepo.save.mock.calls as unknown as unknown[][];
  const savedItems = callArgs[0][0] as Array<Record<string, unknown>>;
  expect(savedItems).toHaveLength(2);
  expect(savedItems[0].visaCaseFamilyMemberId).toBe('fm-1');
  expect(savedItems[1].visaCaseFamilyMemberId).toBe('fm-2');
}

export async function runInitializeThrowsWhenCaseMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(null);

  await expect(f.service.initialize('nonexistent', 'user-1')).rejects.toThrow(
    NotFoundException,
  );
}

export async function runFindByVisaCaseSorted(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ sortOrder: 1, itemName: 'B' }),
    buildMaterialItem({ id: 'mi-2', sortOrder: 0, itemName: 'A' }),
  ]);

  const result = await f.service.findByVisaCase('vc-1');

  expect(result).toHaveLength(2);
}

export async function runFindByVisaCaseThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(0);

  await expect(f.service.findByVisaCase('nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

export async function runCreateManualMaterialItem(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  const saved = buildMaterialItem({
    id: 'mi-new',
    templateItemId: null,
    itemName: '追加書類',
  });
  f.materialItemRepo.save.mockResolvedValue(saved);
  f.materialItemRepo.findOne.mockResolvedValue(saved);

  const result = await f.service.createItem(
    'vc-1',
    { groupName: 'その他', itemName: '追加書類' },
    'user-1',
  );

  expect(result.id).toBe('mi-new');
  expect(result.templateItemId).toBeNull();
  expect(f.materialItemRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({
      templateItemId: null,
      groupName: 'その他',
      itemName: '追加書類',
    }),
  );
}

export async function runCreateItemValidatesFamilyMember(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(1);
  f.familyMemberRepo.count.mockResolvedValue(0);

  await expect(
    f.service.createItem(
      'vc-1',
      {
        groupName: 'g',
        itemName: 'i',
        visaCaseFamilyMemberId: 'nonexistent',
      },
      'user-1',
    ),
  ).rejects.toThrow(NotFoundException);
}

export async function runCreateItemThrowsWhenCaseMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(0);

  await expect(
    f.service.createItem(
      'nonexistent',
      { groupName: 'g', itemName: 'i' },
      'user-1',
    ),
  ).rejects.toThrow(NotFoundException);
}

export async function runUpdateItemToCollected(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem();
  f.materialItemRepo.findOne.mockResolvedValue(item);

  const result = await f.service.updateItem('vc-1', 'mi-1', {
    itemStatus: MaterialItemStatus.COLLECTED,
  });

  expect(result.itemStatus).toBe(MaterialItemStatus.COLLECTED);
  expect(item.collectedAt).toBeTruthy();
}

export async function runUpdateItemClearsCollectedAt(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem({
    itemStatus: MaterialItemStatus.COLLECTED,
    collectedAt: new Date(),
  });
  f.materialItemRepo.findOne.mockResolvedValue(item);

  const result = await f.service.updateItem('vc-1', 'mi-1', {
    itemStatus: MaterialItemStatus.NOT_APPLICABLE,
  });

  expect(result.itemStatus).toBe(MaterialItemStatus.NOT_APPLICABLE);
  expect(item.collectedAt).toBeNull();
}

export async function runUpdateItemRemark(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem();
  f.materialItemRepo.findOne.mockResolvedValue(item);

  const result = await f.service.updateItem('vc-1', 'mi-1', {
    remark: '2026/04/01 提出済み',
  });

  expect(result.remark).toBe('2026/04/01 提出済み');
}

export async function runUpdateItemThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.materialItemRepo.findOne.mockResolvedValue(null);

  await expect(
    f.service.updateItem('vc-1', 'nonexistent', {
      itemStatus: MaterialItemStatus.COLLECTED,
    }),
  ).rejects.toThrow(NotFoundException);
}

export async function runDeleteManualItem(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem({ templateItemId: null });
  f.materialItemRepo.findOne.mockResolvedValue(item);

  await f.service.deleteItem('vc-1', 'mi-1');

  expect(f.materialItemRepo.remove).toHaveBeenCalledWith(item);
}

export async function runDeleteRejectsTemplateSourced(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem({ templateItemId: 'ti-1' });
  f.materialItemRepo.findOne.mockResolvedValue(item);

  await expect(f.service.deleteItem('vc-1', 'mi-1')).rejects.toThrow(
    BadRequestException,
  );
}

export async function runDeleteThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.materialItemRepo.findOne.mockResolvedValue(null);

  await expect(f.service.deleteItem('vc-1', 'nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

export async function runGetSummaryComplete(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(
    buildVisaCase({ materialStatus: MaterialStatus.PARTIAL }),
  );
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.COLLECTED,
    }),
    buildMaterialItem({
      id: 'mi-3',
      itemStatus: MaterialItemStatus.NOT_APPLICABLE,
    }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.COMPLETE);
  expect(result.collected).toBe(2);
  expect(result.notCollected).toBe(0);
  expect(result.notApplicable).toBe(1);
  expect(result.total).toBe(3);
}

export async function runGetSummaryPartial(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.NOT_COLLECTED,
    }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.PARTIAL);
  expect(result.collected).toBe(1);
  expect(result.notCollected).toBe(1);
}

export async function runGetSummaryNotReceived(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.NOT_COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.NOT_COLLECTED,
    }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.NOT_RECEIVED);
}

export async function runGetSummaryNoItems(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.NOT_RECEIVED);
  expect(result.total).toBe(0);
}

export async function runGetSummaryAllNotApplicable(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({
      itemStatus: MaterialItemStatus.NOT_APPLICABLE,
    }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.NOT_RECEIVED);
  expect(result.notApplicable).toBe(1);
}

export async function runGetSummaryIncludesCurrentStatus(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(
    buildVisaCase({ materialStatus: MaterialStatus.PARTIAL }),
  );
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.COLLECTED,
    }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.currentStatus).toBe(MaterialStatus.PARTIAL);
  expect(result.suggestedStatus).toBe(MaterialStatus.COMPLETE);
}

export async function runGetSummaryNullCurrentStatus(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(
    buildVisaCase({ materialStatus: null }),
  );
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
  ]);

  const result = await f.service.getSummary('vc-1');

  expect(result.currentStatus).toBeNull();
  expect(result.suggestedStatus).toBe(MaterialStatus.COMPLETE);
}

export async function runGetSummaryThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(null);

  await expect(f.service.getSummary('nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

export async function runSyncStatusWritesSuggested(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(
    buildVisaCase({ materialStatus: MaterialStatus.NOT_RECEIVED }),
  );
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.NOT_COLLECTED,
    }),
  ]);

  const result = await f.service.syncStatus('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.PARTIAL);
  expect(f.visaCaseRepo.update).toHaveBeenCalledWith('vc-1', {
    materialStatus: MaterialStatus.PARTIAL,
  });
}

export async function runSyncStatusAlignsCurrent(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(
    buildVisaCase({ materialStatus: MaterialStatus.NOT_RECEIVED }),
  );
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemStatus: MaterialItemStatus.COLLECTED }),
    buildMaterialItem({
      id: 'mi-2',
      itemStatus: MaterialItemStatus.COLLECTED,
    }),
  ]);

  const result = await f.service.syncStatus('vc-1');

  expect(result.currentStatus).toBe(MaterialStatus.COMPLETE);
  expect(result.suggestedStatus).toBe(MaterialStatus.COMPLETE);
}
