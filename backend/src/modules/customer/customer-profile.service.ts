import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessType, CustomerType } from '../../common/constants/enums';
import { FileEntity } from '../file/entities/file.entity';
import {
  CompanyInfoDto,
  CreateCustomerDto,
  PersonInfoDto,
} from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

const CUSTOMER_PHOTO_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

/**
 * 维护客户附属公司/个人档案的创建、更新与类型切换时的重建逻辑。
 */
@Injectable()
export class CustomerProfileService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CompanyInfo)
    private readonly companyInfoRepo: Repository<CompanyInfo>,
    @InjectRepository(PersonInfo)
    private readonly personInfoRepo: Repository<PersonInfo>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  /**
   * 根据创建参数构建客户主实体，统一补齐审计字段与可空值。
   *
   * @param dto - 客户创建请求体
   * @param customerCode - 已生成且通过唯一性校验的客户编码
   * @param userId - 当前登录用户 ID
   * @returns 可直接持久化的客户实体
   */
  buildCustomerEntity(
    dto: CreateCustomerDto,
    customerCode: string,
    userId?: string,
  ): Customer {
    return this.customerRepo.create({
      customerCode,
      customerType: dto.customerType,
      customerName: dto.customerName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      wechatId: dto.wechatId ?? null,
      lineId: dto.lineId ?? null,
      address: dto.address ?? null,
      serviceType: dto.serviceType,
      ownerUserId: dto.ownerUserId ?? null,
      photoFileId: dto.photoFileId ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
  }

  /**
   * 在客户主档创建成功后按请求内容补建公司或个人附属资料。
   *
   * @param customerId - 已保存客户的主键 ID
   * @param dto - 客户创建请求体
   */
  async createRelatedProfile(
    customerId: string,
    dto: CreateCustomerDto,
  ): Promise<void> {
    if (this.hasCompanyDtoContent(dto.companyInfo)) {
      await this.createCompanyInfoIfProvided(customerId, dto.companyInfo);
    }

    if (this.hasPersonDtoContent(dto.personInfo)) {
      await this.createPersonInfoIfProvided(customerId, dto.personInfo);
    }
  }

  /**
   * 将更新请求中的基础字段合并到客户实体。
   *
   * @param customer - 当前数据库中的客户实体
   * @param dto - 局部更新请求体
   * @param userId - 当前登录用户 ID
   */
  applyBasicCustomerUpdates(
    customer: Customer,
    dto: UpdateCustomerDto,
    userId?: string,
  ): void {
    if (dto.customerName !== undefined) {
      customer.customerName = dto.customerName;
    }
    this.applyContactIdentifiers(customer, dto);

    if (dto.address !== undefined) {
      customer.address = dto.address ?? null;
    }

    if (dto.serviceType !== undefined) {
      customer.serviceType = dto.serviceType;
    }

    if (dto.ownerUserId !== undefined) {
      customer.ownerUserId = dto.ownerUserId ?? null;
    }

    if (dto.photoFileId !== undefined) {
      customer.photoFileId = dto.photoFileId ?? null;
    }

    customer.updatedBy = userId ?? null;
  }

  /**
   * 校验客户头像文件可被绑定：须为 CUSTOMER 业务下的图片附件，且客户归属与入参一致。
   *
   * @param fileId - `files` 主键
   * @param customerId - 已存在客户 ID；新建主档尚未落库时传 `null` 并要求文件尚未绑定客户
   * @throws {BadRequestException} 记录不存在、类型不符或非图片时
   */
  async assertCustomerPhotoFileAssignable(
    fileId: string,
    customerId: string | null,
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) {
      throw new BadRequestException('指定された顔写真ファイルが存在しません');
    }
    if (file.businessType !== BusinessType.CUSTOMER) {
      throw new BadRequestException(
        '顔写真は顧客（CUSTOMER）区分でアップロードされた画像ファイルのみ指定できます',
      );
    }
    const ext = (file.fileExt ?? '').toLowerCase();
    const mime = file.mimeType ?? '';
    const looksImage =
      mime.startsWith('image/') || CUSTOMER_PHOTO_IMAGE_EXTENSIONS.has(ext);
    if (!looksImage) {
      throw new BadRequestException(
        '顔写真には画像ファイル（jpg/png/gif/webp 等）のみ指定できます',
      );
    }
    if (customerId === null) {
      if (file.customerId !== null) {
        throw new BadRequestException(
          '新規顧客に紐付ける顔写真は、未紐付けのファイルのみ指定できます',
        );
      }
      return;
    }
    if (file.customerId !== null && file.customerId !== customerId) {
      throw new BadRequestException(
        '指定された顔写真ファイルは別の顧客に紐付いています',
      );
    }
  }

  /**
   * 将头像文件的 `customerId` 写入当前客户，便于文件中心筛选与权限一致。
   *
   * @param fileId - `files` 主键
   * @param customerId - 客户主键
   */
  async linkPhotoFileToCustomer(
    fileId: string,
    customerId: string,
  ): Promise<void> {
    await this.fileRepo.update({ id: fileId }, { customerId });
  }

  /**
   * 将电话、邮箱、微信与 LINE 等可空联系方式字段按局部更新语义写入客户实体。
   *
   * @param customer - 当前数据库中的客户实体
   * @param dto - 局部更新请求体
   * @returns void
   */
  private applyContactIdentifiers(
    customer: Customer,
    dto: UpdateCustomerDto,
  ): void {
    if (dto.phone !== undefined) {
      customer.phone = dto.phone ?? null;
    }
    if (dto.email !== undefined) {
      customer.email = dto.email ?? null;
    }
    if (dto.wechatId !== undefined) {
      customer.wechatId = dto.wechatId ?? null;
    }
    if (dto.lineId !== undefined) {
      customer.lineId = dto.lineId ?? null;
    }
  }

  /**
   * 按更新后的客户类型同步附属资料，覆盖类型切换与同类型增量更新两种场景。
   *
   * @param customer - 当前数据库中的客户实体
   * @param customerId - 客户主键 ID
   * @param dto - 局部更新请求体
   * @param targetType - 本次更新后应生效的客户类型
   */
  async syncRelatedProfile(
    customer: Customer,
    customerId: string,
    dto: UpdateCustomerDto,
    targetType: CustomerType,
  ): Promise<void> {
    if (targetType !== customer.customerType) {
      await this.rebuildRelatedProfile(customer, customerId, dto, targetType);
      return;
    }

    await this.updateExistingRelatedProfile(customer, customerId, dto);
  }

  /**
   * 在客户类型发生切换时清理旧附属资料并重建新类型所需档案。
   *
   * @param customer - 当前数据库中的客户实体
   * @param customerId - 客户主键 ID
   * @param dto - 局部更新请求体
   * @param targetType - 目标客户类型
   */
  private async rebuildRelatedProfile(
    customer: Customer,
    customerId: string,
    dto: UpdateCustomerDto,
    targetType: CustomerType,
  ): Promise<void> {
    if (targetType === CustomerType.COMPANY) {
      await this.removePersonInfoIfExists(customer);
      await this.createCompanyInfoIfProvided(customerId, dto.companyInfo);
      return;
    }

    await this.removeCompanyInfoIfExists(customer);
    await this.createPersonInfoIfProvided(customerId, dto.personInfo);
  }

  /**
   * 在客户类型未变化时按请求内容增量更新公司或个人附属资料。
   *
   * @param customer - 当前数据库中的客户实体
   * @param customerId - 客户主键 ID
   * @param dto - 局部更新请求体
   */
  private async updateExistingRelatedProfile(
    customer: Customer,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<void> {
    if (dto.companyInfo && this.hasCompanyDtoContent(dto.companyInfo)) {
      await this.upsertCompanyInfo(
        customerId,
        customer.companyInfo,
        dto.companyInfo,
      );
    }

    if (dto.personInfo && this.hasPersonDtoContent(dto.personInfo)) {
      await this.upsertPersonInfo(
        customerId,
        customer.personInfo,
        dto.personInfo,
      );
    }
  }

  /**
   * 在需要时创建公司附属资料记录。
   *
   * @param customerId - 客户主键 ID
   * @param companyInfo - 公司补充资料
   */
  private async createCompanyInfoIfProvided(
    customerId: string,
    companyInfo?: CompanyInfoDto,
  ): Promise<void> {
    if (!companyInfo || !this.hasCompanyDtoContent(companyInfo)) {
      return;
    }

    const createdCompanyInfo = this.companyInfoRepo.create({
      customerId,
      corporationNumber: companyInfo.corporationNumber ?? null,
      fiscalMonth: companyInfo.fiscalMonth ?? null,
      representativeName: companyInfo.representativeName ?? null,
    });
    await this.companyInfoRepo.save(createdCompanyInfo);
  }

  /**
   * 在需要时创建个人附属资料记录。
   *
   * @param customerId - 客户主键 ID
   * @param personInfo - 个人补充资料
   */
  private async createPersonInfoIfProvided(
    customerId: string,
    personInfo?: PersonInfoDto,
  ): Promise<void> {
    if (!personInfo || !this.hasPersonDtoContent(personInfo)) {
      return;
    }

    if (personInfo.primaryCustomerId) {
      await this.ensurePrimaryCustomerRefValid(
        customerId,
        personInfo.primaryCustomerId,
      );
    }

    const createdPersonInfo = this.personInfoRepo.create({
      customerId,
      nationality: personInfo.nationality ?? null,
      passportNumber: this.normalizePassportNumber(personInfo.passportNumber),
      residenceStatus: personInfo.residenceStatus ?? null,
      residenceExpireDate: this.parseResidenceExpireDate(
        personInfo.residenceExpireDate,
      ),
      isFamilyMember: personInfo.isFamilyMember ?? false,
      familyRelation: personInfo.familyRelation ?? null,
      primaryCustomerId: personInfo.primaryCustomerId ?? null,
      remindDaysBefore: personInfo.remindDaysBefore ?? null,
    });
    await this.personInfoRepo.save(createdPersonInfo);
  }

  /**
   * 判断公司附属资料请求是否包含至少一个有效字段。
   *
   * @param info - 公司附属资料请求体
   * @returns 任一公司字段存在有效值时返回 true
   */
  private hasCompanyDtoContent(info?: CompanyInfoDto | null): boolean {
    if (!info) {
      return false;
    }

    return Boolean(
      info.corporationNumber?.trim() ||
      info.representativeName?.trim() ||
      (info.fiscalMonth !== undefined && info.fiscalMonth !== null),
    );
  }

  /**
   * 判断个人附属资料请求是否包含至少一个有效字段。
   *
   * @param info - 个人附属资料请求体
   * @returns 任一个人字段存在有效值时返回 true
   */
  private hasPersonDtoContent(info?: PersonInfoDto | null): boolean {
    if (!info) {
      return false;
    }

    return Boolean(
      info.nationality?.trim() ||
      info.passportNumber?.trim() ||
      info.residenceStatus?.trim() ||
      info.residenceExpireDate ||
      info.isFamilyMember !== undefined ||
      info.familyRelation ||
      info.primaryCustomerId ||
      info.remindDaysBefore !== undefined,
    );
  }

  /**
   * 删除客户当前绑定的公司档案，避免类型切换后遗留脏数据。
   *
   * @param customer - 当前数据库中的客户实体
   */
  private async removeCompanyInfoIfExists(customer: Customer): Promise<void> {
    if (customer.companyInfo) {
      await this.companyInfoRepo.remove(customer.companyInfo);
    }
  }

  /**
   * 删除客户当前绑定的个人档案，避免类型切换后遗留脏数据。
   *
   * @param customer - 当前数据库中的客户实体
   */
  private async removePersonInfoIfExists(customer: Customer): Promise<void> {
    if (customer.personInfo) {
      await this.personInfoRepo.remove(customer.personInfo);
    }
  }

  /**
   * 对公司附属资料执行更新或补建，确保空值字段按既有值回退。
   *
   * @param customerId - 客户主键 ID
   * @param existingCompanyInfo - 当前已存在的公司档案
   * @param companyInfo - 本次请求提交的公司资料
   */
  private async upsertCompanyInfo(
    customerId: string,
    existingCompanyInfo: CompanyInfo | null,
    companyInfo: CompanyInfoDto,
  ): Promise<void> {
    if (!existingCompanyInfo) {
      await this.createCompanyInfoIfProvided(customerId, companyInfo);
      return;
    }

    Object.assign(existingCompanyInfo, {
      corporationNumber:
        companyInfo.corporationNumber ?? existingCompanyInfo.corporationNumber,
      fiscalMonth: companyInfo.fiscalMonth ?? existingCompanyInfo.fiscalMonth,
      representativeName:
        companyInfo.representativeName ??
        existingCompanyInfo.representativeName,
    });
    await this.companyInfoRepo.save(existingCompanyInfo);
  }

  /**
   * 对个人附属资料执行更新或补建，并统一处理日期字段与家族字段转换。
   *
   * @param customerId - 客户主键 ID
   * @param existingPersonInfo - 当前已存在的个人档案
   * @param personInfo - 本次请求提交的个人资料
   */
  private async upsertPersonInfo(
    customerId: string,
    existingPersonInfo: PersonInfo | null,
    personInfo: PersonInfoDto,
  ): Promise<void> {
    if (!existingPersonInfo) {
      await this.createPersonInfoIfProvided(customerId, personInfo);
      return;
    }

    if (
      personInfo.primaryCustomerId !== undefined &&
      personInfo.primaryCustomerId !== null
    ) {
      await this.ensurePrimaryCustomerRefValid(
        customerId,
        personInfo.primaryCustomerId,
      );
    }

    Object.assign(existingPersonInfo, {
      nationality: personInfo.nationality ?? existingPersonInfo.nationality,
      passportNumber:
        personInfo.passportNumber !== undefined
          ? this.normalizePassportNumber(personInfo.passportNumber)
          : existingPersonInfo.passportNumber,
      residenceStatus:
        personInfo.residenceStatus ?? existingPersonInfo.residenceStatus,
      residenceExpireDate:
        this.parseResidenceExpireDate(personInfo.residenceExpireDate) ??
        existingPersonInfo.residenceExpireDate,
      isFamilyMember:
        personInfo.isFamilyMember ?? existingPersonInfo.isFamilyMember,
      familyRelation:
        personInfo.familyRelation ?? existingPersonInfo.familyRelation,
      primaryCustomerId:
        personInfo.primaryCustomerId ?? existingPersonInfo.primaryCustomerId,
      remindDaysBefore:
        personInfo.remindDaysBefore ?? existingPersonInfo.remindDaysBefore,
    });
    await this.personInfoRepo.save(existingPersonInfo);
  }

  /**
   * 将请求体中的护照号去空白并转为大写，空串视为清空（null）。
   *
   * @param raw - 客户端提交的护照号字符串
   * @returns 可写入 `person_info.passport_number` 的归一值或 null
   */
  private normalizePassportNumber(raw?: string | null): string | null {
    if (raw === undefined || raw === null) {
      return null;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.toUpperCase();
  }

  /**
   * 将个人资料中的日期字符串安全转换为日期对象，便于仓储统一写入。
   *
   * @param residenceExpireDate - 请求体中的在留期限字符串
   * @returns 转换后的日期对象，缺失时返回 null
   */
  private parseResidenceExpireDate(residenceExpireDate?: string): Date | null {
    return residenceExpireDate ? new Date(residenceExpireDate) : null;
  }

  /**
   * 校验主客户引用不得指向当前客户本人，且主客户记录须存在。
   *
   * @param currentCustomerId - 当前正在写入个人档案的客户主键
   * @param primaryCustomerId - 请求体中的主客户 ID
   * @throws {BadRequestException} 自指或主客户不存在时
   */
  private async ensurePrimaryCustomerRefValid(
    currentCustomerId: string,
    primaryCustomerId: string,
  ): Promise<void> {
    if (primaryCustomerId === currentCustomerId) {
      throw new BadRequestException(
        '主顧客に本人（同一顧客）を指定することはできません',
      );
    }
    const primary = await this.customerRepo.findOne({
      where: { id: primaryCustomerId },
    });
    if (!primary) {
      throw new BadRequestException('指定された主顧客が存在しません');
    }
  }
}
