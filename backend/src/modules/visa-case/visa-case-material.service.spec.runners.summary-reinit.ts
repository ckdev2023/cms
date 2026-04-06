import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  MaterialItemScope,
  MaterialItemStatus,
  MaterialStatus,
} from '../../common/constants/enums';
import {
  buildMaterialItem,
  buildTemplate,
  buildTemplateItem,
  buildVisaCase,
} from './material-checklist.spec.helpers';
import type { VisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';
import {
  getMaterialRepoTransactionMock,
  stubActiveTemplateByCaseType,
  stubNoActiveTemplateForCaseType,
} from './visa-case-material.service.spec.runners-helpers';

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

export async function runReinitializeThrowsWhenCaseMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(null);

  await expect(
    f.service.reinitializeFromActiveTemplate('vc-1', 'user-1'),
  ).rejects.toThrow(NotFoundException);
}

export async function runReinitializeThrowsWhenNoCaseType(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase({ caseType: null }));

  await expect(
    f.service.reinitializeFromActiveTemplate('vc-1', 'user-1'),
  ).rejects.toThrow(BadRequestException);
}

export async function runReinitializeThrowsWhenNoTemplate(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  stubNoActiveTemplateForCaseType(f);

  await expect(
    f.service.reinitializeFromActiveTemplate('vc-1', 'user-1'),
  ).rejects.toThrow(BadRequestException);
}

export async function runReinitializeRunsTransactionAndSeeds(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.visaCaseRepo.count.mockResolvedValue(1);
  const template = buildTemplate({
    items: [
      buildTemplateItem({
        id: 'ti-reinit',
        scope: MaterialItemScope.CASE,
        itemName: '再初期化項目',
      }),
    ],
  });
  stubActiveTemplateByCaseType(f, template);

  f.familyMemberRepo.find.mockResolvedValue([]);
  f.materialItemRepo.save.mockResolvedValue([]);
  f.materialItemRepo.find.mockResolvedValue([
    buildMaterialItem({ itemName: '再初期化項目' }),
  ]);

  const result = await f.service.reinitializeFromActiveTemplate(
    'vc-1',
    'user-1',
  );

  expect(getMaterialRepoTransactionMock(f.materialItemRepo)).toHaveBeenCalled();
  expect(f.materialItemRepo.save).toHaveBeenCalled();
  expect(result).toHaveLength(1);
  expect(result[0].itemName).toBe('再初期化項目');
}
