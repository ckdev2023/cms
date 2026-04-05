import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FamilyLinkMode,
  VisaCaseMemberRole,
} from '../../common/constants/enums';
import { Customer } from '../customer/entities/customer.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseLookupService } from './visa-case-lookup.service';

/**
 * 封装 INTERNAL / EXTERNAL 家族签下主申请人解析、校验与家属主档同步，供建案与更新复用。
 */
@Injectable()
export class VisaCaseInternalPrimaryService {
  constructor(
    @InjectRepository(VisaCaseFamilyMember)
    private readonly familyMemberRepo: Repository<VisaCaseFamilyMember>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly lookup: VisaCaseLookupService,
  ) {}

  /**
   * 统一解析 INTERNAL 家族签场景下的主申请人客户 ID，并提前完成存在性校验。
   *
   * @param params - INTERNAL 家族签模式的主申请人解析参数集合
   * @param params.isFamilyCase - 当前案件是否标记为家族签
   * @param params.familyLinkMode - 当前案件采用的家族关联模式
   * @param params.internalPrimaryCustomerId - 待校验的主申请人客户 ID
   * @returns INTERNAL 家族签时返回已校验的主申请人 ID，否则返回 null
   * @throws {BadRequestException} INTERNAL 模式缺少主申请人 ID 时
   * @throws {NotFoundException} 主申请人客户不存在时
   */
  async resolveInternalPrimaryCustomerId(params: {
    isFamilyCase: boolean | undefined;
    familyLinkMode: FamilyLinkMode | string | null | undefined;
    internalPrimaryCustomerId: string | null | undefined;
  }): Promise<string | null> {
    if (
      !this.isInternalFamilyCase(
        Boolean(params.isFamilyCase),
        params.familyLinkMode,
      )
    ) {
      return null;
    }

    if (!params.internalPrimaryCustomerId) {
      throw new BadRequestException('INTERNAL家族案件では主申請者IDが必須です');
    }

    await this.lookup.ensureCustomerExists(params.internalPrimaryCustomerId);
    return params.internalPrimaryCustomerId;
  }

  /**
   * 校验 EXTERNAL 家族签模式下外部主申请人姓名不为空，保证快照最小完整性。
   *
   * @param isFamilyCase - 当前案件是否标记为家族签
   * @param familyLinkMode - 当前案件采用的家族关联模式
   * @param externalPrimaryName - 外部主申请人姓名
   * @throws {BadRequestException} EXTERNAL 模式下姓名为空时
   */
  validateExternalPrimary(
    isFamilyCase: boolean | undefined,
    familyLinkMode: FamilyLinkMode | string | null | undefined,
    externalPrimaryName: string | null | undefined,
  ): void {
    if (
      this.isExternalFamilyCase(!!isFamilyCase, familyLinkMode) &&
      !externalPrimaryName
    ) {
      throw new BadRequestException(
        'EXTERNAL家族案件では外部主申請者名が必須です',
      );
    }
  }

  /**
   * 判断案件是否处于 INTERNAL 家族签模式，供创建与更新流程复用同一业务分支。
   *
   * @param isFamilyCase - 当前案件是否标记为家族签
   * @param familyLinkMode - 当前案件采用的家族关联模式
   * @returns 命中 INTERNAL 家族签模式时返回 true
   */
  isInternalFamilyCase(
    isFamilyCase: boolean,
    familyLinkMode: FamilyLinkMode | string | null | undefined,
  ): boolean {
    return isFamilyCase && familyLinkMode === FamilyLinkMode.INTERNAL;
  }

  /**
   * 判断案件是否处于 EXTERNAL 家族签模式，用于决定外部主申请人快照字段的保存与清理逻辑。
   *
   * @param isFamilyCase - 当前案件是否标记为家族签
   * @param familyLinkMode - 当前案件采用的家族关联模式
   * @returns 命中 EXTERNAL 家族签模式时返回 true
   */
  isExternalFamilyCase(
    isFamilyCase: boolean,
    familyLinkMode: FamilyLinkMode | string | null | undefined,
  ): boolean {
    return isFamilyCase && familyLinkMode === FamilyLinkMode.EXTERNAL;
  }

  /**
   * 切换到 EXTERNAL 模式时移除案件中已存在的 INTERNAL 主申请人家属记录。
   *
   * @param visaCaseId - 目标签证案件 ID
   */
  async removeInternalPrimaryMember(visaCaseId: string): Promise<void> {
    const existing = await this.familyMemberRepo.findOne({
      where: { visaCaseId, isPrimary: true },
    });
    if (existing) {
      await this.familyMemberRepo.remove(existing);
    }
  }

  /**
   * 为 INTERNAL 家族签案件写入主申请人家属记录，保证创建流程与更新流程共享同一写入逻辑。
   *
   * @param visaCaseId - 目标签证案件 ID
   * @param primaryCustomerId - 主申请人客户 ID
   */
  async createInternalPrimaryMember(
    visaCaseId: string,
    primaryCustomerId: string,
  ): Promise<void> {
    const customer = await this.customerRepo.findOne({
      where: { id: primaryCustomerId },
    });

    await this.familyMemberRepo.save(
      this.familyMemberRepo.create({
        visaCaseId,
        customerId: primaryCustomerId,
        memberRole: VisaCaseMemberRole.APPLICANT,
        isPrimary: true,
        displayNameSnapshot: customer?.customerName ?? '',
      }),
    );
  }

  /**
   * INTERNAL 模式变更主申请人时，移除旧主申请人家属记录并创建新记录，保证唯一性。
   *
   * @param visaCaseId - 目标签证案件 ID
   * @param primaryCustomerId - 新主申请人客户 ID
   */
  async syncInternalPrimaryMember(
    visaCaseId: string,
    primaryCustomerId: string,
  ): Promise<void> {
    const existing = await this.familyMemberRepo.findOne({
      where: { visaCaseId, isPrimary: true },
    });

    if (existing && existing.customerId === primaryCustomerId) {
      return;
    }

    if (existing) {
      await this.familyMemberRepo.remove(existing);
    }

    await this.createInternalPrimaryMember(visaCaseId, primaryCustomerId);
  }
}
