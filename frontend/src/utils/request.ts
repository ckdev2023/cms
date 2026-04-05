import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage } from 'element-plus'

import { translate } from '@/i18n'
import router from '@/router'
import type { ApiResponse } from '@/types'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.config.responseType === 'blob') {
      return response
    }
    const res = response.data
    if (res.code !== 0) {
      ElMessage.error(res.message || translate('request.requestError'))
      if (res.code === 401) {
        localStorage.removeItem('access_token')
        router.push('/login')
      }
      return Promise.reject(new Error(res.message || 'Error'))
    }
    return response
  },
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      localStorage.removeItem('access_token')
      router.push('/login')
    } else if (status === 403) {
      ElMessage.error(error.response?.data?.message || translate('request.forbidden'))
      router.push('/403')
    } else {
      ElMessage.error(
        error.response?.data?.message || error.message || translate('request.networkError'),
      )
    }
    return Promise.reject(error)
  },
)

/**
 * 发送统一配置的 API 请求并解包标准响应体。
 *
 * 请求前会自动附带本地 access token；响应阶段会统一处理业务错误、
 * 鉴权失效跳转与消息提示。
 *
 * @param config - Axios 请求配置，包含 URL、method、params、data 等信息
 * @returns 符合 `ApiResponse<T>` 结构的业务响应体
 * @throws {Error} 后端返回非零业务码或网络请求失败时抛出错误
 */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service(config).then((res) => res.data as ApiResponse<T>)
}

export default service
