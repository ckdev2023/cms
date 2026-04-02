/**
 * 定义文件中心列表、上传与编辑操作使用的类型。
 */
import type { BusinessType } from '@/constants/enums'

export interface FileItem {
  id: string
  customerId: string | null
  businessType: BusinessType
  relatedId: string | null
  fileName: string
  description: string | null
  fileExt: string | null
  fileSize: number | null
  mimeType: string | null
  uploadedBy: string | null
  uploaderName: string | null
  createdAt: string
  updatedAt: string
}

export interface FileQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  businessType?: BusinessType
  customerId?: string
  relatedId?: string
  uploadedBy?: string
  fileExt?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface UpdateFileParams {
  fileName?: string
  description?: string
  businessType?: BusinessType
}

export interface UploadFileParams {
  file: File
  businessType: BusinessType
  customerId?: string
  relatedId?: string
  description?: string
}
