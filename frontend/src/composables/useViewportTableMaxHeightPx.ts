import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

const TABLE_BODY_MIN_PX = 240

/**
 * 按浏览器视口高度计算列表页表格 `max-height`（像素），供 `el-table` / `ProTable` 固定表头与表体滚动。
 *
 * @param reservedPx - 为顶栏、标签栏、页眉、筛选区、分页等预留的纵向像素总和
 * @returns 响应式最大高度 ref，随 `resize` 更新且不低于 240px
 */
export function useViewportTableMaxHeightPx(reservedPx: number): Ref<number> {
  const maxHeightPx = ref(
    typeof window === 'undefined'
      ? 480
      : Math.max(TABLE_BODY_MIN_PX, window.innerHeight - reservedPx),
  )

  /** 根据 `window.innerHeight` 与预留像素写回 `maxHeightPx`。 */
  function syncMaxHeightFromViewport(): void {
    if (typeof window === 'undefined') {
      return
    }
    maxHeightPx.value = Math.max(
      TABLE_BODY_MIN_PX,
      window.innerHeight - reservedPx,
    )
  }

  onMounted(() => {
    syncMaxHeightFromViewport()
    window.addEventListener('resize', syncMaxHeightFromViewport)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', syncMaxHeightFromViewport)
  })

  return maxHeightPx
}
