import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  TaxContractItem,
  TaxContractDetail,
  CreateTaxContractParams,
  UpdateTaxContractParams,
  TaxContractQueryParams,
  TaxPeriodItem,
  TaxPeriodDetail,
  CreateTaxPeriodParams,
  UpdateTaxPeriodParams,
  TaxPeriodQueryParams,
  GeneratePeriodsParams,
  TaxMonthlyDocumentItem,
  CreateTaxDocumentParams,
  UpdateTaxDocumentParams,
  TaxMonthlyWorkItemItem,
  CreateTaxWorkItemParams,
  UpdateTaxWorkItemParams,
} from '@/types/tax'
import type { TaxContractStatus, MonthlyStatus } from '@/constants/enums'

// ── Tax Contracts ────────────────────────────────────────

export function getTaxContracts(params: TaxContractQueryParams) {
  return request<PaginatedResponse<TaxContractItem>>({
    url: '/tax-contracts',
    method: 'GET',
    params,
  })
}

export function getTaxContract(id: string) {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}`,
    method: 'GET',
  })
}

export function createTaxContract(data: CreateTaxContractParams) {
  return request<TaxContractDetail>({
    url: '/tax-contracts',
    method: 'POST',
    data,
  })
}

export function updateTaxContract(
  id: string,
  data: UpdateTaxContractParams,
) {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}`,
    method: 'PUT',
    data,
  })
}

export function updateTaxContractStatus(
  id: string,
  contractStatus: TaxContractStatus,
) {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}/status`,
    method: 'PATCH',
    data: { contractStatus },
  })
}

export function deleteTaxContract(id: string) {
  return request<void>({
    url: `/tax-contracts/${id}`,
    method: 'DELETE',
  })
}

export function getTaxContractTransitions(id: string) {
  return request<TaxContractStatus[]>({
    url: `/tax-contracts/${id}/transitions`,
    method: 'GET',
  })
}

// ── Tax Periods ──────────────────────────────────────────

export function getTaxPeriods(
  contractId: string,
  params: TaxPeriodQueryParams,
) {
  return request<PaginatedResponse<TaxPeriodItem>>({
    url: `/tax-contracts/${contractId}/periods`,
    method: 'GET',
    params,
  })
}

export function getTaxPeriod(contractId: string, periodId: string) {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'GET',
  })
}

export function createTaxPeriod(
  contractId: string,
  data: CreateTaxPeriodParams,
) {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods`,
    method: 'POST',
    data,
  })
}

export function updateTaxPeriod(
  contractId: string,
  periodId: string,
  data: UpdateTaxPeriodParams,
) {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'PUT',
    data,
  })
}

export function updateTaxPeriodStatus(
  contractId: string,
  periodId: string,
  monthlyStatus: MonthlyStatus,
) {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/status`,
    method: 'PATCH',
    data: { monthlyStatus },
  })
}

export function deleteTaxPeriod(contractId: string, periodId: string) {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'DELETE',
  })
}

export function generateTaxPeriods(
  contractId: string,
  data: GeneratePeriodsParams,
) {
  return request<TaxPeriodItem[]>({
    url: `/tax-contracts/${contractId}/periods/generate`,
    method: 'POST',
    data,
  })
}

// ── Tax Monthly Documents ────────────────────────────────

export function createTaxDocument(
  contractId: string,
  periodId: string,
  data: CreateTaxDocumentParams,
) {
  return request<TaxMonthlyDocumentItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents`,
    method: 'POST',
    data,
  })
}

export function updateTaxDocument(
  contractId: string,
  periodId: string,
  docId: string,
  data: UpdateTaxDocumentParams,
) {
  return request<TaxMonthlyDocumentItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents/${docId}`,
    method: 'PUT',
    data,
  })
}

export function deleteTaxDocument(
  contractId: string,
  periodId: string,
  docId: string,
) {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents/${docId}`,
    method: 'DELETE',
  })
}

// ── Tax Monthly Work Items ───────────────────────────────

export function createTaxWorkItem(
  contractId: string,
  periodId: string,
  data: CreateTaxWorkItemParams,
) {
  return request<TaxMonthlyWorkItemItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items`,
    method: 'POST',
    data,
  })
}

export function updateTaxWorkItem(
  contractId: string,
  periodId: string,
  itemId: string,
  data: UpdateTaxWorkItemParams,
) {
  return request<TaxMonthlyWorkItemItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items/${itemId}`,
    method: 'PUT',
    data,
  })
}

export function deleteTaxWorkItem(
  contractId: string,
  periodId: string,
  itemId: string,
) {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items/${itemId}`,
    method: 'DELETE',
  })
}
