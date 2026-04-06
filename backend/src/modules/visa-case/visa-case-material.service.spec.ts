import type { VisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';
import { createVisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';
import {
  runCreateItemThrowsWhenCaseMissing,
  runCreateItemValidatesFamilyMember,
  runCreateManualMaterialItem,
  runDeleteManualItem,
  runDeleteRejectsTemplateSourced,
  runDeleteThrowsWhenMissing,
  runFindByVisaCaseSorted,
  runFindByVisaCaseThrowsWhenMissing,
  runGetSummaryAllNotApplicable,
  runGetSummaryComplete,
  runGetSummaryIncludesCurrentStatus,
  runGetSummaryNoItems,
  runGetSummaryNotReceived,
  runGetSummaryNullCurrentStatus,
  runGetSummaryPartial,
  runGetSummaryThrowsWhenMissing,
  runInitializeCaseScopeOnce,
  runInitializeEmptyWhenNoCaseType,
  runInitializeEmptyWhenNoTemplate,
  runInitializeMemberScopePerFamily,
  runInitializeSkipsWhenItemsExist,
  runInitializeThrowsWhenCaseMissing,
  runSyncStatusAlignsCurrent,
  runSyncStatusWritesSuggested,
  runUpdateItemClearsCollectedAt,
  runUpdateItemRemark,
  runUpdateItemThrowsWhenMissing,
  runUpdateItemToCollected,
} from './visa-case-material.service.spec.runners';

let fx: VisaCaseMaterialFixture;

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
