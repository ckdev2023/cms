import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MaterialItemScope } from '../../common/constants/enums';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import {
  buildTemplate,
  buildTemplateItem,
  createMockRepo,
  type RepoMock,
} from './material-checklist.spec.helpers';
import { MaterialTemplateService } from './material-template.service';

let service: MaterialTemplateService;
let templateRepo: RepoMock;
let templateItemRepo: RepoMock;

/**
 * 重置 MaterialTemplateService 测试夹具（独立 `beforeEach` 用）。
 *
 * @returns Promise，在编译 Nest 测试模块后解析
 */
async function resetMaterialTemplateFixture(): Promise<void> {
  templateRepo = createMockRepo();
  templateItemRepo = createMockRepo();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MaterialTemplateService,
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

  service = module.get<MaterialTemplateService>(MaterialTemplateService);
}

/**
 * 断言 `findAll` 按 `sortOrder` 与 `itemName` 排序返回模板项。
 *
 * @returns 异步断言完成的 Promise
 */
async function runFindAllSortedItemsTest(): Promise<void> {
  const tpl = buildTemplate({
    items: [
      buildTemplateItem({ sortOrder: 2, itemName: 'B' }),
      buildTemplateItem({ id: 'ti-2', sortOrder: 0, itemName: 'A' }),
    ],
  });
  templateRepo.find.mockResolvedValue([tpl]);

  const result = await service.findAll();

  expect(result).toHaveLength(1);
  expect(result[0].items[0].itemName).toBe('A');
  expect(result[0].items[1].itemName).toBe('B');
}

/**
 * 断言带条目创建模板并返回新 ID。
 *
 * @returns 异步断言完成的 Promise
 */
async function runCreateTemplateWithItemsTest(): Promise<void> {
  templateRepo.findOne
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(buildTemplate({ id: 'tpl-new' }));
  templateRepo.save.mockResolvedValue({ id: 'tpl-new' });

  const result = await service.create({
    caseType: 'WORK',
    displayName: '工作签 通用材料清単',
    items: [
      {
        groupName: '基本書類',
        itemName: 'パスポートコピー',
        scope: MaterialItemScope.MEMBER,
      },
    ],
  });

  expect(result.id).toBe('tpl-new');
  expect(templateRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({ caseType: 'WORK' }),
  );
}

/**
 * 断言同 `caseType` 重复激活模板被拒绝。
 *
 * @returns 异步断言完成的 Promise
 */
async function runRejectDuplicateTemplateTest(): Promise<void> {
  templateRepo.findOne.mockResolvedValueOnce(buildTemplate());

  await expect(
    service.create({
      caseType: 'WORK',
      displayName: 'duplicate',
      items: [{ groupName: 'g', itemName: 'i' }],
    }),
  ).rejects.toThrow(BadRequestException);
}

/**
 * 断言更新模板 `displayName` 成功。
 *
 * @returns 异步断言完成的 Promise
 */
async function runUpdateTemplateDisplayNameTest(): Promise<void> {
  const tpl = buildTemplate();
  templateRepo.findOne
    .mockResolvedValueOnce(tpl)
    .mockResolvedValueOnce({ ...tpl, displayName: '更新済み' });

  const result = await service.update('tpl-1', { displayName: '更新済み' });

  expect(result.displayName).toBe('更新済み');
}

/**
 * 断言更新不存在的模板抛出 `NotFoundException`。
 *
 * @returns 异步断言完成的 Promise
 */
async function runUpdateMissingTemplateTest(): Promise<void> {
  templateRepo.findOne.mockResolvedValue(null);

  await expect(
    service.update('nonexistent', { displayName: 'x' }),
  ).rejects.toThrow(NotFoundException);
}

/**
 * 断言更新模板时删除旧项并保存新项。
 *
 * @returns 异步断言完成的 Promise
 */
async function runUpdateTemplateReplaceItemsTest(): Promise<void> {
  const tpl = buildTemplate({
    items: [buildTemplateItem({ id: 'ti-old' })],
  });
  templateRepo.findOne
    .mockResolvedValueOnce(tpl)
    .mockResolvedValueOnce(
      buildTemplate({ items: [buildTemplateItem({ id: 'ti-new' })] }),
    );

  await service.update('tpl-1', {
    items: [
      {
        groupName: '新グループ',
        itemName: '新材料',
        scope: MaterialItemScope.CASE,
      },
    ],
  });

  expect(templateItemRepo.delete).toHaveBeenCalled();
  expect(templateItemRepo.save).toHaveBeenCalled();
}

/**
 * 断言停用模板并软删。
 *
 * @returns 异步断言完成的 Promise
 */
async function runDeactivateTemplateTest(): Promise<void> {
  templateRepo.findOne.mockResolvedValue(buildTemplate());

  await service.deactivate('tpl-1');

  expect(templateRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ isActive: false }),
  );
  expect(templateRepo.softRemove).toHaveBeenCalled();
}

/**
 * 断言停用不存在的模板抛出 `NotFoundException`。
 *
 * @returns 异步断言完成的 Promise
 */
async function runDeactivateMissingTemplateTest(): Promise<void> {
  templateRepo.findOne.mockResolvedValue(null);

  await expect(service.deactivate('nonexistent')).rejects.toThrow(
    NotFoundException,
  );
}

/**
 * 断言按 `caseType` 查询激活模板命中。
 *
 * @returns 异步断言完成的 Promise
 */
async function runFindActiveByCaseTypeHitTest(): Promise<void> {
  const tpl = buildTemplate();
  templateRepo.findOne.mockResolvedValue(tpl);

  const result = await service.findActiveByCaseType('WORK');

  expect(result).toBeTruthy();
  expect(templateRepo.findOne).toHaveBeenCalledWith({
    where: { caseType: 'WORK', isActive: true },
    relations: ['items'],
  });
}

/**
 * 断言无激活模板时返回 `null`。
 *
 * @returns 异步断言完成的 Promise
 */
async function runFindActiveByCaseTypeNullTest(): Promise<void> {
  templateRepo.findOne.mockResolvedValue(null);

  const result = await service.findActiveByCaseType('NONEXISTENT');

  expect(result).toBeNull();
}

beforeEach(async () => {
  await resetMaterialTemplateFixture();
});

describe('MaterialTemplateService', () => {
  describe('findAll', () => {
    it('should return all templates with sorted items', () =>
      runFindAllSortedItemsTest());
  });

  describe('create', () => {
    it('should create a template with items', () =>
      runCreateTemplateWithItemsTest());
    it('should reject duplicate active template for same caseType', () =>
      runRejectDuplicateTemplateTest());
  });

  describe('update', () => {
    it('should update template displayName', () =>
      runUpdateTemplateDisplayNameTest());
    it('should throw NotFoundException for non-existent template', () =>
      runUpdateMissingTemplateTest());
    it('should delete removed items and add new ones', () =>
      runUpdateTemplateReplaceItemsTest());
  });

  describe('deactivate', () => {
    it('should deactivate and soft-delete the template', () =>
      runDeactivateTemplateTest());
    it('should throw NotFoundException for non-existent template', () =>
      runDeactivateMissingTemplateTest());
  });

  describe('findActiveByCaseType', () => {
    it('should return active template for given caseType', () =>
      runFindActiveByCaseTypeHitTest());
    it('should return null when no active template exists', () =>
      runFindActiveByCaseTypeNullTest());
  });
});
