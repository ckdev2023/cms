import type { ApiResponse } from '@/types'
import { request } from '@/utils/request'

export interface DictItem {
  value: string
  label: string
}

/**
 * 获取系统中可用的数据字典类型列表。
 *
 * @returns 全部字典类型编码的响应体
 */
export function getDictTypes(): Promise<ApiResponse<string[]>> {
  return request<string[]>({ url: '/dictionaries', method: 'GET' })
}

/**
 * 按字典类型获取可选项列表。
 *
 * @param type - 字典类型编码
 * @returns 对应字典项列表的响应体
 */
export function getDictByType(type: string): Promise<ApiResponse<DictItem[]>> {
  return request<DictItem[]>({ url: `/dictionaries/${type}`, method: 'GET' })
}
