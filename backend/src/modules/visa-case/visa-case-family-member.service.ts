import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateVisaCaseFamilyMemberDto } from './dto/create-visa-case-family-member.dto';
import { UpdateVisaCaseFamilyMemberDto } from './dto/update-visa-case-family-member.dto';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import type { FamilyMemberResponseDto } from './visa-case.types';
import { VisaCaseLookupService } from './visa-case-lookup.service';

/**
 * 管理签证案件下家属成员的增删改查与主申请人唯一性约束。
 */
@Injectable()
export class VisaCaseFamilyMemberService {
  constructor(
    @InjectRepository(VisaCaseFamilyMember)
    private readonly familyMemberRepo: Repository<VisaCaseFamilyMember>,
    private readonly lookup: VisaCaseLookupService,
  ) {}

  /**
   * 查询指定签证案件下的全部家属成员列表。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @returns 按主申请人优先排列的家属成员列表
   * @throws {NotFoundException} 案件不存在时
   */
  async listFamilyMembers(
    visaCaseId: string,
  ): Promise<FamilyMemberResponseDto[]> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const members = await this.familyMemberRepo.find({
      where: { visaCaseId },
      relations: ['customer'],
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    return members.map((fm) => ({
      id: fm.id,
      customerId: fm.customerId,
      customerName: fm.customer?.customerName ?? null,
      memberRole: fm.memberRole,
      isPrimary: fm.isPrimary,
      displayNameSnapshot: fm.displayNameSnapshot,
    }));
  }

  /**
   * 向指定签证案件挂载一名家属成员，同一客户不可重复挂载，isPrimary 时自动取消原主申请人标记。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param dto - 家属成员创建参数
   * @returns 新创建的家属成员响应对象
   * @throws {NotFoundException} 案件或目标客户不存在时
   * @throws {BadRequestException} 同一客户已挂载到该案件时
   */
  async addFamilyMember(
    visaCaseId: string,
    dto: CreateVisaCaseFamilyMemberDto,
  ): Promise<FamilyMemberResponseDto> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);
    await this.lookup.ensureCustomerExists(dto.customerId);

    const duplicate = await this.familyMemberRepo.findOne({
      where: { visaCaseId, customerId: dto.customerId },
    });
    if (duplicate) {
      throw new BadRequestException(
        'この顧客は既に案件メンバーとして登録されています',
      );
    }

    if (dto.isPrimary) {
      await this.clearPrimaryFlag(visaCaseId);
    }

    const member = this.familyMemberRepo.create({
      visaCaseId,
      customerId: dto.customerId,
      memberRole: dto.memberRole,
      isPrimary: dto.isPrimary ?? false,
      displayNameSnapshot: dto.displayNameSnapshot,
    });

    const saved = await this.familyMemberRepo.save(member);

    const loaded = await this.familyMemberRepo.findOne({
      where: { id: saved.id },
      relations: ['customer'],
    });

    return {
      id: loaded!.id,
      customerId: loaded!.customerId,
      customerName: loaded!.customer?.customerName ?? null,
      memberRole: loaded!.memberRole,
      isPrimary: loaded!.isPrimary,
      displayNameSnapshot: loaded!.displayNameSnapshot,
    };
  }

  /**
   * 更新指定家属成员的角色或主申请人标记，isPrimary 变更时自动维护唯一主申请人约束。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @param dto - 允许修改的字段集
   * @returns 更新后的家属成员响应对象
   * @throws {NotFoundException} 案件或成员记录不存在时
   */
  async updateFamilyMember(
    visaCaseId: string,
    memberId: string,
    dto: UpdateVisaCaseFamilyMemberDto,
  ): Promise<FamilyMemberResponseDto> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const member = await this.familyMemberRepo.findOne({
      where: { id: memberId, visaCaseId },
      relations: ['customer'],
    });
    if (!member) {
      throw new NotFoundException('案件メンバーが見つかりません');
    }

    if (dto.isPrimary && !member.isPrimary) {
      await this.clearPrimaryFlag(visaCaseId);
    }

    Object.assign(member, dto);
    const saved = await this.familyMemberRepo.save(member);

    return {
      id: saved.id,
      customerId: saved.customerId,
      customerName: saved.customer?.customerName ?? null,
      memberRole: saved.memberRole,
      isPrimary: saved.isPrimary,
      displayNameSnapshot: saved.displayNameSnapshot,
    };
  }

  /**
   * 从签证案件中移除指定家属成员记录。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @throws {NotFoundException} 案件或成员记录不存在时
   */
  async removeFamilyMember(
    visaCaseId: string,
    memberId: string,
  ): Promise<void> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const member = await this.familyMemberRepo.findOne({
      where: { id: memberId, visaCaseId },
    });
    if (!member) {
      throw new NotFoundException('案件メンバーが見つかりません');
    }

    await this.familyMemberRepo.remove(member);
  }

  /**
   * 将指定案件内已有的主申请人标记清除，为新主申请人让位。
   *
   * @param visaCaseId - 目标签证案件 ID
   */
  async clearPrimaryFlag(visaCaseId: string): Promise<void> {
    const existing = await this.familyMemberRepo.findOne({
      where: { visaCaseId, isPrimary: true },
    });
    if (existing) {
      existing.isPrimary = false;
      await this.familyMemberRepo.save(existing);
    }
  }
}
