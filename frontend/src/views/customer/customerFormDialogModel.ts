/**
 * 客户表单弹窗的表单模型与提交载荷组装逻辑，供 CustomerFormDialog 与子列组件复用。
 */
import { CustomerType, FamilyRelation, ServiceType } from '@/constants/enums'
import type { CreateCustomerParams, CustomerItem } from '@/types/customer'

export interface FormModel {
  customerType: CustomerType
  customerName: string
  phone: string
  email: string
  address: string
  serviceType: ServiceType
  ownerUserId: string
  corporationNumber: string
  fiscalMonth: number | undefined
  representativeName: string
  nationality: string
  residenceStatus: string
  residenceExpireDate: string
  isFamilyMember: boolean
  familyRelation: FamilyRelation | ''
  primaryCustomerId: string
  remindDaysBefore: number | null | undefined
}

type BaseFormValues = Pick<
  FormModel,
  | 'customerType'
  | 'customerName'
  | 'phone'
  | 'email'
  | 'address'
  | 'serviceType'
  | 'ownerUserId'
>

type CompanyFormValues = Pick<
  FormModel,
  'corporationNumber' | 'fiscalMonth' | 'representativeName'
>

type PersonFormValues = Pick<
  FormModel,
  | 'nationality'
  | 'residenceStatus'
  | 'residenceExpireDate'
  | 'isFamilyMember'
  | 'familyRelation'
  | 'primaryCustomerId'
  | 'remindDaysBefore'
>

/**
 * 创建客户弹窗所需的默认表单模型。
 *
 * @returns 适用于新增客户场景的初始表单值
 */
export function createDefaultFormModel(): FormModel {
  return {
    customerType: CustomerType.PERSONAL,
    customerName: '',
    phone: '',
    email: '',
    address: '',
    serviceType: ServiceType.BOTH,
    ownerUserId: '',
    corporationNumber: '',
    fiscalMonth: undefined,
    representativeName: '',
    nationality: '',
    residenceStatus: '',
    residenceExpireDate: '',
    isFamilyMember: false,
    familyRelation: '',
    primaryCustomerId: '',
    remindDaysBefore: undefined,
  }
}

/**
 * 从客户详情中提取所有通用字段，供新增/编辑表单复用。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 适用于公司和个人客户的基础表单字段
 */
export function buildBaseFormValues(data: CustomerItem): BaseFormValues {
  return {
    customerType: data.customerType,
    customerName: data.customerName,
    phone: data.phone ?? '',
    email: data.email ?? '',
    address: data.address ?? '',
    serviceType: data.serviceType,
    ownerUserId: data.ownerUserId ?? '',
  }
}

/**
 * 从客户详情中提取公司客户专属字段。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 公司客户表单所需的补充字段
 */
export function buildCompanyFormValues(data: CustomerItem): CompanyFormValues {
  const companyInfo = data.companyInfo

  return {
    corporationNumber: companyInfo?.corporationNumber ?? '',
    fiscalMonth: companyInfo?.fiscalMonth ?? undefined,
    representativeName: companyInfo?.representativeName ?? '',
  }
}

/**
 * 从客户详情中提取个人客户专属字段。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 个人客户表单所需的补充字段
 */
export function buildPersonFormValues(data: CustomerItem): PersonFormValues {
  const personInfo = data.personInfo

  return {
    nationality: personInfo?.nationality ?? '',
    residenceStatus: personInfo?.residenceStatus ?? '',
    residenceExpireDate: personInfo?.residenceExpireDate ?? '',
    isFamilyMember: personInfo?.isFamilyMember ?? false,
    familyRelation: personInfo?.familyRelation ?? '',
    primaryCustomerId: personInfo?.primaryCustomerId ?? '',
    remindDaysBefore: personInfo?.remindDaysBefore ?? undefined,
  }
}

/**
 * 判断公司扩展栏位是否至少填写了一个有效字段。
 *
 * @param form - 当前客户表单模型
 * @returns 公司扩展字段中存在至少一个非空有效值时返回 `true`
 */
export function hasCompanyExtension(form: FormModel): boolean {
  return !!(
    form.corporationNumber?.trim() ||
    form.representativeName?.trim() ||
    (form.fiscalMonth !== undefined && form.fiscalMonth !== null)
  )
}

/**
 * 判断个人扩展栏位是否至少填写了一个有效字段。
 *
 * @param form - 当前客户表单模型
 * @returns 个人扩展字段中存在至少一个非空有效值时返回 `true`
 */
export function hasPersonExtension(form: FormModel): boolean {
  return !!(
    form.nationality?.trim() ||
    form.residenceStatus?.trim() ||
    (
      form.residenceExpireDate !== undefined &&
      form.residenceExpireDate !== null &&
      String(form.residenceExpireDate).trim() !== ''
    ) ||
    form.isFamilyMember ||
    form.familyRelation ||
    form.primaryCustomerId ||
    (form.remindDaysBefore !== undefined && form.remindDaysBefore !== null)
  )
}

/**
 * 新建时根据已填写的扩展字段推导客户类型。
 *
 * @param form - 当前客户表单模型
 * @returns 存在公司扩展字段时返回法人类型，否则返回个人类型
 */
export function resolveCreateCustomerType(form: FormModel): CustomerType {
  return hasCompanyExtension(form) ? CustomerType.COMPANY : CustomerType.PERSONAL
}

function applyOptionalContactToPayload(
  payload: CreateCustomerParams,
  form: FormModel,
): void {
  if (form.phone) payload.phone = form.phone
  if (form.email) payload.email = form.email
  if (form.address) payload.address = form.address
  if (form.ownerUserId) payload.ownerUserId = form.ownerUserId
}

function applyCompanyInfoToPayload(
  payload: CreateCustomerParams,
  form: FormModel,
): void {
  if (!hasCompanyExtension(form)) return
  payload.companyInfo = {}
  if (form.corporationNumber) {
    payload.companyInfo.corporationNumber = form.corporationNumber
  }
  if (form.fiscalMonth !== undefined && form.fiscalMonth !== null) {
    payload.companyInfo.fiscalMonth = form.fiscalMonth
  }
  if (form.representativeName) {
    payload.companyInfo.representativeName = form.representativeName
  }
}

function applyPersonInfoToPayload(
  payload: CreateCustomerParams,
  form: FormModel,
): void {
  if (!hasPersonExtension(form)) return
  payload.personInfo = {}
  if (form.nationality) payload.personInfo.nationality = form.nationality
  if (form.residenceStatus) {
    payload.personInfo.residenceStatus = form.residenceStatus
  }
  if (form.residenceExpireDate) {
    payload.personInfo.residenceExpireDate = form.residenceExpireDate
  }
  payload.personInfo.isFamilyMember = form.isFamilyMember
  if (form.isFamilyMember && form.familyRelation) {
    payload.personInfo.familyRelation = form.familyRelation as FamilyRelation
  }
  if (form.primaryCustomerId) {
    payload.personInfo.primaryCustomerId = form.primaryCustomerId
  }
  if (form.remindDaysBefore !== undefined && form.remindDaysBefore !== null) {
    payload.personInfo.remindDaysBefore = form.remindDaysBefore
  }
}

/**
 * 根据客户类型整理接口所需的提交载荷。
 *
 * @param form - 当前客户表单模型
 * @param isEdit - 是否为编辑已有客户
 * @returns 创建或更新客户接口需要的请求体
 */
export function buildCustomerFormPayload(
  form: FormModel,
  isEdit: boolean,
): CreateCustomerParams {
  const payload: CreateCustomerParams = {
    customerType: isEdit ? form.customerType : resolveCreateCustomerType(form),
    customerName: form.customerName,
    serviceType: form.serviceType,
  }
  applyOptionalContactToPayload(payload, form)
  applyCompanyInfoToPayload(payload, form)
  applyPersonInfoToPayload(payload, form)
  return payload
}
