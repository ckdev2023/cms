import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { MaterialItemScope } from '../../common/constants/enums';
import { CreateMaterialTemplateDto } from './dto/create-material-template.dto';
import { UpdateMaterialTemplateDto } from './dto/update-material-template.dto';
import { MaterialTemplate } from './entities/material-template.entity';
import { MaterialTemplateItem } from './entities/material-template-item.entity';
import { mapMaterialTemplateToResponseDto } from './visa-case.mapper';
import type { MaterialTemplateResponseDto } from './visa-case.types';

/**
 * 管理全局材料模板的增删改查，供系统管理员按签证案件类型维护标准材料清单。
 *
 * 同一 `caseType` 下最多存在一个活跃模板（由 DB 部分唯一索引约束）。
 * 停用（逻辑删除）后的模板不再被新建案件引用，但已实例化的案件材料不受影响。
 */
@Injectable()
export class MaterialTemplateService {
  private readonly logger = new Logger(MaterialTemplateService.name);

  constructor(
    @InjectRepository(MaterialTemplate)
    private readonly templateRepo: Repository<MaterialTemplate>,
    @InjectRepository(MaterialTemplateItem)
    private readonly templateItemRepo: Repository<MaterialTemplateItem>,
  ) {}

  /**
   * 读取所有活跃（未软删除）的材料模板及其子项列表。
   *
   * @returns 按 caseType 排序的活跃模板数组
   */
  async findAll(): Promise<MaterialTemplateResponseDto[]> {
    const templates = await this.templateRepo.find({
      relations: ['items'],
      order: { caseType: 'ASC' },
    });
    return templates.map(mapMaterialTemplateToResponseDto);
  }

  /**
   * 创建材料模板并批量写入模板项。
   *
   * @param dto - 包含 caseType、displayName 与子项列表的创建参数
   * @returns 已持久化的模板响应对象
   * @throws {BadRequestException} 同一 caseType 已有活跃模板时
   */
  async create(
    dto: CreateMaterialTemplateDto,
  ): Promise<MaterialTemplateResponseDto> {
    const existing = await this.templateRepo.findOne({
      where: { caseType: dto.caseType, isActive: true },
    });
    if (existing) {
      throw new BadRequestException(
        `案件タイプ「${dto.caseType}」のアクティブテンプレートが既に存在します`,
      );
    }

    const template = this.templateRepo.create({
      caseType: dto.caseType,
      displayName: dto.displayName,
      isActive: true,
      items: dto.items.map((item) =>
        this.templateItemRepo.create({
          groupName: item.groupName,
          itemName: item.itemName,
          scope: item.scope ?? MaterialItemScope.CASE,
          sortOrder: item.sortOrder ?? 0,
          isRequired: item.isRequired ?? true,
        }),
      ),
    });

    const saved = await this.templateRepo.save(template);
    this.logger.log(`Material template created for caseType=${dto.caseType}`);
    return this.findOneOrFail(saved.id);
  }

  /**
   * 更新模板显示名称或全量替换模板项。
   *
   * 不在 `items` 数组中出现的已有项会被物理删除（全量替换语义）。
   *
   * @param id - 模板 ID
   * @param dto - 包含可选 displayName 与全量 items 的更新参数
   * @returns 更新后的模板响应对象
   * @throws {NotFoundException} 模板不存在或已停用时
   */
  async update(
    id: string,
    dto: UpdateMaterialTemplateDto,
  ): Promise<MaterialTemplateResponseDto> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!template) {
      throw new NotFoundException('テンプレートが見つかりません');
    }

    if (dto.displayName !== undefined) {
      template.displayName = dto.displayName;
    }

    if (dto.items !== undefined) {
      const incomingIds = dto.items
        .filter((i) => i.id)
        .map((i) => i.id as string);
      const existingIds = template.items.map((i) => i.id);
      const toDeleteIds = existingIds.filter(
        (eid) => !incomingIds.includes(eid),
      );

      if (toDeleteIds.length > 0) {
        await this.templateItemRepo.delete({ id: In(toDeleteIds) });
      }

      const newItems: MaterialTemplateItem[] = [];
      for (const itemDto of dto.items) {
        if (itemDto.id) {
          const existing = template.items.find((i) => i.id === itemDto.id);
          if (existing) {
            existing.groupName = itemDto.groupName;
            existing.itemName = itemDto.itemName;
            existing.scope = itemDto.scope ?? existing.scope;
            existing.sortOrder = itemDto.sortOrder ?? existing.sortOrder;
            existing.isRequired = itemDto.isRequired ?? existing.isRequired;
            newItems.push(existing);
          }
        } else {
          newItems.push(
            this.templateItemRepo.create({
              templateId: id,
              groupName: itemDto.groupName,
              itemName: itemDto.itemName,
              scope: itemDto.scope ?? MaterialItemScope.CASE,
              sortOrder: itemDto.sortOrder ?? 0,
              isRequired: itemDto.isRequired ?? true,
            }),
          );
        }
      }

      await this.templateItemRepo.save(newItems);
    }

    await this.templateRepo.save(template);
    this.logger.log(`Material template ${id} updated`);
    return this.findOneOrFail(id);
  }

  /**
   * 停用指定模板（软删除），停用后新建案件不再引用。
   *
   * @param id - 模板 ID
   * @throws {NotFoundException} 模板不存在时
   */
  async deactivate(id: string): Promise<void> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('テンプレートが見つかりません');
    }

    template.isActive = false;
    await this.templateRepo.save(template);
    await this.templateRepo.softRemove(template);
    this.logger.log(`Material template ${id} deactivated`);
  }

  /**
   * 按 caseType 查找活跃模板并加载子项，供实例化流程使用。
   *
   * @param caseType - 签证案件类型
   * @returns 匹配的模板或 null
   */
  async findActiveByCaseType(
    caseType: string,
  ): Promise<MaterialTemplate | null> {
    return this.templateRepo.findOne({
      where: { caseType, isActive: true },
      relations: ['items'],
    });
  }

  /**
   * 按 ID 查找模板并加载子项，不存在时抛异常。
   *
   * @param id - 模板 ID
   * @returns 加载了子项的模板响应 DTO
   * @throws {NotFoundException} 模板不存在时
   */
  private async findOneOrFail(
    id: string,
  ): Promise<MaterialTemplateResponseDto> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!template) {
      throw new NotFoundException('テンプレートが見つかりません');
    }
    return mapMaterialTemplateToResponseDto(template);
  }
}
