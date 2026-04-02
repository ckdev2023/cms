import { createRouter, createWebHistory } from 'vue-router'

import { registerRouterGuards } from './guards'
import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

registerRouterGuards(router)

export { routes }
export default router
