import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  MaterialItemScope,
  MaterialItemStatus,
  MaterialStatus,
} from '../../common/constants/enums';
import { Customer } from '../customer/entities/customer.entity';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import {
  buildFamilyMember,
  buildMaterialItem,
  buildTemplate,
  buildTemplateItem,
  buildVisaCase,
  createMockRepo,
  type RepoMock,
} from './material-checklist.spec.helpers';
import { MaterialTemplateService } from './material-template.service';
import { VisaCaseLookupService } from './visa-case-lookup.service';
import { VisaCaseMaterialService } from './visa-case-material.service';

type VisaCaseMaterialFixture = {
  service: VisaCaseMaterialService;
  templateService: MaterialTemplateService;
  materialItemRepo: RepoMock;
  visaCaseRepo: RepoMock;
  familyMemberRepo: RepoMock;
  customerRepo: RepoMock;
};

let fx: VisaCaseMaterialFixture;

/**
 * 编译 `VisaCaseMaterialService` 及其依赖的 Nest 测试模块并返回 mock 夹具。
 *
 * @returns 服务实例与各 Repository mock
 */
async function createVisaCaseMaterialFixture(): Promise<VisaCaseMaterialFixture> {
  const materialItemRepo = createMockRepo();
  const visaCaseRepo = createMockRepo();
  const familyMemberRepo = createMockRepo();
  const customerRepo = createMockRepo();

  const templateRepo = createMockRepo();
  const templateItemRepo = createMockRepo();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      VisaCaseMaterialService,
      VisaCaseLookupService,
      MaterialTemplateService,
      {
        provide: getRepositoryToken(VisaCaseMaterialItem),
        useValue: materialItemRepo,
      },
      { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
      {
        provide: getRepositoryToken(VisaCaseFamilyMember),
        useValue: familyMemberRepo,
      },
      { provide: getRepositoryToken(Customer), useValue: customerRepo },
      {
        provide: getRepositoryToken(MaterialTemplate),
        useValue: templateRepo,
      },
      {
        provide: getRepositoryToken(MaterialTemplateItem),
        useValue: templateItemRepo,
      },
    ],
  }).compile();

  return {
    service: module.get<VisaCaseMaterialService>(VisaCaseMaterialService),
    templateService: module.get<MaterialTemplateService>(
      MaterialTemplateService,
    ),
    materialItemRepo,
    visaCaseRepo,
    familyMemberRepo,
    customerRepo,
  };
}

beforeEach(async () => {
  fx = await createVisaCaseMaterialFixture();
});

function registerVisaCaseMaterialInitializeTests(): void {
  describe('initialize', () => {
    it('should skip initialization if items already exist', () =>
      runInitializeSkipsWhenItemsExist(fx));
    it('should return empty array when case has no caseType', () =>
      runInitializeEmptyWhenNoCaseType(fx));
    it('should return empty array when no template exists for caseType', () =>
      runInitializeEmptyWhenNoTemplate(fx));
    it('should create CASE scope items once regardless of family members', () =>
      runInitializeCaseScopeOnce(fx));
    it('should create MEMBER scope items per family member', () =>
      runInitializeMemberScopePerFamily(fx));
    it('should throw NotFoundException when case does not exist', () =>
      runInitializeThrowsWhenCaseMissing(fx));
  });
}

function registerVisaCaseMaterialFindByTests(): void {
  describe('findByVisaCase', () => {
    it('should return items sorted by sortOrder', () =>
      runFindByVisaCaseSorted(fx));
    it('should throw NotFoundException when case does not exist', () =>
      runFindByVisaCaseThrowsWhenMissing(fx));
  });
}

function registerVisaCaseMaterialCreateItemTests(): void {
  describe('createItem', () => {
    it('should create a manual material item', () =>
      runCreateManualMaterialItem(fx));
    it('should validate family member exists when specified', () =>
      runCreateItemValidatesFamilyMember(fx));
    it('should throw NotFoundException when case does not exist', () =>
      runCreateItemThrowsWhenCaseMissing(fx));
  });
}

function registerVisaCaseMaterialUpdateItemTests(): void {
  describe('updateItem', () => {
    it('should update item status to COLLECTED and set collectedAt', () =>
      runUpdateItemToCollected(fx));
    it('should clear collectedAt when status changes from COLLECTED', () =>
      runUpdateItemClearsCollectedAt(fx));
    it('should update remark', () => runUpdateItemRemark(fx));
    it('should throw NotFoundException when item does not exist', () =>
      runUpdateItemThrowsWhenMissing(fx));
  });
}

function registerVisaCaseMaterialDeleteItemTests(): void {
  describe('deleteItem', () => {
    it('should delete manual items (no templateItemId)', () =>
      runDeleteManualItem(fx));
    it('should reject deletion of template-sourced items', () =>
      runDeleteRejectsTemplateSourced(fx));
    it('should throw NotFoundException when item does not exist', () =>
      runDeleteThrowsWhenMissing(fx));
  });
}

function registerVisaCaseMaterialGetSummaryTests(): void {
  describe('getSummary', () => {
    it('should return COMPLETE when all applicable items are collected', () =>
      runGetSummaryComplete(fx));
    it('should return PARTIAL when some but not all are collected', () =>
      runGetSummaryPartial(fx));
    it('should return NOT_RECEIVED when none are collected', () =>
      runGetSummaryNotReceived(fx));
    it('should return NOT_RECEIVED when no items exist', () =>
      runGetSummaryNoItems(fx));
    it('should return NOT_RECEIVED when all items are NOT_APPLICABLE', () =>
      runGetSummaryAllNotApplicable(fx));
    it('should include currentStatus from persisted visa_cases.material_status', () =>
      runGetSummaryIncludesCurrentStatus(fx));
    it('should return currentStatus as null when material_status is not set', () =>
      runGetSummaryNullCurrentStatus(fx));
    it('should throw NotFoundException when case does not exist', () =>
      runGetSummaryThrowsWhenMissing(fx));
  });
}

function registerVisaCaseMaterialSyncStatusTests(): void {
  describe('syncStatus', () => {
    it('should write suggested status to visa_cases table', () =>
      runSyncStatusWritesSuggested(fx));
    it('should return currentStatus equal to suggestedStatus after sync', () =>
      runSyncStatusAlignsCurrent(fx));
  });
}

describe('VisaCaseMaterialService', () => {
  registerVisaCaseMaterialInitializeTests();
  registerVisaCaseMaterialFindByTests();
  registerVisaCaseMaterialCreateItemTests();
  registerVisaCaseMaterialUpdateItemTests();
  registerVisaCaseMaterialDeleteItemTests();
  registerVisaCaseMaterialGetSummaryTests();
  registerVisaCaseMaterialSyncStatusTests();
});

async function runInitializeSkipsWhenItemsExist(
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

async function runInitializeEmptyWhenNoCaseType(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase({ caseType: null }));
  f.materialItemRepo.count.mockResolvedValue(0);

  const result = await f.service.initialize('vc-1', 'user-1');

  expect(result).toEqual([]);
}

async function runInitializeEmptyWhenNoTemplate(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.count.mockResolvedValue(0);
  jest.spyOn(f.templateService, 'findActiveByCaseType').mockResolvedValue(null);

  const result = await f.service.initialize('vc-1', 'user-1');

  expect(result).toEqual([]);
}

async function runInitializeCaseScopeOnce(
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

async function runInitializeMemberScopePerFamily(
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

async function runInitializeThrowsWhenCaseMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(null);

  await expect(f.service.initialize('nonexistent', 'user-1')).rejects.toThrow(
    NotFoundException,
  );
}

async function runFindByVisaCaseSorted(
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

async function runFindByVisaCaseThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.count.mockResolvedValue(0);

  await expect(f.service.findByVisaCase('nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

async function runCreateManualMaterialItem(
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

async function runCreateItemValidatesFamilyMember(
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

async function runCreateItemThrowsWhenCaseMissing(
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

async function runUpdateItemToCollected(
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

async function runUpdateItemClearsCollectedAt(
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

async function runUpdateItemRemark(f: VisaCaseMaterialFixture): Promise<void> {
  const item = buildMaterialItem();
  f.materialItemRepo.findOne.mockResolvedValue(item);

  const result = await f.service.updateItem('vc-1', 'mi-1', {
    remark: '2026/04/01 提出済み',
  });

  expect(result.remark).toBe('2026/04/01 提出済み');
}

async function runUpdateItemThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.materialItemRepo.findOne.mockResolvedValue(null);

  await expect(
    f.service.updateItem('vc-1', 'nonexistent', {
      itemStatus: MaterialItemStatus.COLLECTED,
    }),
  ).rejects.toThrow(NotFoundException);
}

async function runDeleteManualItem(f: VisaCaseMaterialFixture): Promise<void> {
  const item = buildMaterialItem({ templateItemId: null });
  f.materialItemRepo.findOne.mockResolvedValue(item);

  await f.service.deleteItem('vc-1', 'mi-1');

  expect(f.materialItemRepo.remove).toHaveBeenCalledWith(item);
}

async function runDeleteRejectsTemplateSourced(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  const item = buildMaterialItem({ templateItemId: 'ti-1' });
  f.materialItemRepo.findOne.mockResolvedValue(item);

  await expect(f.service.deleteItem('vc-1', 'mi-1')).rejects.toThrow(
    BadRequestException,
  );
}

async function runDeleteThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.materialItemRepo.findOne.mockResolvedValue(null);

  await expect(f.service.deleteItem('vc-1', 'nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

async function runGetSummaryComplete(
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

async function runGetSummaryPartial(f: VisaCaseMaterialFixture): Promise<void> {
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

async function runGetSummaryNotReceived(
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

async function runGetSummaryNoItems(f: VisaCaseMaterialFixture): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(buildVisaCase());
  f.materialItemRepo.find.mockResolvedValue([]);

  const result = await f.service.getSummary('vc-1');

  expect(result.suggestedStatus).toBe(MaterialStatus.NOT_RECEIVED);
  expect(result.total).toBe(0);
}

async function runGetSummaryAllNotApplicable(
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

async function runGetSummaryIncludesCurrentStatus(
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

async function runGetSummaryNullCurrentStatus(
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

async function runGetSummaryThrowsWhenMissing(
  f: VisaCaseMaterialFixture,
): Promise<void> {
  f.visaCaseRepo.findOne.mockResolvedValue(null);

  await expect(f.service.getSummary('nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

async function runSyncStatusWritesSuggested(
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

async function runSyncStatusAlignsCurrent(
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
