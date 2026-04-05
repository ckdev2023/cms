import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  MaterialItemScope,
  MaterialItemStatus,
} from '../../common/constants/enums';
import { CreateVisaCaseMaterialItemDto } from './dto/create-visa-case-material-item.dto';
import { UpdateVisaCaseMaterialItemDto } from './dto/update-visa-case-material-item.dto';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import { computeSuggestedMaterialStatusFromChecklistCounts } from './material-checklist-suggested-status.util';
import { MaterialTemplateService } from './material-template.service';
import { mapMaterialItemToResponseDto } from './visa-case.mapper';
import type {
  MaterialSummaryResponseDto,
  VisaCaseMaterialItemResponseDto,
} from './visa-case.types';
import { VisaCaseLookupService } from './visa-case-lookup.service';

/**
 * 管理案件材料实例的全生命周期：从模板实例化、手动新增、状态变更到建议摘要与同步。
 *
 * 材料实例在从模板实例化后与模板脱钩（快照隔离），操作员可自由新增或标记"不适用"。
 * `NOT_APPLICABLE` 状态的项不参与建议 `material_status` 计算。
 */
@Injectable()
export class VisaCaseMaterialService {
  private readonly logger = new Logger(VisaCaseMaterialService.name);

  constructor(
    @InjectRepository(VisaCaseMaterialItem)
    private readonly materialItemRepo: Repository<VisaCaseMaterialItem>,
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    @InjectRepository(VisaCaseFamilyMember)
    private readonly familyMemberRepo: Repository<VisaCaseFamilyMember>,
    private readonly lookup: VisaCaseLookupService,
    private readonly templateService: MaterialTemplateService,
  ) {}

  /**
   * 从模板实例化材料项到指定案件，幂等操作——已有实例时跳过。
   *
   * CASE scope 项创建一条；MEMBER scope 项按已挂载家属（含主申请人）各创建一条。
   * 无匹配模板时返回空数组而非报错。
   *
   * @param visaCaseId - 签证案件 ID
   * @param userId - 当前操作用户 ID
   * @returns 实例化后的材料项列表
   * @throws {NotFoundException} 案件不存在时
   */
  async initialize(
    visaCaseId: string,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto[]> {
    const visaCase = await this.visaCaseRepo.findOne({
      where: { id: visaCaseId },
    });
    if (!visaCase) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }

    const existingCount = await this.materialItemRepo.count({
      where: { visaCaseId },
    });
    if (existingCount > 0) {
      return this.findByVisaCase(visaCaseId);
    }

    if (!visaCase.caseType) {
      return [];
    }

    const template = await this.templateService.findActiveByCaseType(
      visaCase.caseType,
    );
    if (!template) {
      return [];
    }

    const familyMembers = await this.familyMemberRepo.find({
      where: { visaCaseId },
      order: { isPrimary: 'DESC' },
    });

    const items = this.buildDraftMaterialItemsFromTemplateRows(
      template.items,
      visaCaseId,
      userId,
      familyMembers,
    );

    if (items.length > 0) {
      await this.materialItemRepo.save(items);
    }

    this.logger.log(
      `Initialized ${items.length} material items for visa case ${visaCaseId}`,
    );
    return this.findByVisaCase(visaCaseId);
  }

  /**
   * 按模板行与家属列表生成待落库的材料实例草稿（未 `save`）。
   *
   * @param templateItems - 激活模板下的条目定义
   * @param visaCaseId - 目标案件 ID
   * @param userId - 创建人用户 ID
   * @param familyMembers - 已挂载家属（主申请人在前）
   * @returns `materialItemRepo.create` 产生的实体草稿数组
   */
  private buildDraftMaterialItemsFromTemplateRows(
    templateItems: MaterialTemplateItem[],
    visaCaseId: string,
    userId: string,
    familyMembers: VisaCaseFamilyMember[],
  ): VisaCaseMaterialItem[] {
    const items: VisaCaseMaterialItem[] = [];

    for (const tplItem of templateItems) {
      if (tplItem.scope === MaterialItemScope.CASE) {
        items.push(
          this.materialItemRepo.create({
            visaCaseId,
            templateItemId: tplItem.id,
            visaCaseFamilyMemberId: null,
            groupName: tplItem.groupName,
            itemName: tplItem.itemName,
            itemStatus: MaterialItemStatus.NOT_COLLECTED,
            sortOrder: tplItem.sortOrder,
            createdBy: userId,
          }),
        );
      } else if (familyMembers.length === 0) {
        items.push(
          this.materialItemRepo.create({
            visaCaseId,
            templateItemId: tplItem.id,
            visaCaseFamilyMemberId: null,
            groupName: tplItem.groupName,
            itemName: tplItem.itemName,
            itemStatus: MaterialItemStatus.NOT_COLLECTED,
            sortOrder: tplItem.sortOrder,
            createdBy: userId,
          }),
        );
      } else {
        for (const fm of familyMembers) {
          items.push(
            this.materialItemRepo.create({
              visaCaseId,
              templateItemId: tplItem.id,
              visaCaseFamilyMemberId: fm.id,
              groupName: tplItem.groupName,
              itemName: tplItem.itemName,
              itemStatus: MaterialItemStatus.NOT_COLLECTED,
              sortOrder: tplItem.sortOrder,
              createdBy: userId,
            }),
          );
        }
      }
    }

    return items;
  }

  /**
   * 查询指定案件下的全部材料项，加载家属归属关联。
   *
   * @param visaCaseId - 签证案件 ID
   * @returns 按 sortOrder 排序的材料项列表
   * @throws {NotFoundException} 案件不存在时
   */
  async findByVisaCase(
    visaCaseId: string,
  ): Promise<VisaCaseMaterialItemResponseDto[]> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const items = await this.materialItemRepo.find({
      where: { visaCaseId },
      relations: ['familyMember'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return items.map(mapMaterialItemToResponseDto);
  }

  /**
   * 手动新增一条材料项（不关联模板），支持指定成员归属。
   *
   * @param visaCaseId - 签证案件 ID
   * @param dto - 手动材料项创建参数
   * @param userId - 当前操作用户 ID
   * @returns 新创建的材料项响应 DTO
   * @throws {NotFoundException} 案件不存在或指定家属成员不存在时
   */
  async createItem(
    visaCaseId: string,
    dto: CreateVisaCaseMaterialItemDto,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    if (dto.visaCaseFamilyMemberId) {
      await this.ensureFamilyMemberExists(
        visaCaseId,
        dto.visaCaseFamilyMemberId,
      );
    }

    const item = this.materialItemRepo.create({
      visaCaseId,
      templateItemId: null,
      visaCaseFamilyMemberId: dto.visaCaseFamilyMemberId ?? null,
      groupName: dto.groupName,
      itemName: dto.itemName,
      itemStatus: MaterialItemStatus.NOT_COLLECTED,
      sortOrder: dto.sortOrder ?? 0,
      remark: dto.remark ?? null,
      createdBy: userId,
    });

    const saved = await this.materialItemRepo.save(item);
    this.logger.log(`Manual material item created for case ${visaCaseId}`);

    const loaded = await this.materialItemRepo.findOne({
      where: { id: saved.id },
      relations: ['familyMember'],
    });
    return mapMaterialItemToResponseDto(loaded!);
  }

  /**
   * 更新材料项的状态、备注或排序，勾选为 COLLECTED 时自动记录收集时间戳。
   *
   * @param visaCaseId - 签证案件 ID
   * @param itemId - 材料项 ID
   * @param dto - 部分更新字段
   * @returns 更新后的材料项响应 DTO
   * @throws {NotFoundException} 案件或材料项不存在时
   */
  async updateItem(
    visaCaseId: string,
    itemId: string,
    dto: UpdateVisaCaseMaterialItemDto,
  ): Promise<VisaCaseMaterialItemResponseDto> {
    const item = await this.materialItemRepo.findOne({
      where: { id: itemId, visaCaseId },
      relations: ['familyMember'],
    });
    if (!item) {
      throw new NotFoundException('材料項目が見つかりません');
    }

    if (dto.itemStatus !== undefined) {
      item.itemStatus = dto.itemStatus;
      if (
        dto.itemStatus === MaterialItemStatus.COLLECTED &&
        !item.collectedAt
      ) {
        item.collectedAt = new Date();
      }
      if (dto.itemStatus !== MaterialItemStatus.COLLECTED) {
        item.collectedAt = null;
      }
    }
    if (dto.remark !== undefined) {
      item.remark = dto.remark ?? null;
    }
    if (dto.sortOrder !== undefined) {
      item.sortOrder = dto.sortOrder;
    }

    await this.materialItemRepo.save(item);
    this.logger.log(`Material item ${itemId} updated`);
    return mapMaterialItemToResponseDto(item);
  }

  /**
   * 删除手动新增的材料项；模板来源的项只能标不适用，不可物理删除。
   *
   * @param visaCaseId - 签证案件 ID
   * @param itemId - 材料项 ID
   * @throws {NotFoundException} 案件或材料项不存在时
   * @throws {BadRequestException} 尝试删除模板来源项时
   */
  async deleteItem(visaCaseId: string, itemId: string): Promise<void> {
    const item = await this.materialItemRepo.findOne({
      where: { id: itemId, visaCaseId },
    });
    if (!item) {
      throw new NotFoundException('材料項目が見つかりません');
    }
    if (item.templateItemId) {
      throw new BadRequestException(
        'テンプレート由来の項目は削除できません。「該当なし」に変更してください',
      );
    }

    await this.materialItemRepo.remove(item);
    this.logger.log(`Manual material item ${itemId} deleted`);
  }

  /**
   * 计算案件材料的完成统计与建议 material_status，同时返回当前持久化状态。
   *
   * NOT_APPLICABLE 项不参与分子分母计算。
   * `currentStatus` 取自 `visa_cases.material_status`，供前端对比是否需要同步。
   *
   * @param visaCaseId - 签证案件 ID
   * @returns 含完成数、未完成数、当前持久化状态与建议状态的摘要
   * @throws {NotFoundException} 案件不存在时
   */
  async getSummary(visaCaseId: string): Promise<MaterialSummaryResponseDto> {
    const visaCase = await this.visaCaseRepo.findOne({
      where: { id: visaCaseId },
      select: ['id', 'materialStatus'],
    });
    if (!visaCase) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }

    const items = await this.materialItemRepo.find({
      where: { visaCaseId },
    });

    let collected = 0;
    let notCollected = 0;
    let notApplicable = 0;

    for (const item of items) {
      switch (item.itemStatus) {
        case MaterialItemStatus.COLLECTED:
          collected++;
          break;
        case MaterialItemStatus.NOT_APPLICABLE:
          notApplicable++;
          break;
        default:
          notCollected++;
          break;
      }
    }

    const suggestedStatus = computeSuggestedMaterialStatusFromChecklistCounts(
      collected,
      notApplicable,
      items.length,
    );

    return {
      total: items.length,
      collected,
      notCollected,
      notApplicable,
      currentStatus: visaCase.materialStatus ?? null,
      suggestedStatus,
    };
  }

  /**
   * 将 checklist 建议的 material_status 同步写入 visa_cases 表，返回同步后的摘要。
   *
   * 同步后 `currentStatus` 与 `suggestedStatus` 一致。
   *
   * @param visaCaseId - 签证案件 ID
   * @returns 同步后的摘要（currentStatus 已更新）
   * @throws {NotFoundException} 案件不存在时
   */
  async syncStatus(visaCaseId: string): Promise<MaterialSummaryResponseDto> {
    const summary = await this.getSummary(visaCaseId);

    await this.visaCaseRepo.update(visaCaseId, {
      materialStatus: summary.suggestedStatus,
    });

    this.logger.log(
      `Synced material status to ${summary.suggestedStatus} for case ${visaCaseId}`,
    );
    return {
      ...summary,
      currentStatus: summary.suggestedStatus,
    };
  }

  /**
   * 校验指定家属成员是否挂载到目标案件。
   *
   * @param visaCaseId - 签证案件 ID
   * @param memberId - 家属成员 ID
   * @throws {NotFoundException} 成员不存在或不属于该案件时
   */
  private async ensureFamilyMemberExists(
    visaCaseId: string,
    memberId: string,
  ): Promise<void> {
    const count = await this.familyMemberRepo.count({
      where: { id: memberId, visaCaseId },
    });
    if (!count) {
      throw new NotFoundException('家族メンバーが見つかりません');
    }
  }
}
