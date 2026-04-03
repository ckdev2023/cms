import { AdminCaseStatus } from '../../common/constants/enums';
import type { CreateAdminCaseDto } from './dto/create-admin-case.dto';
import type { CreateAdminCaseDocumentDto } from './dto/create-document.dto';
import type { CreateInterviewDto } from './dto/create-interview.dto';
import type { UpdateAdminCaseDto } from './dto/update-admin-case.dto';
import type { UpdateAdminCaseDocumentDto } from './dto/update-document.dto';
import type { UpdateInterviewDto } from './dto/update-interview.dto';
import type { AdminCase } from './entities/admin-case.entity';
import type { AdminCaseDocument } from './entities/admin-case-document.entity';
import type { AdminCaseInterview } from './entities/admin-case-interview.entity';

export type AdminCaseListItemDto = {
  id: string;
  customerId: string;
  customerName: string | null;
  caseName: string;
  applicantName: string | null;
  residenceStatus: string | null;
  status: AdminCaseStatus;
  expireDate: Date | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCaseInterviewDto = {
  id: string;
  adminCaseId: string;
  customerId: string;
  interviewDate: Date;
  interviewLocation: string | null;
  content: string;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCaseDocumentFileDto = {
  id: string;
  fileName: string;
  fileExt: string | null;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  uploaderName: string | null;
  createdAt: Date;
};

export type AdminCaseDocumentDto = {
  id: string;
  adminCaseId: string;
  fileId: string;
  documentType: string | null;
  remark: string | null;
  createdAt: Date;
  file: AdminCaseDocumentFileDto | null;
};

/**
 * 将行政案件创建 DTO 归一化为仓储可写入的实体字段集合。
 *
 * @param dto - 行政案件创建入参
 * @param userId - 当前操作用户 ID
 * @returns 适合传给 repository.create 的案件字段对象
 */
export function mapCreateAdminCaseDtoToEntityInput(
  dto: CreateAdminCaseDto,
  userId?: string,
): Partial<AdminCase> {
  return {
    customerId: dto.customerId,
    caseName: dto.caseName,
    applicantName: dto.applicantName ?? null,
    residenceStatus: dto.residenceStatus ?? null,
    status: dto.status ?? AdminCaseStatus.DRAFT,
    expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
    ownerUserId: dto.ownerUserId ?? null,
    createdBy: userId ?? null,
    updatedBy: userId ?? null,
  };
}

/**
 * 将案件更新 DTO 应用到现有实体上，并同步审计字段。
 *
 * @param adminCase - 待更新的案件实体
 * @param dto - 允许局部更新的案件字段
 * @param userId - 当前操作用户 ID
 * @returns 已应用变更的原案件实体
 */
export function applyAdminCaseUpdateDto(
  adminCase: AdminCase,
  dto: UpdateAdminCaseDto,
  userId?: string,
): AdminCase {
  if (dto.caseName !== undefined) adminCase.caseName = dto.caseName;
  if (dto.applicantName !== undefined)
    adminCase.applicantName = dto.applicantName ?? null;
  if (dto.residenceStatus !== undefined)
    adminCase.residenceStatus = dto.residenceStatus ?? null;
  if (dto.expireDate !== undefined)
    adminCase.expireDate = dto.expireDate ? new Date(dto.expireDate) : null;
  if (dto.ownerUserId !== undefined)
    adminCase.ownerUserId = dto.ownerUserId ?? null;
  if (dto.customerId !== undefined) adminCase.customerId = dto.customerId;
  adminCase.updatedBy = userId ?? null;

  return adminCase;
}

/**
 * 将案件实体压缩为列表页可直接消费的摘要结构。
 *
 * @param adminCase - 已附带客户和负责人关联信息的案件实体
 * @returns 列表表格所需的案件摘要对象
 */
export function mapAdminCaseToListItemDto(
  adminCase: AdminCase,
): AdminCaseListItemDto {
  return {
    id: adminCase.id,
    customerId: adminCase.customerId,
    customerName: adminCase.customer?.customerName ?? null,
    caseName: adminCase.caseName,
    applicantName: adminCase.applicantName,
    residenceStatus: adminCase.residenceStatus,
    status: adminCase.status,
    expireDate: adminCase.expireDate,
    ownerUserId: adminCase.ownerUserId,
    ownerName: adminCase.owner?.displayName ?? null,
    createdBy: adminCase.createdBy,
    updatedBy: adminCase.updatedBy,
    createdAt: adminCase.createdAt,
    updatedAt: adminCase.updatedAt,
  };
}

/**
 * 将面谈创建 DTO 归一化为仓储可写入的实体字段集合。
 *
 * @param caseId - 所属行政案件 ID
 * @param customerId - 最终应写入的客户 ID
 * @param dto - 面谈创建入参
 * @param userId - 当前操作用户 ID
 * @returns 适合传给 repository.create 的面谈字段对象
 */
export function mapCreateInterviewDtoToEntityInput(
  caseId: string,
  customerId: string,
  dto: CreateInterviewDto,
  userId?: string,
): Partial<AdminCaseInterview> {
  return {
    adminCaseId: caseId,
    customerId,
    interviewDate: new Date(dto.interviewDate),
    interviewLocation: dto.interviewLocation ?? null,
    content: dto.content,
    createdBy: userId ?? null,
  };
}

/**
 * 将面谈更新 DTO 应用到现有实体上。
 *
 * @param interview - 待更新的面谈实体
 * @param dto - 允许局部更新的面谈字段
 * @returns 已应用变更的原面谈实体
 */
export function applyInterviewUpdateDto(
  interview: AdminCaseInterview,
  dto: UpdateInterviewDto,
): AdminCaseInterview {
  if (dto.interviewDate !== undefined)
    interview.interviewDate = new Date(dto.interviewDate);
  if (dto.interviewLocation !== undefined)
    interview.interviewLocation = dto.interviewLocation ?? null;
  if (dto.content !== undefined) interview.content = dto.content;
  if (dto.customerId !== undefined) interview.customerId = dto.customerId;

  return interview;
}

/**
 * 将面谈实体映射为列表页展示所需的扁平结构。
 *
 * @param interview - 已附带创建人信息的面谈实体
 * @returns 面谈记录摘要对象
 */
export function mapAdminCaseInterviewToDto(
  interview: AdminCaseInterview,
): AdminCaseInterviewDto {
  return {
    id: interview.id,
    adminCaseId: interview.adminCaseId,
    customerId: interview.customerId,
    interviewDate: interview.interviewDate,
    interviewLocation: interview.interviewLocation,
    content: interview.content,
    createdBy: interview.createdBy,
    creatorName: interview.creator?.displayName ?? null,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };
}

/**
 * 将案件资料创建 DTO 归一化为仓储可写入的实体字段集合。
 *
 * @param caseId - 所属行政案件 ID
 * @param dto - 资料创建入参
 * @returns 适合传给 repository.create 的资料字段对象
 */
export function mapCreateAdminCaseDocumentDtoToEntityInput(
  caseId: string,
  dto: CreateAdminCaseDocumentDto,
): Partial<AdminCaseDocument> {
  return {
    adminCaseId: caseId,
    fileId: dto.fileId,
    documentType: dto.documentType ?? null,
    remark: dto.remark ?? null,
  };
}

/**
 * 将案件资料更新 DTO 应用到现有实体上。
 *
 * @param document - 待更新的资料实体
 * @param dto - 允许局部更新的资料字段
 * @returns 已应用变更的原资料实体
 */
export function applyAdminCaseDocumentUpdateDto(
  document: AdminCaseDocument,
  dto: UpdateAdminCaseDocumentDto,
): AdminCaseDocument {
  if (dto.documentType !== undefined)
    document.documentType = dto.documentType ?? null;
  if (dto.remark !== undefined) document.remark = dto.remark ?? null;

  return document;
}

/**
 * 将案件资料实体映射为接口返回结构，并展开文件摘要信息。
 *
 * @param document - 已附带文件与上传人关联信息的资料实体
 * @returns 供前端资料面板消费的资料 DTO
 */
export function mapAdminCaseDocumentToDto(
  document: AdminCaseDocument,
): AdminCaseDocumentDto {
  return {
    id: document.id,
    adminCaseId: document.adminCaseId,
    fileId: document.fileId,
    documentType: document.documentType,
    remark: document.remark,
    createdAt: document.createdAt,
    file: mapAdminCaseDocumentFileToDto(document.file),
  };
}

function mapAdminCaseDocumentFileToDto(
  file: AdminCaseDocument['file'],
): AdminCaseDocumentFileDto | null {
  if (!file) {
    return null;
  }

  return {
    id: file.id,
    fileName: file.fileName,
    fileExt: file.fileExt,
    fileSize: file.fileSize ? Number(file.fileSize) : null,
    mimeType: file.mimeType,
    description: file.description,
    uploaderName: file.uploader?.displayName ?? null,
    createdAt: file.createdAt,
  };
}
