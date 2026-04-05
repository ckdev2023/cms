import { MaterialStatus } from '../../common/constants/enums';
import { computeSuggestedMaterialStatusFromChecklistCounts } from './material-checklist-suggested-status.util';

describe('computeSuggestedMaterialStatusFromChecklistCounts', () => {
  it('returns NOT_RECEIVED when no applicable items', () => {
    expect(computeSuggestedMaterialStatusFromChecklistCounts(0, 0, 0)).toBe(
      MaterialStatus.NOT_RECEIVED,
    );
    expect(computeSuggestedMaterialStatusFromChecklistCounts(0, 3, 3)).toBe(
      MaterialStatus.NOT_RECEIVED,
    );
  });

  it('returns COMPLETE when all applicable items are collected', () => {
    expect(computeSuggestedMaterialStatusFromChecklistCounts(2, 0, 2)).toBe(
      MaterialStatus.COMPLETE,
    );
    expect(computeSuggestedMaterialStatusFromChecklistCounts(1, 1, 2)).toBe(
      MaterialStatus.COMPLETE,
    );
  });

  it('returns PARTIAL when some but not all applicable items collected', () => {
    expect(computeSuggestedMaterialStatusFromChecklistCounts(1, 0, 3)).toBe(
      MaterialStatus.PARTIAL,
    );
  });

  it('returns NOT_RECEIVED when applicable items exist but none collected', () => {
    expect(computeSuggestedMaterialStatusFromChecklistCounts(0, 0, 2)).toBe(
      MaterialStatus.NOT_RECEIVED,
    );
  });
});
