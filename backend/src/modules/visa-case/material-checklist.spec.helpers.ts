import {
  MaterialItemScope,
  MaterialItemStatus,
  VisaCaseStatus,
} from '../../common/constants/enums';

/** Jest repository mock 形态：方法名 → mock。 */
export type RepoMock = Record<string, jest.Mock>;

/**
 * 构造通用 TypeORM Repository mock，默认返回空/空对象。
 *
 * @returns 带常用 CRUD mock 方法的对象
 */
export function createMockRepo(): RepoMock {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    count: jest.fn().mockResolvedValue(0),
    remove: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    softRemove: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

/**
 * 构造材料模板项 fixture。
 *
 * @param overrides - 覆盖默认字段
 * @returns 模板项字面量
 */
export function buildTemplateItem(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'ti-1',
    templateId: 'tpl-1',
    groupName: '基本書類',
    itemName: 'パスポートコピー',
    scope: MaterialItemScope.MEMBER,
    sortOrder: 0,
    isRequired: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * 构造材料模板 fixture（含默认一条模板项）。
 *
 * @param overrides - 覆盖默认字段
 * @returns 模板字面量
 */
export function buildTemplate(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'tpl-1',
    caseType: 'WORK',
    displayName: '工作签 通用材料清単',
    isActive: true,
    items: [buildTemplateItem()],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * 构造签证案件材料实例 fixture。
 *
 * @param overrides - 覆盖默认字段
 * @returns 材料项字面量
 */
export function buildMaterialItem(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'mi-1',
    visaCaseId: 'vc-1',
    templateItemId: 'ti-1',
    visaCaseFamilyMemberId: null,
    groupName: '基本書類',
    itemName: 'パスポートコピー',
    itemStatus: MaterialItemStatus.NOT_COLLECTED,
    sortOrder: 0,
    remark: null,
    collectedAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    familyMember: null,
    ...overrides,
  };
}

/**
 * 构造签证案件 fixture。
 *
 * @param overrides - 覆盖默认字段
 * @returns 案件字面量
 */
export function buildVisaCase(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'vc-1',
    customerId: 'cust-1',
    caseType: 'WORK',
    caseStatus: VisaCaseStatus.DRAFT,
    materialStatus: null,
    ...overrides,
  };
}

/**
 * 构造家属成员 fixture（材料清单用例）。
 *
 * @param overrides - 覆盖默认字段
 * @returns 家属字面量
 */
export function buildFamilyMember(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'fm-1',
    visaCaseId: 'vc-1',
    customerId: 'cust-1',
    isPrimary: true,
    displayNameSnapshot: '田中太郎',
    ...overrides,
  };
}
