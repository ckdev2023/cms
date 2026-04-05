import type { RouteRecordRaw } from 'vue-router'

import { P } from '@/constants/permissions'

/**
 * 定义后台应用的静态路由树，集中维护页面入口与权限元信息。
 *
 * 所有需要参与菜单、面包屑和权限判断的页面都应优先在这里声明。
 */
export const routes: RouteRecordRaw[] = [
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
        path: 'customers/admin-cases/:id',
        name: 'AdminCaseDetail',
        component: () => import('@/views/admin-case/AdminCaseDetailView.vue'),
        meta: { titleKey: 'routes.adminCaseDetail', hidden: true, permissions: [P.ADMIN_CASE_DETAIL] },
      },
      {
        path: 'customers',
        component: () => import('@/layouts/CustomerCenterLayout.vue'),
        meta: { titleKey: 'routes.customers', breadcrumb: false },
        children: [
          {
            path: '',
            name: 'CustomerList',
            component: () => import('@/views/customer/CustomerListView.vue'),
            meta: {
              titleKey: 'routes.customers',
              permissions: [P.CUSTOMER_LIST],
              /** 内层 KeepAlive 承载缓存；外层与 route.name 解耦，避免误匹配 */
              noCache: true,
            },
          },
          {
            path: 'residence-reminders',
            name: 'ResidenceReminderList',
            component: () => import('@/views/customer/CustomerListView.vue'),
            meta: {
              titleKey: 'routes.residenceReminders',
              permissions: [P.CUSTOMER_LIST],
              defaultResidenceExpireWithinDays: 90,
              noCache: true,
            },
          },
          {
            path: 'workbench/visa',
            name: 'VisaWorkbench',
            component: () => import('@/views/visa/VisaWorkbenchView.vue'),
            meta: {
              titleKey: 'routes.workbenchVisa',
              /** docs/21 §17.2：visaReminder:list 与 visaCase:list 二选一即可进入 */
              permissions: [P.VISA_REMINDER_LIST, P.VISA_CASE_LIST],
              noCache: true,
            },
          },
          {
            path: 'visa-reminders',
            name: 'VisaReminderList',
            component: () => import('@/views/visa/VisaReminderListView.vue'),
            meta: { titleKey: 'routes.visaReminders', permissions: [P.VISA_REMINDER_LIST], noCache: true },
          },
          {
            path: 'visa-cases',
            name: 'VisaCaseRegistry',
            component: () => import('@/views/visa/VisaCaseRegistryView.vue'),
            meta: { titleKey: 'routes.visaCaseRegistry', permissions: [P.VISA_CASE_LIST], noCache: true },
          },
          {
            path: 'visa-case-import',
            name: 'VisaCaseImport',
            component: () => import('@/views/visa/VisaCaseImportView.vue'),
            meta: { titleKey: 'routes.visaCaseImport', permissions: [P.VISA_CASE_IMPORT], noCache: true },
          },
          {
            path: 'admin-case-visa-supplement',
            name: 'AdminCaseVisaSupplement',
            component: () => import('@/views/visa/AdminCaseVisaSupplementView.vue'),
            meta: {
              titleKey: 'routes.adminCaseVisaSupplement',
              permissions: [P.VISA_CASE_ADMIN_SUPPLEMENT],
              noCache: true,
            },
          },
          {
            path: 'admin-cases',
            name: 'AdminCaseList',
            component: () => import('@/views/admin-case/AdminCaseListView.vue'),
            meta: {
              titleKey: 'routes.adminCases',
              /** docs/21 §14.1 B8：仅行政案件权即可直达，勿叠加签证域权限 */
              permissions: [P.ADMIN_CASE_LIST],
              legacyEntryKind: 'adminCases',
              noCache: true,
            },
          },
        ],
      },
      {
        path: 'customers/:id',
        name: 'CustomerDetail',
        component: () => import('@/views/customer/CustomerDetailView.vue'),
        meta: { titleKey: 'routes.customerDetail', hidden: true, permissions: [P.CUSTOMER_DETAIL] },
      },
      {
        path: 'workbench/visa',
        redirect: (to) => ({ path: '/customers/workbench/visa', query: to.query }),
      },
      {
        path: 'visa-reminders',
        redirect: (to) => ({ path: '/customers/visa-reminders', query: to.query }),
      },
      {
        path: 'visa-cases',
        redirect: (to) => ({ path: '/customers/visa-cases', query: to.query }),
      },
      {
        path: 'visa-case-import',
        redirect: (to) => ({ path: '/customers/visa-case-import', query: to.query }),
      },
      {
        path: 'admin-case-visa-supplement',
        redirect: (to) => ({ path: '/customers/admin-case-visa-supplement', query: to.query }),
      },
      {
        path: 'admin-cases',
        redirect: (to) => ({ path: '/customers/admin-cases', query: to.query }),
      },
      {
        path: 'admin-cases/:id',
        redirect: (to) => {
          const raw = to.params.id
          const id = Array.isArray(raw) ? raw[0] : raw
          return {
            path: `/customers/admin-cases/${String(id ?? '')}`,
            query: to.query,
          }
        },
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
      {
        path: 'system/export-logs',
        name: 'ExportLogs',
        component: () => import('@/views/system/ExportLogListView.vue'),
        meta: { titleKey: 'routes.exportLogs', permissions: [P.LOG_LIST] },
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
