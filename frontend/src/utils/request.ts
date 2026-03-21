import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types'
import router from '@/router'
import { translate } from '@/i18n'

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

export function request<T = unknown>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  return service(config).then((res) => res.data as ApiResponse<T>)
}

export default service
