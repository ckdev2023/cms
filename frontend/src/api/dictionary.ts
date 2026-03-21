import { request } from '@/utils/request'

export interface DictItem {
  value: string
  label: string
}

export function getDictTypes() {
  return request<string[]>({ url: '/dictionaries', method: 'GET' })
}

export function getDictByType(type: string) {
  return request<DictItem[]>({ url: `/dictionaries/${type}`, method: 'GET' })
}
