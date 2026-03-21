import axios from 'axios'
import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  FileItem,
  FileQueryParams,
  UpdateFileParams,
  UploadFileParams,
} from '@/types/file'

export function getFiles(params: FileQueryParams) {
  return request<PaginatedResponse<FileItem>>({
    url: '/files',
    method: 'GET',
    params,
  })
}

export function getFile(id: string) {
  return request<FileItem>({
    url: `/files/${id}`,
    method: 'GET',
  })
}

export function uploadFile(params: UploadFileParams) {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('businessType', params.businessType)
  if (params.customerId) formData.append('customerId', params.customerId)
  if (params.relatedId) formData.append('relatedId', params.relatedId)
  if (params.description) formData.append('description', params.description)

  return request<FileItem>({
    url: '/files/upload',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })
}

export function updateFile(id: string, data: UpdateFileParams) {
  return request<FileItem>({
    url: `/files/${id}`,
    method: 'PUT',
    data,
  })
}

export function deleteFile(id: string) {
  return request<void>({
    url: `/files/${id}`,
    method: 'DELETE',
  })
}

export function getFilePreviewUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = localStorage.getItem('access_token') || ''
  return `${base}/files/${id}/preview?token=${encodeURIComponent(token)}`
}

export async function downloadFile(id: string, fileName?: string) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = localStorage.getItem('access_token')

  const response = await axios.get(`${base}/files/${id}/download`, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${token}` },
  })

  const blob = new Blob([response.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName || 'download'
  link.click()
  URL.revokeObjectURL(link.href)
}
