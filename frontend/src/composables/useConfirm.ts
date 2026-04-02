import { ElMessageBox } from 'element-plus'

import { translate } from '@/i18n'

export interface ConfirmOptions {
  title?: string
  message: string
  type?: 'warning' | 'info' | 'success' | 'error'
  confirmText?: string
  cancelText?: string
}

/**
 * 提供统一的确认对话框与删除确认快捷方法。
 *
 * 基于 Element Plus MessageBox 封装项目内常用的确认交互文案。
 *
 * @returns 包含通用确认与删除确认方法的对象
 */
export function useConfirm() {
  /**
   * 弹出确认对话框并等待用户确认或取消。
   *
   * @param options - 对话框配置；传入字符串时会作为提示正文
   * @returns 用户点击确认时返回 true，取消或关闭时返回 false
   */
  async function confirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts =
      typeof options === 'string' ? { message: options } : options
    try {
      await ElMessageBox.confirm(opts.message, opts.title || translate('confirm.title'), {
        type: opts.type || 'warning',
        confirmButtonText: opts.confirmText || translate('confirm.confirm'),
        cancelButtonText: opts.cancelText || translate('confirm.cancel'),
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 弹出删除操作确认框，并根据对象名称生成提示文案。
   *
   * @param itemName - 被删除对象的显示名称；省略时使用通用删除提示
   * @returns 用户确认删除时返回 true，取消或关闭时返回 false
   */
  async function confirmDelete(itemName?: string): Promise<boolean> {
    const message = itemName
      ? translate('confirm.deleteNamed', { itemName })
      : translate('confirm.deleteUnnamed')
    return confirm({ title: translate('confirm.deleteTitle'), message, type: 'warning' })
  }

  return { confirm, confirmDelete }
}
