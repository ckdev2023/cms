/**
 * 向导侧栏与摘要中「本案申请人」展示名：优先客户姓名，否则回退为 ID。
 */
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

type ApplicantProps = {
  customerId: string
  contextCustomerName?: string
}

/**
 * 根据上下文客户姓名与客户 ID 计算申请人展示字符串。
 *
 * @param props - 父组件传入的当前客户标识与可选显示名
 */
export function useContextApplicantDisplay(
  props: ApplicantProps,
): ComputedRef<string> {
  return computed((): string => {
    const name = props.contextCustomerName?.trim()
    if (name) {return name}
    return props.customerId
  })
}
