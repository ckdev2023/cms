import { MaterialTemplate } from './entities/material-template.entity';
import type { VisaCaseMaterialFixture } from './visa-case-material.service.spec.fixture';

/** 带 `manager.transaction` 的 Repository mock 形态（与 fixture 中 `materialItemRepo` 一致）。 */
type RepoWithTransaction = {
  manager: { transaction: jest.Mock };
};

/**
 * 取出材料 Repository 上的 `transaction` mock，便于断言事务是否被调用。
 *
 * @param repo - `VisaCaseMaterialFixture.materialItemRepo`
 * @returns `manager.transaction` 的 Jest mock
 */
export function getMaterialRepoTransactionMock(
  repo: VisaCaseMaterialFixture['materialItemRepo'],
): jest.Mock {
  return (repo as unknown as RepoWithTransaction).manager.transaction;
}

/**
 * 将 `buildTemplate` 等测试字面量挂到 `MaterialTemplateService.findActiveByCaseType`。
 *
 * @param f - 签证材料服务测试夹具
 * @param template - 模板 fixture（弱类型字面量）
 */
export function stubActiveTemplateByCaseType(
  f: VisaCaseMaterialFixture,
  template: Record<string, unknown>,
): void {
  jest
    .spyOn(f.templateService, 'findActiveByCaseType')
    .mockResolvedValue(template as unknown as MaterialTemplate);
}

/**
 * 将 `findActiveByCaseType` 固定为「无激活模板」，用于负例分支。
 *
 * @param f - 签证材料服务测试夹具
 */
export function stubNoActiveTemplateForCaseType(
  f: VisaCaseMaterialFixture,
): void {
  jest.spyOn(f.templateService, 'findActiveByCaseType').mockResolvedValue(null);
}

/**
 * 读取 `materialItemRepo.save` 首次调用传入的批量实体（弱类型字段断言用）。
 *
 * @param repo - 材料项 Repository mock
 * @returns 首次 `save` 的第一个参数
 */
export function getFirstSaveBatch(
  repo: VisaCaseMaterialFixture['materialItemRepo'],
): Array<Record<string, unknown>> {
  const saveMock = repo.save as jest.MockedFunction<
    (entities: Array<Record<string, unknown>>) => Promise<unknown>
  >;
  const batch = saveMock.mock.calls[0]?.[0];
  expect(batch).toBeDefined();
  return batch;
}
