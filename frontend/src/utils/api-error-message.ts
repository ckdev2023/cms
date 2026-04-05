import axios from 'axios'

/**
 * 从 Axios 响应体或标准 Error 中提取可供界面展示的错误文案，用于材料写回等场景的就地提示。
 *
 * @param error - `catch` 子句捕获的未知错误
 * @returns 后端 `message` 或 `Error.message`；无法解析时返回空字符串
 */
export function pickApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    if (data?.message) {return data.message}
    if (error.message) {return error.message}
    return ''
  }
  if (error instanceof Error) {return error.message}
  return ''
}
