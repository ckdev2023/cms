import { VisaAlertLevel } from '../../common/constants/enums';
import type {
  CustomerResponseDto,
  PersonInfoResponseDto,
} from './customer.service.types';
import type { Customer } from './entities/customer.entity';
import type { PersonInfo } from './entities/person-info.entity';
import { calendarDaysLeft, resolveVisaAlertLevel } from './visa-alert.util';

/**
 * 为个人档案计算并附加在留期限提醒字段。
 *
 * @param pi - 个人档案实体
 * @returns 包含 daysLeft 与 alertLevel 的响应结构
 */
export function toPersonInfoResponseDto(pi: PersonInfo): PersonInfoResponseDto {
  let daysLeft: number | null = null;
  let alertLevel: VisaAlertLevel | null = null;

  if (pi.residenceExpireDate) {
    daysLeft = calendarDaysLeft(pi.residenceExpireDate);
    alertLevel = resolveVisaAlertLevel(daysLeft);
  }

  return {
    id: pi.id,
    nationality: pi.nationality,
    passportNumber: pi.passportNumber,
    residenceStatus: pi.residenceStatus,
    residenceExpireDate: pi.residenceExpireDate,
    isFamilyMember: pi.isFamilyMember,
    familyRelation: pi.familyRelation,
    primaryCustomerId: pi.primaryCustomerId,
    remindDaysBefore: pi.remindDaysBefore,
    daysLeft,
    alertLevel,
  };
}

/**
 * 将客户实体转换为列表接口使用的扁平响应结构。
 *
 * @param customer - 已加载负责人与附属资料关联的客户实体
 * @returns 适用于前端列表展示的客户摘要对象
 */
export function toCustomerResponseDto(customer: Customer): CustomerResponseDto {
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    customerType: customer.customerType,
    customerName: customer.customerName,
    phone: customer.phone,
    email: customer.email,
    wechatId: customer.wechatId ?? null,
    lineId: customer.lineId ?? null,
    address: customer.address,
    serviceType: customer.serviceType,
    ownerUserId: customer.ownerUserId,
    ownerName: customer.owner?.displayName ?? null,
    status: customer.status,
    photoFileId: customer.photoFileId ?? null,
    companyInfo: customer.companyInfo
      ? {
          id: customer.companyInfo.id,
          corporationNumber: customer.companyInfo.corporationNumber,
          fiscalMonth: customer.companyInfo.fiscalMonth,
          representativeName: customer.companyInfo.representativeName,
        }
      : null,
    personInfo: customer.personInfo
      ? toPersonInfoResponseDto(customer.personInfo)
      : null,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
