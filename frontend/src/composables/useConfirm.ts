import { ElMessageBox } from 'element-plus'
import { translate } from '@/i18n'

export interface ConfirmOptions {
  title?: string
  message: string
  type?: 'warning' | 'info' | 'success' | 'error'
  confirmText?: string
  cancelText?: string
}

export function useConfirm() {
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

  async function confirmDelete(itemName?: string): Promise<boolean> {
    const message = itemName
      ? translate('confirm.deleteNamed', { itemName })
      : translate('confirm.deleteUnnamed')
    return confirm({ title: translate('confirm.deleteTitle'), message, type: 'warning' })
  }

  return { confirm, confirmDelete }
}
