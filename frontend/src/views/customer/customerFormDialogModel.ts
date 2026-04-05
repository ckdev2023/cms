/**
 * 客户表单弹窗的表单模型与提交载荷组装逻辑，供 CustomerFormDialog 与子列组件复用。
 */
import { CustomerType, FamilyRelation, ServiceType } from '@/constants/enums'
import type {
  CreateCustomerParams,
  CustomerItem,
  UpdateCustomerParams,
} from '@/types/customer'

/**
 * 主客户表单中「随附家属」多行录入的一行：对应独立 `customers` + `person_info` 家属子档。
 */
export interface AccompanyingMemberRow {
  /** 前端行键，供列表渲染稳定追踪 */
  clientKey: string
  /** 已存在客户主键；新建行留空字符串 */
  customerId: string
  customerName: string
  familyRelation: FamilyRelation | ''
  passportNumber: string
  phone: string
}

export interface FormModel {
  customerType: CustomerType
  customerName: string
  phone: string
  email: string
  wechatId: string
  lineId: string
  address: string
  serviceType: ServiceType
  ownerUserId: string
  /** 客户头像 `files` ID；空字符串表示未设置或已清除 */
  photoFileId: string
  corporationNumber: string
  fiscalMonth: number | undefined
  representativeName: string
  nationality: string
  passportNumber: string
  residenceStatus: string
  residenceExpireDate: string
  isFamilyMember: boolean
  familyRelation: FamilyRelation | ''
  primaryCustomerId: string
  remindDaysBefore: number | null | undefined
  /** 主档视角下的随附家属子客户行（仅个人主档场景展示与提交） */
  accompanyingMembers: AccompanyingMemberRow[]
  /**
   * 新建随附家属 `POST` 时是否将主档在留资格、在留期限写入各新建行（docs/31 §5.6）；与表单 Checkbox 绑定，默认 true。
   */
  copyPrimaryResidenceToNewAccompanyingMembers: boolean
}

type BaseFormValues = Pick<
  FormModel,
  | 'customerType'
  | 'customerName'
  | 'phone'
  | 'email'
  | 'wechatId'
  | 'lineId'
  | 'address'
  | 'serviceType'
  | 'ownerUserId'
  | 'photoFileId'
>

type CompanyFormValues = Pick<
  FormModel,
  'corporationNumber' | 'fiscalMonth' | 'representativeName'
>

type PersonFormValues = Pick<
  FormModel,
  | 'nationality'
  | 'passportNumber'
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
    wechatId: '',
    lineId: '',
    address: '',
    serviceType: ServiceType.BOTH,
    ownerUserId: '',
    photoFileId: '',
    corporationNumber: '',
    fiscalMonth: undefined,
    representativeName: '',
    nationality: '',
    passportNumber: '',
    residenceStatus: '',
    residenceExpireDate: '',
    isFamilyMember: false,
    familyRelation: '',
    primaryCustomerId: '',
    remindDaysBefore: undefined,
    accompanyingMembers: [],
    copyPrimaryResidenceToNewAccompanyingMembers: true,
  }
}

/**
 * 生成随附家属行用的稳定前端 key（优先 `crypto.randomUUID`）。
 *
 * @returns 不与其他行冲突的字符串键
 */
export function createAccompanyingMemberClientKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `accompany_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 构造一行空的随附家属表单初值。
 *
 * @returns 各字段为空且带新 `clientKey` 的行模型
 */
export function createEmptyAccompanyingMemberRow(): AccompanyingMemberRow {
  return {
    clientKey: createAccompanyingMemberClientKey(),
    customerId: '',
    customerName: '',
    familyRelation: '',
    passportNumber: '',
    phone: '',
  }
}

/**
 * 将 `GET /customers?primaryCustomerId=` 返回的列表项映射为随附家属行。
 *
 * @param item - 已确认为挂在主档下的家属客户列表项
 * @returns 带 `customerId` 与 `clientKey` 的编辑行
 */
export function mapCustomerItemToAccompanyingMemberRow(item: CustomerItem): AccompanyingMemberRow {
  return {
    clientKey: item.id,
    customerId: item.id,
    customerName: item.customerName ?? '',
    familyRelation: (item.personInfo?.familyRelation ?? '') as FamilyRelation | '',
    passportNumber: item.personInfo?.passportNumber ?? '',
    phone: item.phone ?? '',
  }
}

/**
 * 判断随附家属行是否至少填写了一个可感知字段（用于决定是否需要校验与是否参与保存）。
 *
 * @param row - 随附家属行
 * @returns 姓名、关系、护照、电话中任一非空白时返回 `true`
 */
export function accompanyingMemberRowHasAnyField(row: AccompanyingMemberRow): boolean {
  return !!(
    row.customerName?.trim() ||
    row.familyRelation ||
    row.passportNumber?.trim() ||
    row.phone?.trim()
  )
}

/**
 * 校验随附家属多行：已落库行不得被清空为「全空」而不移除；有内容的行须具备姓名与关系。
 *
 * @param rows - 表单中的随附家属行数组
 * @returns 无问题时返回 `null`，否则返回问题码
 */
export function validateAccompanyingMemberRows(
  rows: readonly AccompanyingMemberRow[],
): 'nameRequired' | 'relationRequired' | 'orphanExisting' | null {
  for (const row of rows) {
    if (row.customerId && !accompanyingMemberRowHasAnyField(row)) {
      return 'orphanExisting'
    }
    if (!accompanyingMemberRowHasAnyField(row)) {
      continue
    }
    if (!row.customerName.trim()) {
      return 'nameRequired'
    }
    if (!row.familyRelation) {
      return 'relationRequired'
    }
  }
  return null
}

/**
 * 对比打开编辑时记录的家属 ID 集合与当前行，得到需做删除接口的客户 ID 列表。
 *
 * @param initialIds - 打开抽屉时从接口拉取到的家属客户 ID
 * @param rows - 当前表单行
 * @returns 已从列表移除、需调用删除接口的 ID
 */
export function listRemovedAccompanyingCustomerIds(
  initialIds: ReadonlySet<string>,
  rows: readonly AccompanyingMemberRow[],
): string[] {
  const remaining = new Set(
    rows.map((r) => r.customerId).filter((id): id is string => Boolean(id)),
  )
  return [...initialIds].filter((id) => !remaining.has(id))
}

/**
 * 判断主档是否在留两字段中至少有一项非空白，可作为随附家属初值来源（docs/31 §5.6）。
 *
 * @param form - 客户表单模型
 * @returns 在留资格或期限任一为非空白字符串时返回 true
 */
export function primaryResidenceHasValueForAccompanyingCopy(form: FormModel): boolean {
  const statusTrimmed = form.residenceStatus?.trim() ?? ''
  const expireRaw =
    form.residenceExpireDate === undefined || form.residenceExpireDate === null
      ? ''
      : String(form.residenceExpireDate).trim()
  return Boolean(statusTrimmed || expireRaw)
}

/**
 * 将主档在留资格与期限按开关写入随附家属创建载荷的 `personInfo`（docs/31 §5.6）。
 *
 * @param personInfo - 已初始化的 `personInfo` 对象引用
 * @param form - 主客户表单
 */
function applyPrimaryResidenceToAccompanyingCreatePersonInfo(
  personInfo: NonNullable<CreateCustomerParams['personInfo']>,
  form: FormModel,
): void {
  if (
    !form.copyPrimaryResidenceToNewAccompanyingMembers ||
    !primaryResidenceHasValueForAccompanyingCopy(form)
  ) {
    return
  }
  const rs = form.residenceStatus?.trim()
  if (rs) {
    personInfo.residenceStatus = rs
  }
  const expireRaw =
    form.residenceExpireDate === undefined || form.residenceExpireDate === null
      ? ''
      : String(form.residenceExpireDate).trim()
  if (expireRaw) {
    personInfo.residenceExpireDate = expireRaw
  }
}

/**
 * 组装「随附家属」新建子客户的 `POST /customers` 请求体。
 *
 * @param row - 已通过校验的一行
 * @param primaryCustomerId - 主档客户 ID
 * @param form - 主表单（继承服务类型与可选负责人）
 * @returns 创建家属子档用的载荷
 */
export function buildAccompanyingMemberCreatePayload(
  row: AccompanyingMemberRow,
  primaryCustomerId: string,
  form: FormModel,
): CreateCustomerParams {
  const payload: CreateCustomerParams = {
    customerType: CustomerType.PERSONAL,
    customerName: row.customerName.trim(),
    serviceType: form.serviceType,
    personInfo: {
      isFamilyMember: true,
      familyRelation: row.familyRelation as FamilyRelation,
      primaryCustomerId,
    },
  }
  const phone = row.phone?.trim()
  if (phone) {
    payload.phone = phone
  }
  const passport = row.passportNumber?.trim()
  if (passport && payload.personInfo) {
    payload.personInfo.passportNumber = passport
  }
  const ownerTrimmed = form.ownerUserId?.trim()
  if (ownerTrimmed) {
    payload.ownerUserId = ownerTrimmed
  }
  if (payload.personInfo) {
    applyPrimaryResidenceToAccompanyingCreatePersonInfo(payload.personInfo, form)
  }
  return payload
}

/**
 * 组装「随附家属」已有子客户的 `PUT /customers/:id` 请求体（局部字段）。
 *
 * @param row - 已通过校验且带 `customerId` 的一行
 * @param primaryCustomerId - 主档客户 ID（写回 person_info 关联）
 * @returns 更新家属子档用的载荷
 */
export function buildAccompanyingMemberUpdatePayload(
  row: AccompanyingMemberRow,
  primaryCustomerId: string,
): UpdateCustomerParams {
  const payload: UpdateCustomerParams = {
    customerName: row.customerName.trim(),
    personInfo: {
      isFamilyMember: true,
      familyRelation: row.familyRelation as FamilyRelation,
      primaryCustomerId,
    },
  }
  const phone = row.phone?.trim()
  if (phone) {
    payload.phone = phone
  }
  const passport = row.passportNumber?.trim()
  if (passport) {
    payload.personInfo!.passportNumber = passport
  }
  return payload
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
    wechatId: data.wechatId ?? '',
    lineId: data.lineId ?? '',
    address: data.address ?? '',
    serviceType: data.serviceType,
    ownerUserId: data.ownerUserId ?? '',
    photoFileId: data.photoFileId ?? '',
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
    passportNumber: personInfo?.passportNumber ?? '',
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
    form.passportNumber?.trim() ||
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
  isEdit: boolean,
): void {
  if (form.phone) {payload.phone = form.phone}
  if (form.email) {payload.email = form.email}
  if (form.wechatId?.trim()) {payload.wechatId = form.wechatId.trim()}
  if (form.lineId?.trim()) {payload.lineId = form.lineId.trim()}
  if (form.address) {payload.address = form.address}
  const ownerTrimmed = form.ownerUserId?.trim()
  if (isEdit) {
    ;(payload as { ownerUserId?: string | null }).ownerUserId = ownerTrimmed || null
  } else if (ownerTrimmed) {
    payload.ownerUserId = ownerTrimmed
  }
}

function applyCompanyInfoToPayload(
  payload: CreateCustomerParams,
  form: FormModel,
): void {
  if (!hasCompanyExtension(form)) {return}
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
  if (!hasPersonExtension(form)) {return}
  payload.personInfo = {}
  if (form.nationality) {payload.personInfo.nationality = form.nationality}
  if (form.passportNumber?.trim()) {
    payload.personInfo.passportNumber = form.passportNumber.trim()
  }
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
  applyOptionalContactToPayload(payload, form, isEdit)
  applyCompanyInfoToPayload(payload, form)
  applyPersonInfoToPayload(payload, form)
  applyCustomerPhotoToPayload(payload, form, isEdit)
  return payload
}

/**
 * 将头像文件 ID 写入创建或更新载荷；编辑时显式传 `null` 可清除头像。
 *
 * @param payload - 已组装的客户保存载荷
 * @param form - 表单模型
 * @param isEdit - 是否为编辑已有客户
 */
function applyCustomerPhotoToPayload(
  payload: CreateCustomerParams,
  form: FormModel,
  isEdit: boolean,
): void {
  const trimmed = form.photoFileId?.trim() ?? ''
  if (isEdit) {
    const updatePayload = payload as UpdateCustomerParams
    updatePayload.photoFileId = trimmed || null
    return
  }
  if (trimmed) {
    payload.photoFileId = trimmed
  }
}
