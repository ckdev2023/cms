import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  CustomerItem,
  CustomerDetail,
  CreateCustomerParams,
  UpdateCustomerParams,
  CustomerQueryParams,
  NoteItem,
  CreateNoteParams,
  UpdateNoteParams,
  NoteQueryParams,
} from '@/types/customer'

export function getCustomers(params: CustomerQueryParams) {
  return request<PaginatedResponse<CustomerItem>>({
    url: '/customers',
    method: 'GET',
    params,
  })
}

export function getCustomer(id: string) {
  return request<CustomerDetail>({
    url: `/customers/${id}`,
    method: 'GET',
  })
}

export function createCustomer(data: CreateCustomerParams) {
  return request<CustomerDetail>({
    url: '/customers',
    method: 'POST',
    data,
  })
}

export function updateCustomer(id: string, data: UpdateCustomerParams) {
  return request<CustomerDetail>({
    url: `/customers/${id}`,
    method: 'PUT',
    data,
  })
}

export function deleteCustomer(id: string) {
  return request<void>({
    url: `/customers/${id}`,
    method: 'DELETE',
  })
}

export function getNotes(customerId: string, params: NoteQueryParams) {
  return request<PaginatedResponse<NoteItem>>({
    url: `/customers/${customerId}/notes`,
    method: 'GET',
    params,
  })
}

export function createNote(customerId: string, data: CreateNoteParams) {
  return request<NoteItem>({
    url: `/customers/${customerId}/notes`,
    method: 'POST',
    data,
  })
}

export function updateNote(customerId: string, noteId: string, data: UpdateNoteParams) {
  return request<NoteItem>({
    url: `/customers/${customerId}/notes/${noteId}`,
    method: 'PUT',
    data,
  })
}

export function deleteNote(customerId: string, noteId: string) {
  return request<void>({
    url: `/customers/${customerId}/notes/${noteId}`,
    method: 'DELETE',
  })
}
