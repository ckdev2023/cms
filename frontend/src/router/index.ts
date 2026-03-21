import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { P } from '@/constants/permissions'

NProgress.configure({ showSpinner: false })

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { titleKey: 'routes.login', public: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: { titleKey: 'routes.forbidden', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { titleKey: 'routes.home' },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { titleKey: 'routes.dashboard', affix: true, permissions: [P.DASHBOARD_VIEW] },
      },
      {
        path: 'customers',
        name: 'CustomerList',
        component: () => import('@/views/customer/CustomerListView.vue'),
        meta: { titleKey: 'routes.customers', permissions: [P.CUSTOMER_LIST] },
      },
      {
        path: 'customers/:id',
        name: 'CustomerDetail',
        component: () => import('@/views/customer/CustomerDetailView.vue'),
        meta: { titleKey: 'routes.customerDetail', hidden: true, permissions: [P.CUSTOMER_DETAIL] },
      },
      {
        path: 'admin-cases',
        name: 'AdminCaseList',
        component: () => import('@/views/admin-case/AdminCaseListView.vue'),
        meta: { titleKey: 'routes.adminCases', permissions: [P.ADMIN_CASE_LIST] },
      },
      {
        path: 'admin-cases/:id',
        name: 'AdminCaseDetail',
        component: () => import('@/views/admin-case/AdminCaseDetailView.vue'),
        meta: { titleKey: 'routes.adminCaseDetail', hidden: true, permissions: [P.ADMIN_CASE_DETAIL] },
      },
      {
        path: 'tax-contracts',
        name: 'TaxContractList',
        component: () => import('@/views/tax/TaxContractListView.vue'),
        meta: { titleKey: 'routes.taxContracts', permissions: [P.TAX_LIST] },
      },
      {
        path: 'tax-contracts/:id',
        name: 'TaxContractDetail',
        component: () => import('@/views/tax/TaxContractDetailView.vue'),
        meta: { titleKey: 'routes.taxContractDetail', hidden: true, permissions: [P.TAX_DETAIL] },
      },
      {
        path: 'finance',
        redirect: '/finance/invoices',
        meta: { titleKey: 'routes.finance', permissions: [P.FINANCE_LIST] },
      },
      {
        path: 'finance/invoices',
        name: 'InvoiceList',
        component: () => import('@/views/invoice/InvoiceListView.vue'),
        meta: { titleKey: 'routes.invoices', permissions: [P.FINANCE_LIST] },
      },
      {
        path: 'finance/invoices/:id',
        name: 'InvoiceDetail',
        component: () => import('@/views/invoice/InvoiceDetailView.vue'),
        meta: { titleKey: 'routes.invoiceDetail', hidden: true, permissions: [P.FINANCE_DETAIL] },
      },
      {
        path: 'finance/payments',
        name: 'PaymentList',
        component: () => import('@/views/payment/PaymentListView.vue'),
        meta: { titleKey: 'routes.payments', permissions: [P.FINANCE_LIST] },
      },
      {
        path: 'finance/payments/:id',
        name: 'PaymentDetail',
        component: () => import('@/views/payment/PaymentDetailView.vue'),
        meta: { titleKey: 'routes.paymentDetail', hidden: true, permissions: [P.FINANCE_DETAIL] },
      },
      {
        path: 'finance/deposits',
        name: 'DepositList',
        component: () => import('@/views/deposit/DepositListView.vue'),
        meta: { titleKey: 'routes.deposits', permissions: [P.FINANCE_LIST] },
      },
      {
        path: 'finance/deposits/:id',
        name: 'DepositDetail',
        component: () => import('@/views/deposit/DepositDetailView.vue'),
        meta: { titleKey: 'routes.depositDetail', hidden: true, permissions: [P.FINANCE_DETAIL] },
      },
      {
        path: 'files',
        name: 'FileList',
        component: () => import('@/views/file/FileListView.vue'),
        meta: { titleKey: 'routes.files', permissions: [P.FILE_LIST] },
      },
      {
        path: 'system/users',
        name: 'SystemUsers',
        component: () => import('@/views/system/UserListView.vue'),
        meta: { titleKey: 'routes.systemUsers', permissions: [P.SYSTEM_USER_MANAGE] },
      },
      {
        path: 'system/roles',
        name: 'SystemRoles',
        component: () => import('@/views/system/RoleListView.vue'),
        meta: { titleKey: 'routes.systemRoles', permissions: [P.SYSTEM_ROLE_MANAGE] },
      },
      {
        path: 'system/dictionaries',
        name: 'SystemDictionaries',
        component: () => import('@/views/system/DictionaryListView.vue'),
        meta: { titleKey: 'routes.systemDictionaries', permissions: [P.SYSTEM_DICT_MANAGE] },
      },
      {
        path: 'system/audit-logs',
        name: 'AuditLogs',
        component: () => import('@/views/system/AuditLogListView.vue'),
        meta: { titleKey: 'routes.auditLogs', permissions: [P.LOG_LIST] },
      },
      {
        path: 'system/login-logs',
        name: 'LoginLogs',
        component: () => import('@/views/system/LoginLogListView.vue'),
        meta: { titleKey: 'routes.loginLogs', permissions: [P.LOG_LIST] },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { titleKey: 'routes.notFound', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

let userInfoLoaded = false

router.beforeEach(async (to, _from, next) => {
  NProgress.start()

  const token = localStorage.getItem('access_token')

  if (!to.meta.public && !token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.path === '/login' && token) {
    next({ path: '/' })
    return
  }

  if (token && !userInfoLoaded && !to.meta.public) {
    try {
      const { useUserStore } = await import('@/stores/user')
      const userStore = useUserStore()
      if (!userStore.userInfo) {
        await userStore.fetchUserInfo()
      }
      userInfoLoaded = true
    } catch {
      localStorage.removeItem('access_token')
      userInfoLoaded = false
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
  }

  if (!token) {
    userInfoLoaded = false
  }

  const requiredPerms = to.meta.permissions as string[] | undefined
  if (requiredPerms?.length && token) {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    const hasAny = requiredPerms.some((p) => userStore.hasPermission(p))
    if (!hasAny) {
      next({ path: '/403' })
      return
    }
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export { routes }
export default router
