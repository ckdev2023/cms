export interface IApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}
