import axios from 'axios'

import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  FileItem,
  FileQueryParams,
  UpdateFileParams,
  UploadFileParams,
} from '@/types/file'
import { request } from '@/utils/request'

/**
 * 按筛选条件分页获取文件中心列表。
 *
 * @param params - 文件分页、业务类型与关键字等查询条件
 * @returns 包含文件列表与总数的分页响应体
 */
export function getFiles(
  params: FileQueryParams,
): Promise<ApiResponse<PaginatedResponse<FileItem>>> {
  return request<PaginatedResponse<FileItem>>({
    url: '/files',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个文件记录的详情信息。
 *
 * @param id - 目标文件 ID
 * @returns 指定文件的详情响应体
 */
export function getFile(id: string): Promise<ApiResponse<FileItem>> {
  return request<FileItem>({
    url: `/files/${id}`,
    method: 'GET',
  })
}

/**
 * 上传业务文件并返回创建后的文件记录。
 *
 * @param params - 包含原始文件、业务归属和可选描述的上传参数
 * @returns 上传成功后的文件详情响应体
 */
export function uploadFile(params: UploadFileParams): Promise<ApiResponse<FileItem>> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('businessType', params.businessType)
  if (params.customerId) {formData.append('customerId', params.customerId)}
  if (params.relatedId) {formData.append('relatedId', params.relatedId)}
  if (params.description) {formData.append('description', params.description)}

  return request<FileItem>({
    url: '/files/upload',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })
}

/**
 * 更新指定文件记录的元数据。
 *
 * @param id - 需要更新的文件 ID
 * @param data - 文件描述、归属关系等可编辑字段
 * @returns 更新后的文件详情响应体
 */
export function updateFile(
  id: string,
  data: UpdateFileParams,
): Promise<ApiResponse<FileItem>> {
  return request<FileItem>({
    url: `/files/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除指定的文件记录。
 *
 * @param id - 需要删除的文件 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteFile(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/files/${id}`,
    method: 'DELETE',
  })
}

/**
 * 构造文件在线预览接口的直连地址。
 *
 * @param id - 需要预览的文件 ID
 * @returns 追加当前访问令牌后的预览 URL
 */
export function getFilePreviewUrl(id: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = localStorage.getItem('access_token') || ''
  return `${base}/files/${id}/preview?token=${encodeURIComponent(token)}`
}

/**
 * 下载指定文件并触发浏览器保存。
 *
 * @param id - 需要下载的文件 ID
 * @param fileName - 下载时显示的文件名；省略时默认使用 `download`
 * @returns 下载流程完成后的异步结果
 */
export async function downloadFile(id: string, fileName?: string): Promise<void> {
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
