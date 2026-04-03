/**
 * 定义写入访问令牌的最小用户身份载荷。
 */
export interface JwtPayload {
  sub: string;
  username: string;
}

/**
 * 定义 JWT 鉴权通过后注入请求对象的用户概要。
 */
export interface JwtAuthenticatedUser {
  id: string;
  username: string;
}
