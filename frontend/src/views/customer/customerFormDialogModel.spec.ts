/**
 * 客户弹窗模型：校验 buildCustomerFormPayload 与负责人、个人扩展字段的组装口径（与 CreateCustomer API 对齐）。
 */
import { describe, expect, it } from 'vitest'

import { CustomerType, FamilyRelation, ServiceType } from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'

import {
  accompanyingMemberRowHasAnyField,
  buildAccompanyingMemberCreatePayload,
  buildAccompanyingMemberUpdatePayload,
  buildBaseFormValues,
  buildCustomerFormPayload,
  createDefaultFormModel,
  createEmptyAccompanyingMemberRow,
  hasCompanyExtension,
  listRemovedAccompanyingCustomerIds,
  mapCustomerItemToAccompanyingMemberRow,
  primaryResidenceHasValueForAccompanyingCopy,
  resolveCreateCustomerType,
  validateAccompanyingMemberRows,
} from './customerFormDialogModel'

describe('buildCustomerFormPayload', () => {
  it('新建模式下省略 ownerUserId 当负责人未填写或仅空白', () => {
    const emptyOwner = createDefaultFormModel()
    emptyOwner.customerName = '個人A'
    emptyOwner.ownerUserId = ''
    expect(buildCustomerFormPayload(emptyOwner, false).ownerUserId).toBeUndefined()

    const whitespaceOwner = createDefaultFormModel()
    whitespaceOwner.customerName = '個人B'
    whitespaceOwner.ownerUserId = '   \t  '
    expect(buildCustomerFormPayload(whitespaceOwner, false).ownerUserId).toBeUndefined()
  })

  it('新建模式下在填写有效负责人 UUID 时附带 trim 后的 ownerUserId', () => {
    const form = createDefaultFormModel()
    form.customerName = '個人C'
    const id = '550e8400-e29b-41d4-a716-446655440000'
    form.ownerUserId = `  ${id}  `
    expect(buildCustomerFormPayload(form, false).ownerUserId).toBe(id)
  })

  it('编辑模式下负责人为空时显式传 null 以支持清空主档负责人', () => {
    const form = createDefaultFormModel()
    form.customerName = '編集'
    form.customerType = CustomerType.PERSONAL
    form.ownerUserId = ''
    const payload = buildCustomerFormPayload(form, true) as { ownerUserId?: string | null }
    expect(payload.ownerUserId).toBeNull()
  })

  it('编辑模式下保留 trim 后的负责人 ID', () => {
    const form = createDefaultFormModel()
    form.customerName = '編集'
    form.customerType = CustomerType.PERSONAL
    const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    form.ownerUserId = ` ${id}`
    const payload = buildCustomerFormPayload(form, true) as { ownerUserId?: string | null }
    expect(payload.ownerUserId).toBe(id)
  })

  it('personInfo.passportNumber 写入时去除首尾空白', () => {
    const form = createDefaultFormModel()
    form.customerName = '個人D'
    form.passportNumber = '  AB1234567  '
    const payload = buildCustomerFormPayload(form, false)
    expect(payload.personInfo?.passportNumber).toBe('AB1234567')
  })

  it('家族成員且选择关系时写入 personInfo.familyRelation', () => {
    const form = createDefaultFormModel()
    form.customerName = '個人E'
    form.isFamilyMember = true
    form.familyRelation = FamilyRelation.SPOUSE
    form.primaryCustomerId = 'primary-cust'
    const payload = buildCustomerFormPayload(form, false)
    expect(payload.personInfo?.isFamilyMember).toBe(true)
    expect(payload.personInfo?.familyRelation).toBe(FamilyRelation.SPOUSE)
    expect(payload.personInfo?.primaryCustomerId).toBe('primary-cust')
  })

  it('新建模式下在填写 photoFileId 时附带 trim 后的 UUID', () => {
    const form = createDefaultFormModel()
    form.customerName = '写真付き'
    const fid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    form.photoFileId = `  ${fid}  `
    const payload = buildCustomerFormPayload(form, false)
    expect(payload.photoFileId).toBe(fid)
  })

  it('编辑模式下 photoFileId 为空字符串时显式传 null', () => {
    const form = createDefaultFormModel()
    form.customerName = '編集'
    form.customerType = CustomerType.PERSONAL
    form.photoFileId = ''
    const payload = buildCustomerFormPayload(form, true) as { photoFileId?: string | null }
    expect(payload.photoFileId).toBeNull()
  })
})

describe('createDefaultFormModel / resolveCreateCustomerType / hasCompanyExtension', () => {
  it('无公司扩展时新建推导为个人客户', () => {
    const form = createDefaultFormModel()
    expect(hasCompanyExtension(form)).toBe(false)
    expect(resolveCreateCustomerType(form)).toBe(CustomerType.PERSONAL)
  })

  it('填写公司扩展时新建推导为法人客户', () => {
    const form = createDefaultFormModel()
    form.corporationNumber = '1234567890123'
    expect(hasCompanyExtension(form)).toBe(true)
    expect(resolveCreateCustomerType(form)).toBe(CustomerType.COMPANY)
  })
})

describe('accompanying members helpers', () => {
  it('createDefaultFormModel 含空的 accompanyingMembers', () => {
    expect(createDefaultFormModel().accompanyingMembers).toEqual([])
  })

  it('createDefaultFormModel 默认勾选随附家属沿用主档在留（docs/31 §5.6）', () => {
    expect(createDefaultFormModel().copyPrimaryResidenceToNewAccompanyingMembers).toBe(true)
  })

  it('accompanyingMemberRowHasAnyField 在任一字段非空时为 true', () => {
    const row = createEmptyAccompanyingMemberRow()
    expect(accompanyingMemberRowHasAnyField(row)).toBe(false)
    row.customerName = ' 子 '
    expect(accompanyingMemberRowHasAnyField(row)).toBe(true)
  })

  it('validateAccompanyingMemberRows 要求有内容行的姓名与关系', () => {
    const row = createEmptyAccompanyingMemberRow()
    row.customerName = 'A'
    row.familyRelation = ''
    expect(validateAccompanyingMemberRows([row])).toBe('relationRequired')
    row.familyRelation = FamilyRelation.SPOUSE
    expect(validateAccompanyingMemberRows([row])).toBeNull()
  })

  it('validateAccompanyingMemberRows 拒绝已落库行被清空而未移除', () => {
    const row = createEmptyAccompanyingMemberRow()
    row.customerId = '550e8400-e29b-41d4-a716-446655440001'
    expect(validateAccompanyingMemberRows([row])).toBe('orphanExisting')
  })

  it('listRemovedAccompanyingCustomerIds 返回已从行集合消失的初始 ID', () => {
    const initial = new Set(['a', 'b'])
    const rows = [createEmptyAccompanyingMemberRow()]
    rows[0].customerId = 'a'
    expect(listRemovedAccompanyingCustomerIds(initial, rows)).toEqual(['b'])
  })
})

describe('accompanying members create payload', () => {
  it('buildAccompanyingMemberCreatePayload 写入家属关联与可选联系方式', () => {
    const form = createDefaultFormModel()
    form.serviceType = ServiceType.ADMIN
    form.ownerUserId = '550e8400-e29b-41d4-a716-446655440099'
    const row = createEmptyAccompanyingMemberRow()
    row.customerName = ' 家属甲 '
    row.familyRelation = FamilyRelation.CHILD
    row.phone = ' 090-1 '
    row.passportNumber = ' P1 '
    const p = buildAccompanyingMemberCreatePayload(
      row,
      '550e8400-e29b-41d4-a716-446655440000',
      form,
    )
    expect(p.customerType).toBe(CustomerType.PERSONAL)
    expect(p.customerName).toBe('家属甲')
    expect(p.phone).toBe('090-1')
    expect(p.ownerUserId).toBe('550e8400-e29b-41d4-a716-446655440099')
    expect(p.personInfo?.isFamilyMember).toBe(true)
    expect(p.personInfo?.primaryCustomerId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(p.personInfo?.familyRelation).toBe(FamilyRelation.CHILD)
    expect(p.personInfo?.passportNumber).toBe('P1')
  })

  it('buildAccompanyingMemberCreatePayload 在勾选沿用且主档在留非空时写入 personInfo 在留两字段', () => {
    const form = createDefaultFormModel()
    form.copyPrimaryResidenceToNewAccompanyingMembers = true
    form.residenceStatus = ' 技人国 '
    form.residenceExpireDate = ' 2027-06-01 '
    const row = createEmptyAccompanyingMemberRow()
    row.customerName = '子'
    row.familyRelation = FamilyRelation.CHILD
    const p = buildAccompanyingMemberCreatePayload(
      row,
      '550e8400-e29b-41d4-a716-446655440000',
      form,
    )
    expect(p.personInfo?.residenceStatus).toBe('技人国')
    expect(p.personInfo?.residenceExpireDate).toBe('2027-06-01')
  })

  it('buildAccompanyingMemberCreatePayload 在关闭沿用时不在 POST 中带主档在留', () => {
    const form = createDefaultFormModel()
    form.copyPrimaryResidenceToNewAccompanyingMembers = false
    form.residenceStatus = '技人国'
    form.residenceExpireDate = '2027-06-01'
    const row = createEmptyAccompanyingMemberRow()
    row.customerName = '子'
    row.familyRelation = FamilyRelation.CHILD
    const p = buildAccompanyingMemberCreatePayload(
      row,
      '550e8400-e29b-41d4-a716-446655440000',
      form,
    )
    expect(p.personInfo?.residenceStatus).toBeUndefined()
    expect(p.personInfo?.residenceExpireDate).toBeUndefined()
  })

  it('primaryResidenceHasValueForAccompanyingCopy 在资格与期限均空白时为 false', () => {
    const form = createDefaultFormModel()
    form.residenceStatus = '  '
    form.residenceExpireDate = ''
    expect(primaryResidenceHasValueForAccompanyingCopy(form)).toBe(false)
  })
})

describe('accompanying members update payload', () => {
  it('buildAccompanyingMemberUpdatePayload 组装局部更新体', () => {
    const row = createEmptyAccompanyingMemberRow()
    row.customerId = 'x'
    row.customerName = 'B'
    row.familyRelation = FamilyRelation.PARENT
    const p = buildAccompanyingMemberUpdatePayload(
      row,
      '550e8400-e29b-41d4-a716-446655440000',
    )
    expect(p.customerName).toBe('B')
    expect(p.personInfo?.familyRelation).toBe(FamilyRelation.PARENT)
  })

  it('mapCustomerItemToAccompanyingMemberRow 映射列表项字段', () => {
    const item = {
      id: 'cid-1',
      customerName: '子',
      phone: 'p',
      personInfo: {
        familyRelation: FamilyRelation.SPOUSE,
        passportNumber: 'AB',
      },
    } as unknown as CustomerItem
    const r = mapCustomerItemToAccompanyingMemberRow(item)
    expect(r.clientKey).toBe('cid-1')
    expect(r.customerId).toBe('cid-1')
    expect(r.familyRelation).toBe(FamilyRelation.SPOUSE)
    expect(r.passportNumber).toBe('AB')
  })
})

describe('buildBaseFormValues', () => {
  it('映射 ownerUserId 与微信、LINE 可空字段为表单字符串', () => {
    const item = {
      customerType: CustomerType.PERSONAL,
      customerName: 'X',
      phone: null,
      email: null,
      wechatId: null,
      lineId: undefined,
      address: '',
      serviceType: ServiceType.ADMIN,
      ownerUserId: '550e8400-e29b-41d4-a716-446655440000',
    } as unknown as CustomerItem

    const base = buildBaseFormValues(item)
    expect(base.wechatId).toBe('')
    expect(base.lineId).toBe('')
    expect(base.ownerUserId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})
